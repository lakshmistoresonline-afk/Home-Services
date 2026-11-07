# 📁 REPOSITORY AUDIT REPORT
**Project**: Thrissur Corporation Citizen Complaint Management System (CCMS / HomeService)  
**Date**: November 7, 2026  
**Auditor**: Senior Solution Architect & Database Architect  

---

## 1. Executive Summary

This repository contains the full-stack Expo (React Native for Web & Mobile) source code for the **Thrissur Corporation Citizen Complaint Management System (CCMS)**. The system enables citizens to lodge municipal complaints/service requests, allows Taluk/Ward Administrators to assign field workers, and provides field staff with tools to accept, track, and resolve grievance requests.

While the core user workflows and UI components are functional, the platform exhibits significant architectural weaknesses in security, data consistency, and background automation.

---

## 2. Architecture & Technology Stack

| Layer | Technology | Version | Location / Config |
| :--- | :--- | :--- | :--- |
| **Framework** | Expo (React Native) | `~57.0.8` | `package.json`, `app.json` |
| **Router** | Expo Router | `~57.0.9` | `app/` directory |
| **UI Web Engine** | React / React Native Web | `19.2.3` / `^0.21.2` | `app.json` (`output: static`) |
| **Database** | Firebase Cloud Firestore | `^12.17.0` | `src/config/firebase.ts` |
| **Authentication** | Firebase Auth | `^12.17.0` | `src/context/auth.tsx` |
| **Admin Seeding** | Firebase Admin SDK | `^14.2.0` | `seed/firebase-utils.js` |
| **Language** | TypeScript | `~6.0.3` | `tsconfig.json` |

---

## 3. Directory Layout Analysis

```
G:\HomeService/
├── app/                      # Expo Router App Directory
│   ├── (auth)/               # Login & Registration screens
│   ├── (tabs)/               # Citizen Bottom Tabs (Home, Bookings, Notifications, Profile)
│   ├── admin/                # Taluk Admin & Field Staff Portal
│   │   └── super/            # Super Admin Management Screens
│   ├── service/              # Service Request Details & Creation ([id].tsx, new.tsx)
│   ├── _layout.tsx           # Root Layout Provider & Navigation Stack
│   └── +html.tsx             # HTML Template for Web Export
├── src/
│   ├── api/                  # API Client Services (Firestore Data Access)
│   │   ├── client.ts         # Data Types, Mappers, Auth Guards
│   │   ├── serviceRequestApi.ts # Complaint CRUD & Firestore Queries
│   │   ├── staffApi.ts       # Staff Management & Status Updates
│   │   ├── workflowApi.ts    # Workflow State Machine Rules
│   │   ├── assignmentEngine.ts # Automated Assignment Engine
│   │   ├── assignmentUtils.ts  # Staff Ranking & Eligibility
│   │   └── auditApi.ts       # Municipal Audit Logging
│   ├── config/               # Firebase Credentials & App Initialization
│   ├── context/              # React Auth Context (`auth.tsx`)
│   ├── components/           # Reusable UI Elements (AppCard, StatusBadge, Timeline, etc.)
│   └── theme/                # Global Theme Colors, Radius & Typography
├── seed/                     # Node.js Database Wipe, Seed & Rules Deployment
│   ├── resetDatabase.js      # Dynamic Firestore Wipe Utility
│   ├── seedFirestore.js     # Seed Generator for Kerala Taluks & Municipal Users
│   └── deployFirestoreRules.js # Admin SDK Firestore Rules Deployment
├── firestore.rules           # Cloud Firestore Security Rules
├── firestore.indexes.json    # Composite Indexes for Query Performance
└── firebase.json             # Firebase Hosting & Database Target Rules
```

---

## 4. Key Findings & Structural Defects

1. **Dual Collection Naming**:
   - Both `serviceRequests` and `complaints` collection names are referenced across codebase modules.
2. **Missing Server-Side Cloud Functions**:
   - Sensitive business logic (status changes, auto-assignments, workload increments) runs directly on the client web bundle rather than in trusted Cloud Functions.
3. **Storage Strategy**:
   - Photos and attachment data are stored as Base64 strings or external Unsplash links instead of Firebase Cloud Storage paths.
4. **Security Vulnerability**:
   - `firestore.rules` is configured with a wildcard `match /{document=**} { allow read, write: if true; }`, exposing all database contents to public reads and writes.

---

## 5. File Inventory Summary

- **Source Code Files**: `472` TypeScript/JSX files.
- **Root Configuration Files**: `package.json`, `app.json`, `firebase.json`, `.firebaserc`, `firestore.rules`, `firestore.indexes.json`.
- **Database Seed Datasets**: `19` JSON templates in `seed/`.
