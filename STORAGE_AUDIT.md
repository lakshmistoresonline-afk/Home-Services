# 📦 STORAGE AUDIT REPORT
**Project**: Thrissur Corporation Citizen Complaint Management System (CCMS)  
**Date**: November 7, 2026  
**Auditor**: Database Architect & Storage Engineer  

---

## 1. Storage Architecture Overview

The application requires file storage for photo evidence attached to complaints, timeline attachments, and profile documents.

---

## 2. Identified Deficiencies

### Defect 2.1: Base64 Strings Stored Directly in Firestore Documents
**Location**: [`app/service/new.tsx`](file:///G:/HomeService/app/service/new.tsx), [`src/api/serviceRequestApi.ts`](file:///G:/HomeService/src/api/serviceRequestApi.ts#L60-L75)
- When a citizen attaches a photo via `expo-image-picker`, the image is captured as a **Base64 encoded string** and stored in the `photos` array in Firestore.
- **Impact**: Storing large Base64 strings inflates document sizes towards Firestore's **1 MB document limit**, increases network bandwidth consumption, and degrades query performance.

---

### Defect 2.2: Hardcoded Fallback URLs
**Location**: [`src/api/serviceRequestApi.ts`](file:///G:/HomeService/src/api/serviceRequestApi.ts#L80-L90)
```typescript
const cleanPhotos = (req.photos || []).map(p => 
  p && p.startsWith('data:') 
    ? 'https://images.unsplash.com/photo-1581092160607-ee22621dd758?w=800&q=80' 
    : p
);
```
- Base64 images are sanitized by replacing them with a static Unsplash URL when local storage fallback functions execute.

---

### Defect 2.3: Lack of Cloud Storage Integration
**Location**: [`src/config/firebase.ts`](file:///G:/HomeService/src/config/firebase.ts)
- While `getStorage(app)` is initialized in `src/config/firebase.ts`, image upload handlers (`uploadBytes`, `getDownloadURL`) are not wired to `expo-image-picker` during complaint creation.

---

## 3. Storage Migration Strategy

1. Wire `expo-image-picker` to Firebase Cloud Storage using `uploadBytesResumable()`.
2. Storage Bucket Path Hierarchy:
   ```
   gs://home-services-8789c.firebasestorage.app/
   └── serviceRequests/
       └── {complaintId}/
           ├── photos/
           │   ├── photo_1.jpg
           │   └── photo_2.jpg
           └── attachments/
               └── document_1.pdf
   ```
3. Implement file validation:
   - Allowed MIME types: `image/jpeg`, `image/png`, `image/webp`, `application/pdf`.
   - Maximum file size: `5 MB`.
