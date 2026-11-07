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
exports.setUserRole = void 0;
const functions = __importStar(require("firebase-functions"));
const admin = __importStar(require("firebase-admin"));
exports.setUserRole = functions.https.onCall(async (data, context) => {
    if (!context.auth) {
        throw new functions.https.HttpsError('unauthenticated', 'User must be authenticated.');
    }
    const callerUid = context.auth.uid;
    const db = admin.firestore();
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
    await admin.auth().setCustomUserClaims(targetUid, {
        role,
        taluk: taluk || targetSnap.data()?.taluk || null,
    });
    // Update Firestore user document
    await targetRef.update({
        role,
        taluk: taluk || targetSnap.data()?.taluk || null,
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });
    return { success: true, targetUid, role };
});
//# sourceMappingURL=roles.js.map