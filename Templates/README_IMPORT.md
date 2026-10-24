# Production Excel Import Guide

This folder contains the standardized infrastructure for importing master data and user accounts into the Municipal Complaint Management System.

## Folder Structure

```text
Templates/
├── 01_Wards.xlsx             # Municipal Ward Definitions
├── 02_Departments.xlsx       # Corporation Departments
├── 03_ComplaintCategories.xlsx # Service Categories (mapped to Depts)
├── 04_Staff.xlsx             # Field Resources (Workers)
├── 05_WardAdmins.xlsx        # Administrative Users (Ward Level)
├── 06_SuperAdmins.xlsx       # System Level Administrators
├── excelToFirestore.ts       # Main Import Logic (Node.js/TypeScript)
└── generateTemplates.js      # Utility to recreate .xlsx files
```

## Required Import Order

Data must be imported in this specific order to maintain referential integrity:

1.  **01_Wards**: Base geography for all other entities.
2.  **02_Departments**: Required before Categories or Staff.
3.  **03_ComplaintCategories**: Linked to Departments.
4.  **06_SuperAdmins**: Root administrators.
5.  **05_WardAdmins**: Linked to Wards.
6.  **04_Staff**: Linked to Departments, Categories, and Wards.

## How to Execute the Import

### 1. Prerequisites
Ensure you have the required dependencies installed in the `frontend` root:
```bash
npm install xlsx firebase-admin
```

### 2. Configure Service Account
Ensure your `seed/serviceAccountKey.json` is present. The script uses this for administrative access to Firestore and Auth.

### 3. Run the Import
Execute the script using `ts-node` or `node` (if compiled):
```bash
npx ts-node Templates/excelToFirestore.ts
```

## Template Validation Rules

- **Mobile Number**: **Mandatory** for all users. Must be 10 digits.
- **Wards**: `wardNumber` must be unique.
- **Emails**: Must be unique across all user roles.
- **Linking**: Any `departmentName` used in Staff or Categories must exist exactly as spelled in the `02_Departments` sheet.
- **Account Status**: `isActive` should be `TRUE` for production resources.

## Error Handling

The script performs a **dry-run validation** before writing any data. If any row contains an invalid ward number or non-existent department, the import will stop and report the specific row and column causing the issue.
