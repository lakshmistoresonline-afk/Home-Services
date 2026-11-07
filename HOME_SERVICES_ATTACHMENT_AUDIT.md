# 📦 HOME SERVICES APPLICATION — ATTACHMENT AUDIT REPORT

**Project**: Home Services Application  
**Repository**: https://github.com/lakshmistoresonline-afk/Home-Services.git  
**Firebase Staging Project**: home-services-8789c  
**Date**: November 7, 2026  

---

## Storage & Photo Attachment Policies

- **Storage Bucket Path**: `serviceRequests/{complaintId}/photos/{filename}`
- **Max File Size**: 5 MB per file (`MAX_FILE_SIZE_BYTES = 5 * 1024 * 1024`)
- **Allowed Content Types**: `image/jpeg`, `image/png`, `image/webp`, `application/pdf`
- **Legacy Compatibility**: Backwards-compatible rendering of legacy Base64 photos via `mapDoc()`
