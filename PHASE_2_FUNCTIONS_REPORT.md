# ⚡ PHASE 2 CLOUD FUNCTIONS SPECIFICATION REPORT
**Project**: Thrissur Corporation Citizen Complaint Management System (CCMS)  
**Date**: November 7, 2026  
**Auditor**: Backend Architect  

---

## Cloud Functions Inventory & Interface Contracts

| Function Name | Trigger Type | Execution Environment | Primary Purpose |
| :--- | :--- | :--- | :--- |
| `createServiceRequest` | `onCall` (HTTPS) | Node.js 18 | Validates user account, generates unique ID, writes request to Firestore |
| `assignComplaint` | `onCall` (HTTPS) | Node.js 18 | Executes atomic `runTransaction()` for assignment & workload counter updates |
| `updateComplaintStatus` | `onCall` (HTTPS) | Node.js 18 | Validates workflow state machine transitions and records payment details |
| `setUserRole` | `onCall` (HTTPS) | Node.js 18 | Issues Firebase Auth Custom Claims (`role`, `taluk`) & updates profile |
| `scheduledAutoAssign` | `pubsub.schedule` | Node.js 18 | Auto-assigns pending requests older than 3 hours every 30 minutes |
| `scheduledAutoClose` | `pubsub.schedule` | Node.js 18 | Auto-closes resolved requests older than 7 days every 24 hours |

---

## Key Code Highlights

### Atomic Assignment Transaction (`functions/src/assignment.ts`)
```typescript
return db.runTransaction(async (transaction) => {
  // Read request & staff docs inside transaction
  transaction.update(requestRef, {
    assignedStaffId: staffId || null,
    assignedStaffName: newStaffData?.fullName || null,
    status: staffId ? 'Assigned' : 'Submitted',
  });

  // Atomic decrement for previous staff
  if (prevStaffId && prevStaffId !== staffId) {
    transaction.update(prevStaffRef, {
      activeComplaintCount: FieldValue.increment(-1),
    });
  }

  // Atomic increment for new staff
  if (newStaffRef && prevStaffId !== staffId) {
    transaction.update(newStaffRef, {
      activeComplaintCount: FieldValue.increment(1),
    });
  }
});
```
