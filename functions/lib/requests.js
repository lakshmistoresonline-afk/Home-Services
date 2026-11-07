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
    const { title, description, category } = data;
    if (!title || !description || !category) {
        throw new functions.https.HttpsError('invalid-argument', 'Title, description, and category are required.');
    }
    const requestId = `SRV-${Math.floor(100000 + Math.random() * 900000)}`;
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
        createdAt: firestore_1.FieldValue.serverTimestamp(),
        updatedAt: firestore_1.FieldValue.serverTimestamp(),
    };
    await db.collection('serviceRequests').doc(requestId).set(docData);
    return { success: true, requestId, serviceRequest: docData };
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
    const actorData = actorDoc.data() || {};
    const role = actorData.role || 'citizen';
    if (role === 'readonly_super_admin') {
        throw new functions.https.HttpsError('permission-denied', 'Read-only administrators cannot modify records.');
    }
    // Validate workflow transition unless super_admin
    if (role !== 'super_admin' && !(0, workflowRules_1.isValidTransition)(currentStatus, newStatus)) {
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