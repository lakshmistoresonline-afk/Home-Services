import * as functions from 'firebase-functions';
import { getFirestore, FieldValue, DocumentReference } from 'firebase-admin/firestore';

export const assignComplaint = functions.https.onCall(async (data: any, context: functions.https.CallableContext) => {
  if (!context.auth) {
    throw new functions.https.HttpsError('unauthenticated', 'User must be authenticated.');
  }

  const actorUid = context.auth.uid;
  const db = getFirestore();

  const { complaintId, staffId, remarks } = data;
  if (!complaintId) {
    throw new functions.https.HttpsError('invalid-argument', 'Complaint ID is required.');
  }

  const actorDoc = await db.collection('users').doc(actorUid).get();
  const actorData = actorDoc.data() || {};
  const actorRole = actorData.role || 'citizen';

  if (actorRole === 'readonly_super_admin' || actorRole === 'citizen' || actorRole === 'staff') {
    throw new functions.https.HttpsError('permission-denied', 'Unauthorized to assign service requests.');
  }

  const requestRef = db.collection('serviceRequests').doc(complaintId);

  return db.runTransaction(async (transaction) => {
    const requestSnap = await transaction.get(requestRef);
    if (!requestSnap.exists) {
      throw new functions.https.HttpsError('not-found', 'Service request not found.');
    }

    const requestData = requestSnap.data()!;
    const prevStaffId = requestData.assignedStaffId || null;

    let newStaffData: any = null;
    let newStaffRef: DocumentReference | null = null;

    if (staffId) {
      newStaffRef = db.collection('users').doc(staffId);
      const newStaffSnap = await transaction.get(newStaffRef);
      if (!newStaffSnap.exists) {
        throw new functions.https.HttpsError('not-found', 'Target staff member not found.');
      }
      newStaffData = newStaffSnap.data()!;
    }

    const nowIso = new Date().toISOString();
    const historyEntry = {
      previousStaffId: prevStaffId,
      previousStaffName: requestData.assignedStaffName || null,
      newStaffId: staffId || null,
      newStaffName: newStaffData?.fullName || null,
      assignedBy: actorUid,
      assignedByName: actorData.fullName || 'Admin',
      timestamp: nowIso,
    };

    const activity = {
      id: `assign-${Date.now()}`,
      type: 'SERVICE_REQUEST_ASSIGNED',
      title: staffId ? `Assigned to ${newStaffData?.fullName}` : 'Assignment Cleared',
      description: remarks || null,
      performedBy: actorUid,
      performedByName: actorData.fullName || 'Admin',
      performedByRole: actorRole,
      timestamp: nowIso,
      oldValue: requestData.assignedStaffName || null,
      newValue: newStaffData?.fullName || null,
    };

    transaction.update(requestRef, {
      assignedStaffId: staffId || null,
      assignedStaffName: newStaffData?.fullName || null,
      status: staffId ? 'Assigned' : 'Submitted',
      assignmentHistory: FieldValue.arrayUnion(historyEntry),
      timeline: FieldValue.arrayUnion(activity),
      updatedAt: FieldValue.serverTimestamp(),
    });

    if (prevStaffId && prevStaffId !== staffId) {
      const prevStaffRef = db.collection('users').doc(prevStaffId);
      transaction.update(prevStaffRef, {
        activeComplaintCount: FieldValue.increment(-1),
        updatedAt: FieldValue.serverTimestamp(),
      });
    }

    if (newStaffRef && prevStaffId !== staffId) {
      transaction.update(newStaffRef, {
        activeComplaintCount: FieldValue.increment(1),
        updatedAt: FieldValue.serverTimestamp(),
      });
    }

    return {
      success: true,
      complaintId,
      assignedStaffId: staffId || null,
      assignedStaffName: newStaffData?.fullName || null,
    };
  });
});
