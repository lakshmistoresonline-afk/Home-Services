# 🔄 WORKFLOW & ASSIGNMENT AUDIT REPORT
**Project**: Thrissur Corporation Citizen Complaint Management System (CCMS)  
**Date**: November 7, 2026  
**Auditor**: Senior Solution Architect  

---

## 1. Complaint Workflow State Machine

The complaint resolution workflow follows a finite state machine defined in [`src/api/workflowApi.ts`](file:///G:/HomeService/src/api/workflowApi.ts):

```
                       ┌──────────────┐
                       │  Submitted   │
                       └──────┬───────┘
                              │ (Assign)
                              ▼
                       ┌──────────────┐
                       │   Assigned   │
                       └──────┬───────┘
                   ┌──────────┴──────────┐
          (Reject) │                     │ (Accept)
                   ▼                     ▼
            ┌──────────────┐      ┌──────────────┐
            │   Rejected   │      │   Accepted   │
            └──────┬───────┘      └──────┬───────┘
                   │ (Reassign)          │ (Start Work)
                   ▼                     ▼
            ┌──────────────┐      ┌──────────────┐
            │   Assigned   │      │ In Progress  │
            └──────────────┘      └──────┬───────┘
                                         │ (Resolve + Pay)
                                         ▼
                                  ┌──────────────┐
                                  │   Resolved   │
                                  └──────┬───────┘
                              ┌──────────┴──────────┐
                     (Close)  │                     │ (Reopen)
                              ▼                     ▼
                       ┌──────────────┐      ┌──────────────┐
                       │    Closed    │      │   Reopened   │
                       └──────────────┘      └──────────────┘
```

---

## 2. Transition Rules Matrix

| From Status | Allowed Next Statuses | Authorized Roles |
| :--- | :--- | :--- |
| `Submitted` | `Assigned`, `Cancelled` | Taluk Admin, Super Admin, Citizen (Cancel only) |
| `Assigned` | `Accepted`, `Rejected` | Assigned Staff |
| `Accepted` | `In Progress` | Assigned Staff |
| `Rejected` | `Assigned` | Taluk Admin, Super Admin |
| `In Progress` | `Resolved` | Assigned Staff, Super Admin |
| `Resolved` | `Closed`, `Reopened` | Citizen (Reopen), Taluk Admin (Close/Reopen), Super Admin |
| `Closed` | None (Final) | None |
| `Cancelled` | None (Final) | None |
| `Reopened` | `Assigned`, `Cancelled` | Taluk Admin, Super Admin |

---

## 3. Assignment Engine & Concurrency Issues

### Defect 3.1: Non-Atomic Workload Counter Increments
**Location**: [`src/api/assignmentEngine.ts`](file:///G:/HomeService/src/api/assignmentEngine.ts#L185-L200)
```typescript
if (assignedStaff && complaintData.assignedStaffId !== assignedStaff.uid) {
  await updateDoc(doc(db, "users", assignedStaff.uid), {
    activeComplaintCount: increment(1),
    updatedAt: serverTimestamp(),
  });
}
```
**Risk**: Increments occur in separate `updateDoc` calls rather than an atomic Firestore **`runTransaction()`**. Concurrent assignments to the same staff member can result in race conditions and inaccurate workload counts.

---

### Defect 3.2: Staff Jurisdiction Filter in Client
**Location**: [`src/api/serviceRequestApi.ts`](file:///G:/HomeService/src/api/serviceRequestApi.ts#L150-L162)
```typescript
} else if (isStaff) {
  const q1 = await getDocs(query(collection(db, "serviceRequests"), where("assignedStaffId", "==", user.uid))).catch(() => null);
  snaps = [q1];
}
```
**Behavior**: While `listServiceRequests()` filters queries by `assignedStaffId == user.uid`, because `firestore.rules` currently allows `allow read, write: if true;`, a staff user can still read any unassigned complaint by passing its ID directly to `getServiceRequest(cid)`.

---

## 4. Maintenance Sweep & Automated Escalation
**Location**: [`src/api/assignmentEngine.ts`](file:///G:/HomeService/src/api/assignmentEngine.ts#L225-L280)
- `runMaintenanceSweep()` handles:
  1. Auto-assigning requests in `Submitted` status older than 3 hours.
  2. Auto-closing requests in `Resolved` status older than 7 days.
- **Defect**: This sweep is currently executed via a client-triggered function (`runMaintenanceSweep(actor)`). It must be migrated to a scheduled Firebase Cloud Function (`pubsub.schedule`).
