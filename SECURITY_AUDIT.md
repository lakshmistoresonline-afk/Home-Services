# 🔒 SECURITY AUDIT REPORT
**Project**: Thrissur Corporation Citizen Complaint Management System (CCMS)  
**Date**: November 7, 2026  
**Auditor**: Senior Firebase Security Engineer  

---

## 1. Security Overview & Severity Summary

| Vulnerability / Defect | Severity | Affected Area | Impact |
| :--- | :--- | :--- | :--- |
| **Wildcard Unrestricted Rules** | `CRITICAL` | `firestore.rules` | Anyone can read, modify, or delete any record without authentication |
| **Client-Side Role Authorization** | `HIGH` | `src/context/auth.tsx` | Users can tamper with local Firestore profile roles in memory |
| **Missing Custom Claims** | `HIGH` | Firebase Auth | Privileged admin operations rely on client-queried Firestore documents |
| **Email-Domain Role Fallback** | `MEDIUM` | `src/context/auth.tsx` | `.gov.in` email substring checks used as an offline role fallback |
| **Unprotected Secondary Auth** | `MEDIUM` | `src/api/staffApi.ts` | Staff account creation uses client-side secondary auth initialization |

---

## 2. Detailed Findings

### Defect 2.1: Wildcard Public Firestore Rules (`CRITICAL`)
**Location**: [`firestore.rules`](file:///G:/HomeService/firestore.rules#L1-L8)
```rules
rules_version = '2';

service cloud.firestore {
  match /databases/{database}/documents {
    match /{document=**} {
      allow read, write: if true;
    }
  }
}
```
**Evidence**: The current live security rules allow **unauthenticated public read and write access to all documents** in the Cloud Firestore database. Anyone with the Firebase API key can manipulate citizen data, staff records, and audit logs.

---

### Defect 2.2: Reliance on Un-verified Client Roles (`HIGH`)
**Location**: [`src/context/auth.tsx`](file:///G:/HomeService/src/context/auth.tsx#L55-L75)
```typescript
const isEmployee = fbUser.email?.endsWith('.gov.in');
const role = isEmployee
  ? (fbUser.email?.includes('superadmin') ? 'super_admin' : 'taluk_admin')
  : 'citizen';
```
**Evidence**: Client-side role evaluation checks `fbUser.email?.endsWith('.gov.in')` and `.includes('superadmin')`. Users can create or modify accounts matching this pattern to escalate privileges locally.

---

### Defect 2.3: Absence of Firebase Custom Claims (`HIGH`)
**Location**: [`src/api/staffApi.ts`](file:///G:/HomeService/src/api/staffApi.ts), [`src/context/auth.tsx`](file:///G:/HomeService/src/context/auth.tsx)
- Administrative roles (`super_admin`, `taluk_admin`, `staff`) are stored only in Firestore document fields (`users/{uid}.role`) rather than in cryptographically signed **Firebase Auth Custom Claims**.

---

### Defect 2.4: Secondary Auth Client Instance Creation (`MEDIUM`)
**Location**: [`src/api/staffApi.ts`](file:///G:/HomeService/src/api/staffApi.ts#L48-L52)
```typescript
const authInstance = getSecondaryAuth();
const cred = await createUserWithEmailAndPassword(authInstance, data.email, data.password);
```
**Evidence**: Staff creation initializes a secondary Firebase Auth instance directly on the client web browser. This exposes user creation to client-side interceptors and bypasses backend rate limits.

---

## 3. Required Remediation Measures

1. Replace `firestore.rules` with strict, least-privilege collection rules.
2. Implement Firebase Custom Claims via Firebase Admin SDK / Cloud Functions for all administrative roles (`super_admin`, `taluk_admin`, `staff`).
3. Enforce strict ownership checks (`request.auth.uid == resource.data.citizenId`) for citizen operations.
4. Enforce jurisdiction checks (`request.auth.token.taluk == resource.data.taluk`) for Taluk Admin operations.
5. Move staff and admin user creation to Firebase Cloud Functions.
