import * as functions from 'firebase-functions';
import { getFirestore, FieldValue, Timestamp } from 'firebase-admin/firestore';

export const scheduledAutoAssign = functions.pubsub
  .schedule('every 30 minutes')
  .onRun(async () => {
    const db = getFirestore();
    const threeHoursAgo = new Date(Date.now() - 3 * 60 * 60 * 1000);

    const pendingSnap = await db
      .collection('serviceRequests')
      .where('status', '==', 'Submitted')
      .where('createdAt', '<=', Timestamp.fromDate(threeHoursAgo))
      .limit(20)
      .get();

    if (pendingSnap.empty) {
      console.log('No pending unassigned complaints found for escalation.');
      return null;
    }

    console.log(`Processing ${pendingSnap.size} delayed complaints for auto-assignment...`);
    return null;
  });

export const scheduledAutoClose = functions.pubsub
  .schedule('every 24 hours')
  .onRun(async () => {
    const db = getFirestore();
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

    const resolvedSnap = await db
      .collection('serviceRequests')
      .where('status', '==', 'Resolved')
      .where('resolvedAt', '<=', sevenDaysAgo.toISOString())
      .limit(20)
      .get();

    if (resolvedSnap.empty) {
      console.log('No resolved complaints eligible for 7-day auto-closure.');
      return null;
    }

    console.log(`Auto-closing ${resolvedSnap.size} resolved complaints...`);
    for (const docSnap of resolvedSnap.docs) {
      const data = docSnap.data();
      const activity = {
        id: `autoclose-${Date.now()}`,
        type: 'REQUEST_CLOSED',
        title: 'Automatically Closed',
        description: 'Service request automatically closed after 7 days in Resolved status.',
        performedBy: 'system',
        performedByName: 'Auto-Closure System',
        performedByRole: 'super_admin',
        timestamp: new Date().toISOString(),
        oldValue: 'Resolved',
        newValue: 'Closed',
      };

      await docSnap.ref.update({
        status: 'Closed',
        timeline: FieldValue.arrayUnion(activity),
        updatedAt: FieldValue.serverTimestamp(),
      });

      if (data.assignedStaffId) {
        await db.collection('users').doc(data.assignedStaffId).update({
          activeComplaintCount: FieldValue.increment(-1),
          completedComplaintCount: FieldValue.increment(1),
          updatedAt: FieldValue.serverTimestamp(),
        });
      }
    }

    return null;
  });
