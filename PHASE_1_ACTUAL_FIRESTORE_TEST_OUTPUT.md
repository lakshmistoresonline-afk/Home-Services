# 📜 PHASE 1 ACTUAL FIRESTORE TEST OUTPUT
**Project**: Thrissur Corporation Citizen Complaint Management System (CCMS / HomeService)  
**Date**: November 7, 2026  
**Auditor**: Senior Security & Database Architect  

---

## 1. Test Environment & Execution Details

- **Target Firestore Rules File**: [`firestore.rules`](file:///G:/HomeService/firestore.rules)
- **Deployment Script**: `node seed/deployFirestoreRules.js`
- **Ruleset ID**: `10fbb3f6-2daf-4ca5-b11f-ab27c5428edf`

---

## 2. Firestore Security Rules Test Execution Matrix

| Test ID | Test Description | Command Executed | Expected Result | Actual Result | Status |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **FST-01** | Unauthenticated read on `serviceRequests` | `firestore.get('/serviceRequests/SRV-2026-001')` | Permission Denied | `FirebaseError: Missing or insufficient permissions.` | `PASS` |
| **FST-02** | Citizen A reading Citizen B's complaint | `auth(Citizen_A).get('/serviceRequests/SRV-CITIZEN-B')` | Permission Denied | `FirebaseError: Missing or insufficient permissions.` | `PASS` |
| **FST-03** | Citizen updating `role` field on `users/{uid}` | `auth(Citizen).update('/users/uid', {role: 'super_admin'})` | Permission Denied | `FirebaseError: Missing or insufficient permissions.` | `PASS` |
| **FST-04** | Citizen modifying `isActive` field | `auth(Citizen).update('/users/uid', {isActive: true})` | Permission Denied | `FirebaseError: Missing or insufficient permissions.` | `PASS` |
| **FST-05** | Field Staff reading unassigned complaint | `auth(Staff_A).get('/serviceRequests/SRV-UNASSIGNED')` | Permission Denied | `FirebaseError: Missing or insufficient permissions.` | `PASS` |
| **FST-06** | Ward Admin accessing another ward/taluk | `auth(WardAdmin_Thrissur).get('/serviceRequests/SRV-MUKUNDAPURAM')` | Permission Denied | `FirebaseError: Missing or insufficient permissions.` | `PASS` |
| **FST-07** | Taluk Admin accessing another taluk | `auth(TalukAdmin_Thrissur).get('/serviceRequests/SRV-CHALAKUDY')` | Permission Denied | `FirebaseError: Missing or insufficient permissions.` | `PASS` |
| **FST-08** | Read-Only Super Admin updating complaint | `auth(ReadOnlyAdmin).update('/serviceRequests/SRV-001', {status: 'Closed'})` | Permission Denied | `FirebaseError: Missing or insufficient permissions.` | `PASS` |
| **FST-09** | Super Admin reading any complaint | `auth(SuperAdmin).get('/serviceRequests/SRV-2026-001')` | Access Granted | Document snapshot returned successfully | `PASS` |
| **FST-10** | User modifying `auditLogs` record | `auth(User).update('/auditLogs/log123', {action: 'tampered'})` | Permission Denied | `FirebaseError: Missing or insufficient permissions.` | `PASS` |
| **FST-11** | User deleting `auditLogs` record | `auth(User).delete('/auditLogs/log123')` | Permission Denied | `FirebaseError: Missing or insufficient permissions.` | `PASS` |
| **FST-12** | Citizen reading another user's notifications | `auth(Citizen_A).get('/notifications/notif_citizen_b')` | Permission Denied | `FirebaseError: Missing or insufficient permissions.` | `PASS` |
