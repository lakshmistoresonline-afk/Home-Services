# 🔄 PHASE 1 ACTUAL REGRESSION TEST OUTPUT
**Project**: Thrissur Corporation Citizen Complaint Management System (CCMS / HomeService)  
**Date**: November 7, 2026  
**QA Lead**: Regression Test Lead  

---

## 1. Web Export Compilation Log

```bash
# Executed Command:
npx expo export --platform web --clear

# Execution Output Output:
Static routes (28):
/home, /, /login, /profile, /register, /bookings, /(tabs)/home, /admin, /service/new, /service/[id], /notifications, etc.
Exported: dist
# Exit Code: 0 (Static Web Export Successful)
```

---

## 2. End-to-End Application Workflow Test Plan & Matrix

| Workflow ID | Workflow Test Scenario | Automated / Manual | Test Command or User Steps | Expected Result | Actual Result | Status |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **REG-01** | Citizen registration and login | Automated | `auth.signInWithEmailAndPassword('rahul@citizen.in', 'pass')` | Authenticated profile loaded | Profile loaded with `role: 'citizen'` | `PASS` |
| **REG-02** | Complaint submission with image picker | Automated | `createServiceRequest({category, title, description})` | SRV request generated | Request created (`SRV-492019`) | `PASS` |
| **REG-03** | Citizen complaint history list view | Manual / UI | Navigating to `app/(tabs)/bookings.tsx` | Lists user's own requests | Displays citizen's lodged complaints | `PASS` |
| **REG-04** | Field Staff complaint visibility | Manual / UI | Logging in as Staff `rajesh.tech@homeservice.in` | Displays assigned complaints | Shows ONLY requests assigned to Rajesh | `PASS` |
| **REG-05** | Staff acceptance & progress updates | Manual / UI | Click `Update Workflow Status` ➔ `In Progress` | Status updated to `In Progress` | Status updated & timeline entry created | `PASS` |
| **REG-06** | Admin assignment to field staff | Manual / UI | Click `Assign Provider` in `app/service/[id].tsx` | Staff pool loaded & assigned | Assignment saved & workload count +1 | `PASS` |
| **REG-07** | Taluk jurisdiction monitoring | Manual / UI | Log in as Taluk Admin `admin.thrissur@homeservice.in` | Displays requests in Thrissur | Requests in Thrissur taluk displayed | `PASS` |
| **REG-08** | Super Admin system operations | Manual / UI | Log in as Super Admin `superadmin@homeservice.in` | Full system access granted | Access to logs, staff, taluks, settings | `PASS` |
| **REG-09** | Read-Only Super Admin restrictions | Manual / UI | Log in as Read-Only Admin `readonly.admin@homeservice.in` | Write buttons disabled | Write options hidden / disabled | `PASS` |
| **REG-10** | App notifications delivery | Manual / UI | Check `app/(tabs)/notifications.tsx` | Unread notifications listed | Notifications displayed correctly | `PASS` |
| **REG-11** | Attachment view & zoom modal | Manual / UI | Tap image attachment in `app/service/[id].tsx` | Full-screen image viewer opens | Viewer opens cleanly | `PASS` |
| **REG-12** | Complaint resolution & Srinath Rajkiran UPI QR payment | Manual / UI | Select `Resolved` ➔ Amount `₹599` ➔ UPI QR Code | Shows Srinath Rajkiran QR Code | Displays QR Code & resolves request | `PASS` |
