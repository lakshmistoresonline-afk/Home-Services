# 🗄️ PHASE 3 STORAGE ARCHITECTURE & POLICIES REPORT
**Project**: Thrissur Corporation Citizen Complaint Management System (CCMS)  
**Date**: November 7, 2026  
**Auditor**: Storage Architect  

---

## 1. Cloud Storage Path Hierarchy & Policies

```
gs://home-services-8789c.firebasestorage.app/
├── serviceRequests/
│   └── {complaintId}/
│       └── photos/
│           ├── photo_1730999000_a1b2c3.jpg
│           └── photo_1730999001_x9y8z7.jpg
└── profiles/
    └── {uid}/
        └── avatar.jpg
```

---

## 2. Storage Security Rules & Validation Matrix

| Storage Bucket Path | Maximum File Size | Allowed Content Types | Read Access Policy | Write Access Policy |
| :--- | :--- | :--- | :--- | :--- |
| `serviceRequests/{id}/photos/{file}` | `5 MB` | `image/*`, `application/pdf` | Authenticated users (Reporter, Assigned Staff, Admins) | Authenticated Reporter or Assigned Staff |
| `profiles/{uid}/{file}` | `2 MB` | `image/*` | Authenticated users | Owner (`request.auth.uid == uid`) |
