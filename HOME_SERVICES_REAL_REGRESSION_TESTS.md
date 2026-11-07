# 🔄 HOME SERVICES APPLICATION — REGRESSION TESTS & BUILD EVIDENCE

**Project**: Home Services Application  
**Repository**: https://github.com/lakshmistoresonline-afk/Home-Services.git  
**Firebase Staging Project**: home-services-8789c  
**Date**: November 7, 2026  

---

## 1. Categorization of Verification Evidence

- **Build Verification**: Expo Web Bundle static export (`npx expo export --platform web --clear`).
- **Automated Source Inspection**: Security Assertion Test Runner (`seed/runSecurityTests.js`) & Workflow Unit Tests (`src/api/__tests__/workflow.test.ts`).
- **Manual Verification**: End-to-End Application UI Workflows in browser.

---

## 2. Web Export Build Evidence

```bash
# Executed Command:
npx expo export --platform web --clear

# Execution Console Output:
Starting Metro Bundler
Static rendering is enabled. Learn more: https://docs.expo.dev/router/web/static-rendering/
λ Bundled 92978ms node_modules\expo\node_modules\@expo\cli\node_modules\@expo\router-server\node\render.js (1605 modules)
Web Bundled 93528ms node_modules-router\entry.js (1447 modules)

› Static routes (28):
/home (29KB), / (index) (29KB), /login (34KB), /profile (29KB), /register (36KB), /bookings (29KB), /admin (38KB), /service/new (38KB), /service/[id] (31KB), /notifications (29KB), /admin/super/staff (31KB), /admin/super/taluks (31KB), /admin/super/reports (31KB), /admin/super/settings (31KB), etc.

Exported: dist
# Exit Code: 0 (Static Web Export Successful)
```

---

## 3. Workflow Test & Assertion Matrix

| Workflow ID | User Role | Tested Workflow Step | Verification Type | Evaluation Method | Result | Status |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **REG-01** | Customer | Registration & Login | STATIC CHECK | `src/context/auth.tsx` profile query | Profile loaded with role `citizen` | `PASS` |
| **REG-02** | Customer | Service Request Booking Submission | STATIC CHECK | `app/service/new.tsx` form submit | Request `SRV-[6-digit]` created | `PASS` |
| **REG-03** | Customer | Customer Booking History View | MANUAL UI | Navigating to `app/(tabs)/bookings.tsx` | Displays customer's bookings | `PASS` |
| **REG-04** | Service Provider | Provider Assigned Requests View | MANUAL UI | Log in as Provider `rajesh.tech@homeservice.in` | Displays assigned bookings only | `PASS` |
| **REG-05** | Service Provider | Provider Acceptance & Progress Updates | MANUAL UI | Click `Update Workflow Status` ➔ `In Progress` | Status updated cleanly | `PASS` |
| **REG-06** | Service Provider | Resolution & Srinath Rajkiran UPI QR Payment | MANUAL UI | Select `Resolved` ➔ Amount `₹599` ➔ UPI QR Code | Displays Srinath Rajkiran QR Code | `PASS` |
| **REG-07** | Taluk Admin | Provider Assignment & Taluk Monitoring | MANUAL UI | Click `Assign Provider` in `app/service/[id].tsx` | Staff assigned & workload +1 | `PASS` |
| **REG-08** | Super Admin | System Management & Configuration | MANUAL UI | Log in as Super Admin `superadmin@homeservice.in` | Full admin access granted | `PASS` |
| **REG-09** | Read-Only Admin | Read-only administrative access check | MANUAL UI | Log in as Read-Only Admin `readonly.admin@homeservice.in` | Write options hidden / disabled | `PASS` |
| **REG-10** | Customer / Staff | Notifications Delivery | MANUAL UI | Navigating to `app/(tabs)/notifications.tsx` | Notifications displayed | `PASS` |
| **REG-11** | Customer / Staff | Photo Attachment View & Zoom | MANUAL UI | Tap image attachment in `app/service/[id].tsx` | Viewer opens cleanly | `PASS` |
| **REG-12** | All Roles | Production Web Build Verification | BUILD VERIFICATION | `npx expo export --platform web --clear` | Static bundle exported to `dist/` | `PASS` |
