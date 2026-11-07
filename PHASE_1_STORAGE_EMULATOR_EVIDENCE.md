# 📦 PHASE 1 STORAGE EMULATOR TEST EVIDENCE
**Project**: Thrissur Corporation Citizen Complaint Management System (CCMS)  
**Date**: November 7, 2026  
**QA Lead**: Firebase Storage Test Engineer  

---

## 1. Storage Rules Test Matrix

| Test ID | Test Description | Command / Action | Expected Result | Actual Result | Status |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **STR-01** | Unauthenticated file upload attempt | `storage.upload('/serviceRequests/SRV-01/test.jpg')` | Blocked (unauthenticated) | Blocked (403) | `PASS` |
| **STR-02** | Upload photo exceeding 5 MB limit | `uploadComplaintPhoto('SRV-01', 6MB_File)` | Throws 5 MB limit error | Throws size limit error | `PASS` |
| **STR-03** | Upload photo with allowed type `image/jpeg` | `uploadComplaintPhoto('SRV-01', validJpeg)` | Returns download URL | Returns HTTPS download URL | `PASS` |
| **STR-04** | Upload PDF attachment with `application/pdf` | `uploadComplaintPhoto('SRV-01', validPdf)` | Allowed via explicit type check | Uploaded successfully | `PASS` |
| **STR-05** | Unauthorized user deletes another user's file | `storage.delete('/serviceRequests/SRV-02/photo.jpg')` | Blocked (unauthorized) | Blocked (403) | `PASS` |
