# 🗄️ FIRESTORE SCHEMA AUDIT REPORT
**Project**: Thrissur Corporation Citizen Complaint Management System (CCMS)  
**Date**: November 7, 2026  
**Auditor**: Database Architect  

---

## 1. Schema Overview

Cloud Firestore is used as the primary database for the application. The schema stores municipal master settings, grievance requests, user profiles, notifications, and activity logs.

---

## 2. Collection Structure & Data Models

| Collection Name | Document Key Pattern | Primary Schema Fields | Legacy Aliases Found |
| :--- | :--- | :--- | :--- |
| `serviceRequests` | `SRV-[6-digit]` | `complaint_id`, `citizenId`, `title`, `status`, `assignedStaffId`, `taluk`, `timeline` | `complaints` |
| `users` | `[Firebase UID]` | `uid`, `fullName`, `email`, `role`, `taluk`, `activeComplaintCount` | `citizens`, `staff` |
| `taluks` | `[slug]` | `id`, `name`, `district`, `isActive` | `wards` |
| `departments` | `[slug]` | `id`, `name`, `description`, `icon` | `departmentNames` |
| `serviceCategories` | `[auto-id]` | `id`, `name`, `departmentId`, `priority`, `slaHours` | `complaintCategories` |
| `auditLogs` | `[auto-id]` | `actor`, `action`, `entity`, `timestamp`, `context` | `logs` |
| `notifications` | `[auto-id]` | `recipientUid`, `title`, `message`, `type`, `read`, `createdAt` | - |

---

## 3. Schema Inconsistencies & Defects

### Defect 3.1: Dual Collection Referencing (`serviceRequests` vs `complaints`)
**Location**: [`src/api/serviceRequestApi.ts`](file:///G:/HomeService/src/api/serviceRequestApi.ts), [`src/api/timelineApi.ts`](file:///G:/HomeService/src/api/timelineApi.ts)
- `serviceRequestApi.ts` writes to `serviceRequests`.
- `timelineApi.ts` line 44 executes `doc(db, "complaints", complaintId)`, attempting to update a legacy `complaints` collection that is no longer seeded.

---

### Defect 3.2: Redundant Identifier Fields
**Location**: [`seed/serviceRequests.json`](file:///G:/HomeService/seed/serviceRequests.json)
- Each request document stores `id`, `complaint_id`, AND `request_id` with duplicate string values (`SRV-2026-001`).

---

### Defect 3.3: Inconsistent Date Representation
**Location**: [`src/api/serviceRequestApi.ts`](file:///G:/HomeService/src/api/serviceRequestApi.ts#L100-L125)
- Document timestamps use three varying formats:
  1. Firestore `serverTimestamp()` (`createdAt`, `updatedAt`)
  2. ISO String (`created_at`, `updated_at`, `timestamp`)
  3. Client-side JS `Date` objects (`createdAtDate`, `updatedAtDate`)

---

### Defect 3.4: Unbounded Array Growth (`timeline`, `comments`, `assignmentHistory`)
**Location**: [`src/api/staffApi.ts`](file:///G:/HomeService/src/api/staffApi.ts#L120-L135)
- Every status update or assignment appends objects into `timeline` and `assignmentHistory` arrays using `arrayUnion`. Large activity history can exceed Firestore's **1 MB per document limit**.

---

## 4. Required Indexing Strategy

The following composite indexes are required in `firestore.indexes.json`:

```json
{
  "collectionGroup": "serviceRequests",
  "queryScope": "COLLECTION",
  "fields": [
    { "fieldPath": "citizenId", "order": "ASCENDING" },
    { "fieldPath": "createdAt", "order": "DESCENDING" }
  ]
},
{
  "collectionGroup": "serviceRequests",
  "queryScope": "COLLECTION",
  "fields": [
    { "fieldPath": "assignedStaffId", "order": "ASCENDING" },
    { "fieldPath": "status", "order": "ASCENDING" },
    { "fieldPath": "createdAt", "order": "DESCENDING" }
  ]
}
```
