# 🧪 TEST COVERAGE AUDIT REPORT
**Project**: Thrissur Corporation Citizen Complaint Management System (CCMS)  
**Date**: November 7, 2026  
**Auditor**: QA Lead & Test Automation Engineer  

---

## 1. Existing Test Environment Assessment

Currently, automated test coverage is minimal.

- **Test Framework**: `jest` / `expo-doctor` / `eslint`.
- **Existing Test Files**: No dedicated `.test.ts` or `.spec.ts` files currently exist in `src/` or `app/`.
- **Manual Verification Utility**: `seed/deployFirestoreRules.js` and build verification commands (`npx expo export --platform web --clear`).

---

## 2. Test Coverage Gap Analysis

| Critical Area | Current Coverage | Risk Level | Required Test Suite |
| :--- | :--- | :--- | :--- |
| **Firestore Security Rules** | `0%` | `CRITICAL` | Firebase Emulator Rules Unit Tests (`@firebase/rules-unit-testing`) |
| **Workflow State Transitions** | `0%` | `HIGH` | Unit Tests for `isValidTransition` & `getAllowedTransitions` |
| **Assignment Engine & Ranking** | `0%` | `HIGH` | Unit Tests for `isStaffEligible` & `rankStaff` |
| **Role Authorization Checks** | `0%` | `HIGH` | Integration Tests for `hasPermission`, `canAssign`, `canClose` |
| **API Integration & Mappers** | `0%` | `MEDIUM` | Unit Tests for `mapDoc`, `mapUserDoc`, `findServiceRequestSnapshot` |

---

## 3. Mandatory Test Scenarios to Implement

1. **Firestore Rules Tests**:
   - Unauthenticated reads and writes are rejected.
   - Citizens can read and write only their own complaints (`citizenId == auth.uid`).
   - Staff can read and write only complaints assigned to them (`assignedStaffId == auth.uid`).
   - Users cannot modify `role` or `permissions` fields on `users/{uid}`.
   - Taluk Admins cannot modify complaints outside their assigned `taluk`.

2. **Workflow Engine Tests**:
   - `Submitted` ➔ `Assigned` ➔ `Accepted` ➔ `In Progress` ➔ `Resolved` ➔ `Closed` is valid.
   - Invalid jump from `Submitted` directly to `Resolved` is rejected.
   - Reopening a `Resolved` complaint changes status to `In Progress` or `Submitted`.

3. **Assignment Engine Tests**:
   - Staff member with ineligible department is excluded from recommendation pool.
   - Staff member with lowest active workload is ranked first.
