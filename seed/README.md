# Municipal CMS Seeding Infrastructure

This directory contains production-ready configuration and sample testing data for the Municipal Complaint Management System. The scripts are implemented in **CommonJS JavaScript** for standalone execution.

## Prerequisites
1.  **Node.js 24.x** installed.
2.  **serviceAccountKey.json** must be present in this directory.
    - Obtain this from the Firebase Console: Project Settings > Service Accounts > Generate new private key.

## Data Files
Exhaustive master data (Wards, Roles, Categories) and realistic sample data (Users, Complaints, Timelines) are provided in JSON format.

## Scripts
- `firebase-utils.js`: Centralized Firebase Admin initialization.
- `seedFirestore.js`: High-performance seeder using **Firestore BulkWriter**.
- `resetDatabase.js`: Comprehensive purge of Firestore (recursive) and Firebase Auth users.

## How to Run
These scripts can be executed directly via Node.js or through the `npm` scripts in the root directory.

### 1. Full Database & Auth Reset
```bash
node seed/resetDatabase.js
# OR
npm run reset
```

### 2. Standardized Database Seed
```bash
node seed/seedFirestore.js
# OR
npm run seed
```

### 3. Reset and Seed (Clean Slate)
```bash
npm run reset-and-seed
```

## Security Warning
The `serviceAccountKey.json` contains full administrative access to your Firebase project. **NEVER** commit this file to version control. It is automatically ignored if added to `.gitignore`.

## Synchronization
The `seedFirestore.js` script automatically synchronizes the following:
- **`metadata/app`**: Consolidated application settings used by the client-side `metadataApi`.
- **`metadata/counters`**: Initialized with the current counts of staff and complaints to prevent ID collisions.
- **Workflow Transitions**: Seeded into the `settings/workflow` document.
- **Wards**: Complete list of 56 Thrissur Corporation wards.

## Default Credentials
All seeded users are created with the following default passwords:
- **Super Admin**: `Super@123`
- **Read-Only Super Admin**: `Audit@123`
- **Ward Admin**: `Admin@123`
- **Staff**: `Staff@123`
- **Citizen**: `User@123`
