import * as functions from 'firebase-functions';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';
import { isValidTransition } from './workflowRules';

export const createServiceRequest = functions.https.onCall(async (data: any, context: functions.https.CallableContext) => {
  if (!context.auth) {
    throw new functions.https.HttpsError('unauthenticated', 'User must be authenticated.');
  }

  const uid = context.auth.uid;
  const db = getFirestore();

  const userDoc = await db.collection('users').doc(uid).get();
  if (!userDoc.exists) {
    throw new functions.https.HttpsError('not-found', 'User profile not found.');
  }

  const userData = userDoc.data()!;
  if (userData.isActive === false || userData.status === 'deactivated') {
    throw new functions.https.HttpsError('permission-denied', 'Account is deactivated.');
  }

  const { title, description, category } = data;
  if (!title || !description || !category) {
    throw new functions.https.HttpsError('invalid-argument', 'Title, description, and category are required.');
  }

  let requestId = `SRV-${Math.floor(100000 + Math.random() * 900000)}`;
  let attempts = 0;

  // Collision-safe document ID generation
  while (attempts < 5) {
    const existingSnap = await db.collection('serviceRequests').doc(requestId).get();
    if (!existingSnap.exists) break;
    requestId = `SRV-${Math.floor(100000 + Math.random() * 900000)}`;
    attempts++;
  }

  const nowIso = new Date().toISOString();

  const docData = {
    complaint_id: requestId,
    request_id: requestId,
    citizenId: uid,
    citizenName: userData.fullName || context.auth.token.email || 'Customer',
    district: userData.district || 'Thrissur',
    taluk: userData.taluk || 'Thrissur',
    departmentId: data.departmentId || 'general',
    departmentName: data.departmentName || 'General',
    categoryId: data.categoryId || 'gen_inq',
    categoryName: category,
    title: title.trim(),
    description: description.trim(),
    status: 'Submitted',
    photos: data.photos || [],
    attachments: data.attachments || [],
    assignedStaffId: null,
    assignedStaffName: null,
    assignedDepartment: null,
    assignedAt: null,
    assignedBy: null,
    assignedByName: null,
    assignmentHistory: [],
    remarks: null,
    resolvedAt: null,
    comments: [],
    timeline: [
      {
        id: `init-${Date.now()}`,
        type: 'REQUEST_CREATED',
        title: 'Service Request Submitted',
        description: 'Service request registered and awaiting provider assignment.',
        performedBy: uid,
        performedByName: userData.fullName || 'Customer',
        performedByRole: userData.role || 'citizen',
        timestamp: nowIso,
        attachments: data.attachments || [],
      }
    ],
    createdAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp(),
  };

  await db.collection('serviceRequests').doc(requestId).set(docData);

  return { success: true, requestId, serviceRequest: docData };
});

export const updateComplaintStatus = functions.https.onCall(async (data: any, context: functions.https.CallableContext) => {
  if (!context.auth) {
    throw new functions.https.HttpsError('unauthenticated', 'User must be authenticated.');
  }

  const uid = context.auth.uid;
  const db = getFirestore();

  const { complaintId, newStatus, remarks, price, paymentMethod, paymentStatus } = data;
  if (!complaintId || !newStatus) {
    throw new functions.https.HttpsError('invalid-argument', 'Complaint ID and new status are required.');
  }

  const requestRef = db.collection('serviceRequests').doc(complaintId);
  const requestSnap = await requestRef.get();

  if (!requestSnap.exists) {
    throw new functions.https.HttpsError('not-found', 'Service request not found.');
  }

  const requestData = requestSnap.data()!;
  const currentStatus = requestData.status;

  const actorDoc = await db.collection('users').doc(uid).get();
  const actorData = actorDoc.data() || {};
  const role = actorData.role || 'citizen';

  if (role === 'readonly_super_admin') {
    throw new functions.https.HttpsError('permission-denied', 'Read-only administrators cannot modify records.');
  }

  // Validate workflow transition unless super_admin
  if (role !== 'super_admin' && !isValidTransition(currentStatus, newStatus)) {
    throw new functions.https.HttpsError('failed-precondition', `Invalid status transition from ${currentStatus} to ${newStatus}.`);
  }

  const nowIso = new Date().toISOString();
  const activity = {
    id: `status-${Date.now()}`,
    type: 'PROGRESS_UPDATED',
    title: `Status updated to ${newStatus}${paymentMethod ? ` (${paymentMethod} Payment)` : ''}`,
    description: remarks || null,
    performedBy: uid,
    performedByName: actorData.fullName || 'User',
    performedByRole: role,
    timestamp: nowIso,
    oldValue: currentStatus,
    newValue: newStatus,
  };

  const updateData: any = {
    status: newStatus,
    remarks: remarks || requestData.remarks || null,
    timeline: FieldValue.arrayUnion(activity),
    updatedAt: FieldValue.serverTimestamp(),
  };

  if (price !== undefined && price !== null) {
    updateData.price = Number(price);
  }
  if (paymentMethod) {
    updateData.paymentMethod = paymentMethod;
  }
  if (paymentStatus) {
    updateData.paymentStatus = paymentStatus;
  }
  if (newStatus === 'Resolved' || newStatus === 'Completed') {
    updateData.resolvedAt = nowIso;
  }

  await requestRef.update(updateData);

  return { success: true, complaintId, newStatus };
});
