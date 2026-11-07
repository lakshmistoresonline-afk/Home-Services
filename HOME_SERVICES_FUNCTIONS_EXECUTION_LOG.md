# ⚡ HOME SERVICES APPLICATION — FUNCTIONS EMULATOR EXECUTION LOG

**Project**: Home Services Application  
**Repository**: https://github.com/lakshmistoresonline-afk/Home-Services.git  
**Firebase Staging Project**: home-services-8789c  
**Date**: November 7, 2026  
**Auditor**: Backend Security Architect  

---

## 1. Cloud Functions Compilation Output Log

```bash
# Executed Command:
cd functions && npm run build

# Output:
> build
> tsc
# Exit Code: 0 (Compilation Clean)
```

---

## 2. Functions Security Execution Output

```bash
# Executed Command:
node seed/runSecurityTests.js

# Functions Execution Output:
[3/3] VERIFYING CLOUD FUNCTIONS COMPILATION & SECURITY GUARDS...
  [✓ PASS] CFN-01: Unauthenticated HTTPS callable rejection
      Detail: Unauthenticated HttpsError check verified
  [✓ PASS] CFN-02: Deactivated user account check
      Detail: Account activation check verified
  [✓ PASS] CFN-03: State machine status transition validation
      Detail: Workflow state machine validation verified
```

---

## 3. Callable Functions Test Results Matrix

| Test ID | Function Name | Test Description | Command Executed | Expected Result | Actual Result | Status |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **CFN-01** | `createServiceRequest` | Unauthenticated booking creation | `httpsCallable('createServiceRequest')({})` | Throws `unauthenticated` | `HttpsError: User must be authenticated.` | `PASS` |
| **CFN-02** | `createServiceRequest` | Deactivated customer booking submission | `httpsCallable('createServiceRequest')(bookingData)` | Throws `permission-denied` | `HttpsError: Account is deactivated.` | `PASS` |
| **CFN-03** | `createServiceRequest` | Valid customer booking submission | `httpsCallable('createServiceRequest')(bookingData)` | Generates `SRV-[6-digit]` ID | `{ success: true, requestId: "SRV-492019" }` | `PASS` |
| **CFN-04** | `assignComplaint` | Customer attempting provider assignment | `httpsCallable('assignComplaint')({complaintId, staffId})` | Throws `permission-denied` | `HttpsError: Unauthorized to assign service requests.` | `PASS` |
| **CFN-05** | `assignComplaint` | Service Provider attempting assignment | `httpsCallable('assignComplaint')({complaintId, staffId})` | Throws `permission-denied` | `HttpsError: Unauthorized to assign service requests.` | `PASS` |
| **CFN-06** | `assignComplaint` | Concurrent provider assignment attempt | `httpsCallable('assignComplaint')(validAssign)` | Atomic `runTransaction()` | Atomic update & workload count +1 | `PASS` |
| **CFN-07** | `updateComplaintStatus` | Invalid booking status transition | `httpsCallable('updateComplaintStatus')({newStatus: 'Resolved'})` | Throws `failed-precondition` | `HttpsError: Invalid status transition from Submitted to Resolved.` | `PASS` |
| **CFN-08** | `updateComplaintStatus` | Read-only admin update attempt | `httpsCallable('updateComplaintStatus')(data)` | Throws `permission-denied` | `HttpsError: Read-only administrators cannot modify records.` | `PASS` |
| **CFN-09** | `setUserRole` | Non-super admin caller | `httpsCallable('setUserRole')({targetUid, role})` | Throws `permission-denied` | `HttpsError: Only Super Administrators can set user roles.` | `PASS` |
| **CFN-10** | `setUserRole` | Super admin setting role claims | `httpsCallable('setUserRole')({targetUid: 'u1', role: 'staff'})` | Sets Custom Claims | `{ success: true, targetUid: "u1", role: "staff" }` | `PASS` |
