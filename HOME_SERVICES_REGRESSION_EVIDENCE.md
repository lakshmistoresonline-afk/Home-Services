# 🔄 HOME SERVICES APPLICATION — REGRESSION EVIDENCE REPORT

**Project**: Home Services Application  
**Repository**: https://github.com/lakshmistoresonline-afk/Home-Services.git  
**Firebase Staging Project**: home-services-8789c  
**Date**: November 7, 2026  
**QA Lead**: Regression Test Lead  

---

## 1. Clear Categorization of Testing Evidence

- **Build Verification**: Expo Web Bundle static export (`npx expo export --platform web --clear`).
- **Automated Tests**: Node.js Security Assertion Suite (`seed/runSecurityTests.js`) & Workflow Unit Tests (`src/api/__tests__/workflow.test.ts`).
- **Manual Verification**: End-to-End Application UI Workflows in browser.

---

## 2. Application Workflow Test Matrix

| Workflow ID | User Role | Tested Workflow Step | Verification Type | Command / Action | Expected Result | Actual Result | Status |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **REG-01** | Customer | Registration & Login | Automated | `auth.signInWithEmailAndPassword('customer@domain.in', 'pass')` | Profile loaded with role `citizen` | Authenticated successfully | `PASS` |
| **REG-02** | Customer | Service Request Booking Submission | Automated | `createServiceRequest({category, title, description})` | SRV request document created | Request `SRV-492019` created | `PASS` |
| **REG-03** | Customer | Customer Booking History View | Manual / UI | Navigating to `app/(tabs)/bookings.tsx` | Displays customer's bookings | Displays customer bookings | `PASS` |
| **REG-04** | Service Provider | Provider Assigned Requests View | Manual / UI | Log in as Provider `rajesh.tech@homeservice.in` | Displays assigned bookings only | Shows assigned bookings | `PASS` |
| **REG-05** | Service Provider | Provider Acceptance & Progress Updates | Manual / UI | Click `Update Workflow Status` ➔ `In Progress` | Status updated to `In Progress` | Status updated cleanly | `PASS` |
| **REG-06** | Service Provider | Resolution & Srinath Rajkiran UPI QR Payment | Manual / UI | Select `Resolved` ➔ Amount `₹599` ➔ UPI QR Code | Displays Srinath Rajkiran QR Code | Displays QR Code & resolves request | `PASS` |
| **REG-07** | Taluk Admin | Provider Assignment & Taluk Monitoring | Manual / UI | Click `Assign Provider` in `app/service/[id].tsx` | Assigned staff saved | Staff assigned & workload +1 | `PASS` |
| **REG-08** | Super Admin | System Management & Configuration | Manual / UI | Log in as Super Admin `superadmin@homeservice.in` | Access to staff, taluks, settings | Full admin access granted | `PASS` |
| **REG-09** | Read-Only Admin | Read-only administrative access check | Manual / UI | Log in as Read-Only Admin `readonly.admin@homeservice.in` | Write buttons disabled | Write options hidden / disabled | `PASS` |
| **REG-10** | Customer / Staff | Notifications Delivery | Manual / UI | Navigating to `app/(tabs)/notifications.tsx` | Unread notifications listed | Notifications displayed | `PASS` |
| **REG-11** | Customer / Staff | Photo Attachment View & Zoom | Manual / UI | Tap image attachment in `app/service/[id].tsx` | Full-screen image viewer | Viewer opens cleanly | `PASS` |
| **REG-12** | All Roles | Build Compilation Check | Build Verification | `npx expo export --platform web --clear` | Static web bundle generated | `Exported: dist` | `PASS` |
