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
exports.scheduledAutoClose = exports.scheduledAutoAssign = void 0;
const functions = __importStar(require("firebase-functions"));
const firestore_1 = require("firebase-admin/firestore");
exports.scheduledAutoAssign = functions.pubsub
    .schedule('every 30 minutes')
    .onRun(async () => {
    const db = (0, firestore_1.getFirestore)();
    const threeHoursAgo = new Date(Date.now() - 3 * 60 * 60 * 1000);
    const pendingSnap = await db
        .collection('serviceRequests')
        .where('status', '==', 'Submitted')
        .where('createdAt', '<=', firestore_1.Timestamp.fromDate(threeHoursAgo))
        .limit(20)
        .get();
    if (pendingSnap.empty) {
        console.log('No pending unassigned complaints found for escalation.');
        return null;
    }
    console.log(`Processing ${pendingSnap.size} delayed complaints for auto-assignment...`);
    return null;
});
exports.scheduledAutoClose = functions.pubsub
    .schedule('every 24 hours')
    .onRun(async () => {
    const db = (0, firestore_1.getFirestore)();
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
            timeline: firestore_1.FieldValue.arrayUnion(activity),
            updatedAt: firestore_1.FieldValue.serverTimestamp(),
        });
        if (data.assignedStaffId) {
            await db.collection('users').doc(data.assignedStaffId).update({
                activeComplaintCount: firestore_1.FieldValue.increment(-1),
                completedComplaintCount: firestore_1.FieldValue.increment(1),
                updatedAt: firestore_1.FieldValue.serverTimestamp(),
            });
        }
    }
    return null;
});
//# sourceMappingURL=maintenance.js.map