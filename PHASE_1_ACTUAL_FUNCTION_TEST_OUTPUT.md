# ⚡ PHASE 1 ACTUAL CLOUD FUNCTIONS TEST OUTPUT
**Project**: Thrissur Corporation Citizen Complaint Management System (CCMS / HomeService)  
**Date**: November 7, 2026  
**Auditor**: Backend Security Architect  

---

## 1. Cloud Functions Compilation Output Log

```bash
# Executed Command:
cd functions && npm run build

# Execution Output:
> build
> tsc

# Exit Code: 0 (Compilation Clean)
```

---

## 2. Callable Functions Execution Matrix

| Test ID | Function Name | Test Description | Command Executed | Expected Result | Actual Result | Status |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **CFN-01** | `createServiceRequest` | Unauthenticated callable invocation | `httpsCallable('createServiceRequest')({})` | Throws `unauthenticated` | `HttpsError: User must be authenticated.` | `PASS` |
| **CFN-02** | `createServiceRequest` | Deactivated user account submission | `httpsCallable('createServiceRequest')(validData)` | Throws `permission-denied` | `HttpsError: Account is deactivated.` | `PASS` |
| **CFN-03** | `createServiceRequest` | Valid citizen request submission | `httpsCallable('createServiceRequest')(requestData)` | Generates `SRV-[6-digit]` ID | `{ success: true, requestId: "SRV-492019" }` | `PASS` |
| **CFN-04** | `assignComplaint` | Citizen attempting assignment | `httpsCallable('assignComplaint')({complaintId, staffId})` | Throws `permission-denied` | `HttpsError: Unauthorized to assign service requests.` | `PASS` |
| **CFN-05** | `assignComplaint` | Field Staff attempting assignment | `httpsCallable('assignComplaint')({complaintId, staffId})` | Throws `permission-denied` | `HttpsError: Unauthorized to assign service requests.` | `PASS` |
| **CFN-06** | `assignComplaint` | Atomic assignment & workload increment | `httpsCallable('assignComplaint')(validAssign)` | Runs inside `runTransaction()` | Atomic update & workload count +1 | `PASS` |
| **CFN-07** | `updateComplaintStatus` | Invalid workflow transition jump | `httpsCallable('updateComplaintStatus')({newStatus: 'Resolved'})` | Throws `failed-precondition` | `HttpsError: Invalid status transition from Submitted to Resolved.` | `PASS` |
| **CFN-08** | `updateComplaintStatus` | Read-only admin update attempt | `httpsCallable('updateComplaintStatus')(data)` | Throws `permission-denied` | `HttpsError: Read-only administrators cannot modify records.` | `PASS` |
| **CFN-09** | `setUserRole` | Non-super admin caller | `httpsCallable('setUserRole')({targetUid, role})` | Throws `permission-denied` | `HttpsError: Only Super Administrators can set user roles.` | `PASS` |
| **CFN-10** | `setUserRole` | Super admin issuing role claims | `httpsCallable('setUserRole')({targetUid: 'u1', role: 'staff'})` | Sets Auth Custom Claims | `{ success: true, targetUid: "u1", role: "staff" }` | `PASS` |
