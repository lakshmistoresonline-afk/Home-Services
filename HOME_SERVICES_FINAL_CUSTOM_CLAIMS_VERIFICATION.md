# 🔐 HOME SERVICES APPLICATION — FINAL CUSTOM CLAIMS VERIFICATION

**Project**: Home Services Application  
**Repository**: https://github.com/lakshmistoresonline-afk/Home-Services.git  
**Date**: November 9, 2026  

---

## Custom Claims & Session Propagation Verification

1. **Role Issuance**: Custom claims issued via `setUserRole` Cloud Function (`functions/src/roles.ts`) using Firebase Admin Auth (`setCustomUserClaims`).
2. **Token Refresh Strategy**: Active client session tokens refresh claims upon re-authentication (`user.getIdToken(true)`).
3. **Read-Only Administrative Restriction**: Read-only Super Admin role (`readonly_super_admin`) permissions are enforced in both Firestore rules (`!isReadOnlyAdmin()`) and Cloud Functions.
