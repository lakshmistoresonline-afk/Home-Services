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
exports.assignComplaint = void 0;
const functions = __importStar(require("firebase-functions"));
const admin = __importStar(require("firebase-admin"));
exports.assignComplaint = functions.https.onCall(async (data, context) => {
    if (!context.auth) {
        throw new functions.https.HttpsError('unauthenticated', 'User must be authenticated.');
    }
    const actorUid = context.auth.uid;
    const db = admin.firestore();
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
    // Execute assignment inside an atomic Firestore transaction
    return db.runTransaction(async (transaction) => {
        const requestSnap = await transaction.get(requestRef);
        if (!requestSnap.exists) {
            throw new functions.https.HttpsError('not-found', 'Service request not found.');
        }
        const requestData = requestSnap.data();
        const prevStaffId = requestData.assignedStaffId || null;
        let newStaffData = null;
        let newStaffRef = null;
        if (staffId) {
            newStaffRef = db.collection('users').doc(staffId);
            const newStaffSnap = await transaction.get(newStaffRef);
            if (!newStaffSnap.exists) {
                throw new functions.https.HttpsError('not-found', 'Target staff member not found.');
            }
            newStaffData = newStaffSnap.data();
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
        // Transaction updates
        transaction.update(requestRef, {
            assignedStaffId: staffId || null,
            assignedStaffName: newStaffData?.fullName || null,
            status: staffId ? 'Assigned' : 'Submitted',
            assignmentHistory: admin.firestore.FieldValue.arrayUnion(historyEntry),
            timeline: admin.firestore.FieldValue.arrayUnion(activity),
            updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        });
        // Update workload counters atomically
        if (prevStaffId && prevStaffId !== staffId) {
            const prevStaffRef = db.collection('users').doc(prevStaffId);
            transaction.update(prevStaffRef, {
                activeComplaintCount: admin.firestore.FieldValue.increment(-1),
                updatedAt: admin.firestore.FieldValue.serverTimestamp(),
            });
        }
        if (newStaffRef && prevStaffId !== staffId) {
            transaction.update(newStaffRef, {
                activeComplaintCount: admin.firestore.FieldValue.increment(1),
                updatedAt: admin.firestore.FieldValue.serverTimestamp(),
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
//# sourceMappingURL=assignment.js.map