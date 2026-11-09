"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.updateComplaintStatus = exports.createServiceRequest = void 0;
const functions = __importStar(require("firebase-functions"));
const firestore_1 = require("firebase-admin/firestore");
const workflowRules_1 = require("./workflowRules");
exports.createServiceRequest = functions.https.onCall(async (data, context) => {
    if (!context.auth) {
        throw new functions.https.HttpsError('unauthenticated', 'User must be authenticated.');
    }
    const uid = context.auth.uid;
    const db = (0, firestore_1.getFirestore)();
    const userDoc = await db.collection('users').doc(uid).get();
    if (!userDoc.exists) {
        throw new functions.https.HttpsError('not-found', 'User profile not found.');
    }
    const userData = userDoc.data();
    if (userData.isActive === false || userData.status === 'deactivated') {
        throw new functions.https.HttpsError('permission-denied', 'Account is deactivated.');
    }
    if (userData.role === 'readonly_super_admin') {
        throw new functions.https.HttpsError('permission-denied', 'Read-only administrators cannot create service requests.');
    }
    const { title, description, category } = data;
    if (!title || !description || !category) {
        throw new functions.https.HttpsError('invalid-argument', 'Title, description, and category are required.');
    }
    if (typeof title !== 'string' || title.trim().length === 0 || title.trim().length > 200) {
        throw new functions.https.HttpsError('invalid-argument', 'Title must be a string between 1 and 200 characters.');
    }
    if (typeof description !== 'string' || description.trim().length === 0 || description.trim().length > 2000) {
        throw new functions.https.HttpsError('invalid-argument', 'Description must be a string between 1 and 2000 characters.');
    }
    const nowIso = new Date().toISOString();
    let createdDocData = null;
    let attempts = 0;
    let createdSuccessfully = false;
    // Collision-safe document creation using atomic .create()
    while (attempts < 5 && !createdSuccessfully) {
        const requestId = `SRV-${Math.floor(100000 + Math.random() * 900000)}`;
        const docRef = db.collection('serviceRequests').doc(requestId);
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
            createdAt: firestore_1.FieldValue.serverTimestamp(),
            updatedAt: firestore_1.FieldValue.serverTimestamp(),
        };
        try {
            await docRef.create(docData);
            createdDocData = docData;
            createdSuccessfully = true;
        }
        catch (err) {
            if (err.code === 6 || err.code === 'already-exists' || err.message?.includes('ALREADY_EXISTS')) {
                attempts++;
            }
            else {
                throw err;
            }
        }
    }
    if (!createdSuccessfully || !createdDocData) {
        throw new functions.https.HttpsError('already-exists', 'Failed to generate a unique Service Request ID after 5 attempts. Please retry.');
    }
    return { success: true, requestId: createdDocData.complaint_id, serviceRequest: createdDocData };
});
exports.updateComplaintStatus = functions.https.onCall(async (data, context) => {
    if (!context.auth) {
        throw new functions.https.HttpsError('unauthenticated', 'User must be authenticated.');
    }
    const uid = context.auth.uid;
    const db = (0, firestore_1.getFirestore)();
    const { complaintId, newStatus, remarks, price, paymentMethod, paymentStatus } = data;
    if (!complaintId || !newStatus) {
        throw new functions.https.HttpsError('invalid-argument', 'Complaint ID and new status are required.');
    }
    const requestRef = db.collection('serviceRequests').doc(complaintId);
    const requestSnap = await requestRef.get();
    if (!requestSnap.exists) {
        throw new functions.https.HttpsError('not-found', 'Service request not found.');
    }
    const requestData = requestSnap.data();
    const currentStatus = requestData.status;
    const actorDoc = await db.collection('users').doc(uid).get();
    if (!actorDoc.exists) {
        throw new functions.https.HttpsError('not-found', 'Caller user profile not found.');
    }
    const actorData = actorDoc.data();
    const role = actorData.role || 'citizen';
    if (actorData.isActive === false || actorData.status === 'deactivated') {
        throw new functions.https.HttpsError('permission-denied', 'Account is deactivated.');
    }
    if (role === 'readonly_super_admin') {
        throw new functions.https.HttpsError('permission-denied', 'Read-only administrators cannot modify records.');
    }
    // Request-Level Authorization Checks
    const isSuper = role === 'super_admin';
    const isOwnerCitizen = requestData.citizenId === uid;
    const isAssignedProvider = requestData.assignedStaffId === uid;
    const isTalukAdminInJurisdiction = (role === 'taluk_admin' || role === 'ward_admin') &&
        (!actorData.taluk || !requestData.taluk || actorData.taluk.trim().toLowerCase() === requestData.taluk.trim().toLowerCase());
    if (!isSuper) {
        if (isOwnerCitizen) {
            if (!['Cancelled', 'Reopened'].includes(newStatus)) {
                throw new functions.https.HttpsError('permission-denied', 'Customers can only cancel or reopen their own requests.');
            }
        }
        else if (isAssignedProvider) {
            if (!['Accepted', 'Rejected', 'In Progress', 'Resolved'].includes(newStatus)) {
                throw new functions.https.HttpsError('permission-denied', 'Service providers can only update status to Accepted, Rejected, In Progress, or Resolved.');
            }
        }
        else if (isTalukAdminInJurisdiction) {
            // Authorized Taluk Admin
        }
        else {
            throw new functions.https.HttpsError('permission-denied', 'Unauthorized to update this service request.');
        }
    }
    // Validate workflow state machine transition unless super_admin
    if (!isSuper && !(0, workflowRules_1.isValidTransition)(currentStatus, newStatus)) {
        throw new functions.https.HttpsError('failed-precondition', `Invalid status transition from ${currentStatus} to ${newStatus}.`);
    }
    // Payment & Price Authorization & Validation
    if (price !== undefined && price !== null) {
        if (isOwnerCitizen && !isSuper && !isAssignedProvider) {
            throw new functions.https.HttpsError('permission-denied', 'Customers cannot set or modify service charges.');
        }
        const numPrice = Number(price);
        if (typeof numPrice !== 'number' || isNaN(numPrice) || !Number.isFinite(numPrice) || numPrice < 0) {
            throw new functions.https.HttpsError('invalid-argument', 'Price must be a valid non-negative finite number.');
        }
    }
    if (paymentMethod && !['UPI_QR', 'Cash'].includes(paymentMethod)) {
        throw new functions.https.HttpsError('invalid-argument', 'Invalid payment method specified.');
    }
    if (paymentStatus === 'Paid' && isOwnerCitizen && !isSuper && !isAssignedProvider) {
        throw new functions.https.HttpsError('permission-denied', 'Customers cannot verify or confirm payment status.');
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
    const updateData = {
        status: newStatus,
        remarks: remarks || requestData.remarks || null,
        timeline: firestore_1.FieldValue.arrayUnion(activity),
        updatedAt: firestore_1.FieldValue.serverTimestamp(),
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
//# sourceMappingURL=requests.js.map