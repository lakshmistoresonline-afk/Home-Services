import * as functions from 'firebase-functions';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';
import { getAuth } from 'firebase-admin/auth';

export const setUserRole = functions.https.onCall(async (data: any, context: functions.https.CallableContext) => {
  if (!context.auth) {
    throw new functions.https.HttpsError('unauthenticated', 'User must be authenticated.');
  }

  const callerUid = context.auth.uid;
  const db = getFirestore();

  const callerDoc = await db.collection('users').doc(callerUid).get();
  const callerData = callerDoc.data() || {};

  if (callerData.role !== 'super_admin') {
    throw new functions.https.HttpsError('permission-denied', 'Only Super Administrators can set user roles.');
  }

  const { targetUid, role, taluk } = data;
  if (!targetUid || !role) {
    throw new functions.https.HttpsError('invalid-argument', 'Target UID and role are required.');
  }

  const targetRef = db.collection('users').doc(targetUid);
  const targetSnap = await targetRef.get();
  if (!targetSnap.exists) {
    throw new functions.https.HttpsError('not-found', 'Target user profile not found.');
  }

  // Issue Firebase Auth Custom Claims
  await getAuth().setCustomUserClaims(targetUid, {
    role,
    taluk: taluk || targetSnap.data()?.taluk || null,
  });

  // Update Firestore user document
  await targetRef.update({
    role,
    taluk: taluk || targetSnap.data()?.taluk || null,
    updatedAt: FieldValue.serverTimestamp(),
  });

  return { success: true, targetUid, role };
});
