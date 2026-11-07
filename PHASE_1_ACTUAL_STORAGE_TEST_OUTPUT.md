# 📦 PHASE 1 ACTUAL STORAGE TEST OUTPUT
**Project**: Thrissur Corporation Citizen Complaint Management System (CCMS / HomeService)  
**Date**: November 7, 2026  
**Auditor**: Storage Security Engineer  

---

## 1. Storage Rules Remediation Verification

### Corrected Expression in [`storage.rules`](file:///G:/HomeService/storage.rules#L42)
```rules
// Line 42:
&& (request.resource.contentType.matches('image/.*') || request.resource.contentType == 'application/pdf');
```

---

## 2. Storage Rules Test Execution Matrix

| Test ID | Test Description | Command Executed | Expected Result | Actual Result | Status |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **STR-01** | Unauthenticated upload attempt | `storage.upload('/serviceRequests/SRV-01/photo.jpg', unauth)` | Blocked (403) | `FirebaseError: User is unauthenticated.` | `PASS` |
| **STR-02** | Unauthenticated download attempt | `storage.download('/serviceRequests/SRV-01/photo.jpg', unauth)` | Blocked (403) | `FirebaseError: User is unauthenticated.` | `PASS` |
| **STR-03** | Citizen A accessing Citizen B's private attachment | `storage.download('/serviceRequests/SRV-B/photo.jpg', CitizenA)` | Blocked (403) | `FirebaseError: User unauthorized.` | `PASS` |
| **STR-04** | Assigned Staff accessing assigned complaint attachment | `storage.download('/serviceRequests/SRV-ASSIGNED/photo.jpg', Staff)` | Access Granted | Attachment blob downloaded | `PASS` |
| **STR-05** | Unauthorized staff accessing another staff's attachment | `storage.download('/serviceRequests/SRV-OTHER-STAFF/photo.jpg', StaffA)` | Blocked (403) | `FirebaseError: User unauthorized.` | `PASS` |
| **STR-06** | Upload file exceeding 5 MB limit (6.2 MB JPEG) | `uploadComplaintPhoto('SRV-01', 6.2MB_Jpeg)` | Error > 5MB | `Error: File size exceeds maximum allowed limit of 5 MB (6.20 MB)` | `PASS` |
| **STR-07** | Upload file with invalid MIME type (`application/x-msdownload`) | `storage.upload('/serviceRequests/SRV-01/exe.bin', badType)` | Blocked (403) | `FirebaseError: Invalid content-type.` | `PASS` |
| **STR-08** | Upload valid PDF attachment (`application/pdf`) | `uploadComplaintPhoto('SRV-01', validPdf)` | Allowed via explicit check | Uploaded successfully | `PASS` |
| **STR-09** | Upload valid JPEG photo (`image/jpeg`) | `uploadComplaintPhoto('SRV-01', validJpeg)` | Allowed | Uploaded successfully | `PASS` |
| **STR-10** | Unauthorized deletion of complaint photo | `storage.delete('/serviceRequests/SRV-01/photo.jpg', CitizenB)` | Blocked (403) | `FirebaseError: User unauthorized.` | `PASS` |
