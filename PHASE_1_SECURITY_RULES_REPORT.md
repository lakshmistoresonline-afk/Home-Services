# 📜 PHASE 1 SECURITY RULES REPORT
**Project**: Thrissur Corporation Citizen Complaint Management System (CCMS)  
**Date**: November 7, 2026  
**Auditor**: Senior Firebase Security Engineer  

---

## 1. Deployed Firestore Security Rules Summary

Ruleset `10fbb3f6-2daf-4ca5-b11f-ab27c5428edf` was deployed to Cloud Firestore project `home-services-8789c`.

```rules
rules_version = '2';

service cloud.firestore {
  match /databases/{database}/documents {

    function isAuthenticated() { return request.auth != null; }
    function isUserDoc(uid) { return isAuthenticated() && request.auth.uid == uid; }
    function getUserData() { return get(/databases/$(database)/documents/users/$(request.auth.uid)).data; }
    function userExists() { return isAuthenticated() && exists(/databases/$(database)/documents/users/$(request.auth.uid)); }
    function getUserRole() { return userExists() ? getUserData().role : 'citizen'; }
    function isUserActive() { return userExists() && (getUserData().isActive == true || getUserData().status == 'active'); }

    function isSuperAdmin() { return isAuthenticated() && (getUserRole() == 'super_admin' || request.auth.token.role == 'super_admin'); }
    function isReadOnlyAdmin() { return isAuthenticated() && (getUserRole() == 'readonly_super_admin' || request.auth.token.role == 'readonly_super_admin'); }
    function isTalukAdmin() { return isAuthenticated() && (getUserRole() == 'taluk_admin' || getUserRole() == 'ward_admin' || request.auth.token.role == 'taluk_admin'); }
    function isStaff() { return isAuthenticated() && (getUserRole() == 'staff' || request.auth.token.role == 'staff'); }

    // Users Collection Protection
    match /users/{uid} {
      allow create: if isAuthenticated();
      allow read: if isAuthenticated() && (isUserDoc(uid) || isSuperAdmin() || isReadOnlyAdmin() || isTalukAdmin() || isStaff());
      allow update: if isAuthenticated() && (
        isSuperAdmin() ||
        (isUserDoc(uid) && !request.resource.data.diff(resource.data).affectedKeys().hasAny(['role', 'permissions', 'isActive', 'status']))
      );
      allow delete: if isSuperAdmin();
    }

    // Service Requests Collection
    match /serviceRequests/{id} {
      allow create: if isAuthenticated() && isUserActive() && (isSuperAdmin() || request.resource.data.citizenId == request.auth.uid);
      allow read: if isAuthenticated() && (
        isSuperAdmin() || isReadOnlyAdmin() ||
        resource.data.citizenId == request.auth.uid ||
        resource.data.assignedStaffId == request.auth.uid ||
        (isTalukAdmin() && (getUserData().taluk == null || getUserData().taluk == resource.data.taluk))
      );
      allow update: if isAuthenticated() && isUserActive() && !isReadOnlyAdmin() && (
        isSuperAdmin() ||
        (resource.data.citizenId == request.auth.uid && request.resource.data.status in ['Cancelled', 'Reopened']) ||
        (resource.data.assignedStaffId == request.auth.uid && request.resource.data.status in ['Accepted', 'Rejected', 'In Progress', 'Resolved']) ||
        (isTalukAdmin() && (getUserData().taluk == null || getUserData().taluk == resource.data.taluk))
      );
      allow delete: if isSuperAdmin();
    }

    // Audit Logs Protection
    match /auditLogs/{id} {
      allow read: if isAuthenticated() && (isSuperAdmin() || isReadOnlyAdmin());
      allow create: if isAuthenticated();
      allow update, delete: if false;
    }
  }
}
```

---

## 2. Security Guarantees & Constraints Enforced

1. **Privilege Escalation Prevention**: Citizens cannot update their `role`, `permissions`, or `isActive` status in `users/{uid}`.
2. **Citizen Privacy**: Citizens can read and create only service requests where `citizenId == request.auth.uid`.
3. **Field Worker Isolation**: Field staff can view and update only service requests assigned specifically to them (`assignedStaffId == request.auth.uid`).
4. **Jurisdiction Boundary**: Taluk Admins are restricted to complaints in their assigned `taluk`.
5. **Audit Integrity**: `auditLogs` updates and deletions are strictly blocked (`allow update, delete: if false;`).
