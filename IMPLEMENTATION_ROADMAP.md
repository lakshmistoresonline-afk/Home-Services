# 🗺️ IMPLEMENTATION ROADMAP — PRODUCTION REMEDIATION
**Project**: Thrissur Corporation Citizen Complaint Management System (CCMS)  
**Date**: November 7, 2026  
**Lead Architect**: Senior Solution Architect  

---

## 1. Executive Remediation Strategy

This roadmap details the 10-phase production remediation plan to transform the HomeService platform into a secure, scalable, enterprise-grade municipal grievance platform for Thrissur Corporation.

---

## 2. Phase Breakdown

### Phase 1: Security Rules & Firebase Custom Claims (`CRITICAL`)
- [x] Create least-privilege `firestore.rules` for all collections (`serviceRequests`, `users`, `auditLogs`, `notifications`).
- [ ] Implement Firebase Custom Claims issuing (`role`, `taluk`) via Firebase Admin SDK.
- [ ] Remove client-side email substring role inferences in `src/context/auth.tsx`.
- [ ] Deploy and verify security rules using `seed/deployFirestoreRules.js`.

---

### Phase 2: Firebase Cloud Functions Migration (`HIGH`)
- [ ] Initialize Firebase Cloud Functions directory (`functions/`).
- [ ] Move sensitive business logic (`createServiceRequest`, `assignComplaint`, `adminUpdateStatus`) to Cloud Functions.
- [ ] Implement atomic Firestore `runTransaction()` blocks for workload counter updates (`activeComplaintCount`, `completedComplaintCount`).

---

### Phase 3: Firebase Cloud Storage Integration (`HIGH`)
- [ ] Replace Base64 image encoding in `app/service/new.tsx` with `expo-image-picker` Cloud Storage uploads (`uploadBytesResumable`).
- [ ] Set up file validation (Max size: 5 MB, allowed MIME types: JPG, PNG, PDF).
- [ ] Configure storage security rules (`storage.rules`).

---

### Phase 4: Database Standardization & Indexing (`MEDIUM`)
- [x] Standardize all data reads/writes to `serviceRequests` collection exclusively.
- [x] Remove local storage fallback dependencies (`localStorage` / `getStoredLocalRequests`).
- [x] Configure composite indexes in `firestore.indexes.json`.

---

### Phase 5: Automated SLA & Maintenance Scheduled Jobs (`MEDIUM`)
- [ ] Deploy scheduled Cloud Functions (`pubsub.schedule`) for:
  - Auto-assigning unassigned requests older than 3 hours.
  - Auto-closing resolved requests older than 7 days.
  - Sending automated notifications for pending assignments.

---

### Phase 6: UI/UX & Payment Workflow Refinement (`COMPLETED`)
- [x] Implement the `ResolvePaymentModal` featuring **Srinath Rajkiran** UPI QR Code (`srinathrajkiran007-2@okaxis`) as the primary payment method.
- [x] Fix back button navigation stack handling across all routes.
- [x] Resolve React Error #418 hydration mismatches for Expo Router Web export.

---

### Phase 7: Comprehensive Automated Testing (`MEDIUM`)
- [ ] Set up Jest & `@firebase/rules-unit-testing`.
- [ ] Write unit tests for workflow transitions (`workflowApi.ts`) and staff ranking (`assignmentUtils.ts`).
- [ ] Write security tests for Firestore rules.

---

### Phase 8: CI/CD Pipeline Setup (`LOW`)
- [ ] Create `.github/workflows/ci-cd.yml` for automated linting, typechecking, testing, and Firebase deployment.

---

## 3. Progress Tracking & Target Completion

| Phase | Description | Status | Risk Level |
| :--- | :--- | :--- | :--- |
| **Phase 1** | Security Rules & Claims | `IN_PROGRESS` | `CRITICAL` |
| **Phase 2** | Cloud Functions Migration | `PLANNED` | `HIGH` |
| **Phase 3** | Cloud Storage Integration | `PLANNED` | `HIGH` |
| **Phase 4** | Database Standardization | `COMPLETED` | `MEDIUM` |
| **Phase 5** | Scheduled Maintenance Jobs | `PLANNED` | `MEDIUM` |
| **Phase 6** | UI/UX & UPI Payment Flow | `COMPLETED` | `LOW` |
| **Phase 7** | Automated Testing Suite | `PLANNED` | `MEDIUM` |
| **Phase 8** | CI/CD Pipeline | `PLANNED` | `LOW` |
