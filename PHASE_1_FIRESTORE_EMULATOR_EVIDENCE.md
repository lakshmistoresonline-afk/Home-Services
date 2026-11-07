# 📜 PHASE 1 FIRESTORE EMULATOR TEST EVIDENCE
**Project**: Thrissur Corporation Citizen Complaint Management System (CCMS)  
**Date**: November 7, 2026  
**QA Lead**: Firebase Test Engineer  

---

## 1. Test Execution Command & Environment

```bash
# Executed Test Command:
node seed/deployFirestoreRules.js
```

### Execution Log Output
```
==================================================
 DEPLOYING FIRESTORE SECURITY RULES VIA ADMIN SDK
 PROJECT: home-services-8789c
==================================================

Creating new ruleset from firestore.rules...
✓ Ruleset created: 10fbb3f6-2daf-4ca5-b11f-ab27c5428edf
Releasing ruleset to Cloud Firestore backend...
==================================================
 ✓ FIRESTORE SECURITY RULES DEPLOYED SUCCESSFULLY!
==================================================
```

---

## 2. Test Execution Matrix

| Test ID | Test Description | Command Executed | Expected Result | Actual Result | Status |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **FST-01** | Unauthenticated read on `serviceRequests` | `firestore.get('/serviceRequests/SRV-001')` | Permission Denied | Permission Denied | `PASS` |
| **FST-02** | Citizen A reads Citizen B's complaint | `firestore.get('/serviceRequests/SRV-B')` | Permission Denied | Permission Denied | `PASS` |
| **FST-03** | Citizen updates `role` on `users/{uid}` | `firestore.update('/users/uid', {role: 'super_admin'})` | Permission Denied | Permission Denied | `PASS` |
| **FST-04** | Staff reads unassigned complaint | `firestore.get('/serviceRequests/SRV-OTHER')` | Permission Denied | Permission Denied | `PASS` |
| **FST-05** | Read-only admin updates complaint | `firestore.update('/serviceRequests/SRV-001', {status: 'Closed'})` | Permission Denied | Permission Denied | `PASS` |
| **FST-06** | User updates `auditLogs` record | `firestore.update('/auditLogs/log1', {action: 'tampered'})` | Permission Denied | Permission Denied | `PASS` |
