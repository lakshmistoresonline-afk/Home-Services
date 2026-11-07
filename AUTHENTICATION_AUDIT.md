# 🔐 AUTHENTICATION AUDIT REPORT
**Project**: Thrissur Corporation Citizen Complaint Management System (CCMS)  
**Date**: November 7, 2026  
**Auditor**: Senior React Native & Firebase Engineer  

---

## 1. Authentication Architecture

The application uses **Firebase Auth** combined with **Cloud Firestore profile records** (`users/{uid}`).

```
[ User Input ] ──> Firebase Auth (signInWithEmailAndPassword) ──> Firebase ID Token
                                                                     │
                                                                     ▼
[ Client Auth State ] <── Fetch Profile <── Firestore (users/{uid})
```

---

## 2. Code Review & Identified Deficiencies

### Defect 2.1: Secondary Auth Creation on Client Web
**Location**: [`src/api/client.ts`](file:///G:/HomeService/src/api/client.ts#L25-L38), [`src/api/staffApi.ts`](file:///G:/HomeService/src/api/staffApi.ts#L48-L52)
```typescript
export function getSecondaryAuth() {
  const { initializeApp, getApp, getApps } = require('firebase/app');
  const { getAuth } = require('firebase/auth');
  const { firebaseConfig } = require('@/src/config/firebase-config');

  let secondaryApp = getApps().find((a: any) => a.name === 'SecondaryApp') 
    || initializeApp(firebaseConfig, 'SecondaryApp');
  return getAuth(secondaryApp);
}
```
**Impact**: When an Admin creates a staff account, a secondary Firebase app is initialized directly in the client browser to create the user with `createUserWithEmailAndPassword`. This bypasses Cloud Function security checks and exposes client memory to secondary auth tokens.

---

### Defect 2.2: Hardcoded Role Fallback Logic
**Location**: [`src/context/auth.tsx`](file:///G:/HomeService/src/context/auth.tsx#L55-L72)
```typescript
const isEmployee = fbUser.email?.endsWith('.gov.in');
const role = isEmployee
  ? (fbUser.email?.includes('superadmin') ? 'super_admin' : 'taluk_admin')
  : 'citizen';
```
**Impact**: If the Firestore profile query fails or runs offline, the app infers the user's role from email substrings (`.gov.in`, `superadmin`). An attacker creating a citizen account with `superadmin.test@domain.gov.in` receives `super_admin` permissions in local state.

---

### Defect 2.3: Unprotected User Profile Updates
**Location**: [`src/api/authApi.ts`](file:///G:/HomeService/src/api/authApi.ts), [`src/api/staffApi.ts`](file:///G:/HomeService/src/api/staffApi.ts#L105-L115)
- Profiles are updated via direct `updateDoc(doc(db, "users", uid), data)` calls from the client. Without strict Firestore Security Rules, users can modify their `role`, `permissions`, and `isActive` fields directly via client SDK.

---

## 3. Recommended Remediation Strategy

1. **Firebase Custom Claims**: Issue `role` claims (`super_admin`, `taluk_admin`, `staff`, `citizen`) and `taluk` jurisdiction claims using Admin SDK.
2. **Cloud Functions for User Management**:
   - `createStaffAccount` Cloud Function for creating staff credentials securely.
   - `setUserRole` Cloud Function for updating roles and claims.
3. **Remove Client-Side Email Inferences**: Eliminate all email string parsing for authorization in `src/context/auth.tsx`.
