# Implementation Plan: Firebase Refactoring & API De-Namespacing

This plan addresses the "Can't find variable: api" error in the registration screen and refactors the project to align more closely with the Firebase modular SDK (v9+) by removing the combined `api` singleton and using direct function exports and imports.

## User Review Required

> [!IMPORTANT]
> **Large Scale Refactor**: This change will affect over 20 files and hundreds of lines of code where `api.<method>` is used. I will replace these with direct function imports (e.g., `import { method } from '@/src/api'`).
>
> **Export Pattern Change**: All files in `src/api/*.ts` will be updated to export functions directly (e.g., `export const myFunc = ...`) instead of as properties of a constant object (e.g., `export const myApi = { myFunc: ... }`).

## Proposed Changes

### 1. API Layer Refactoring (`src/api/*.ts`)
- **De-namespace**: Update every file in `src/api/` to use top-level named exports for all functions.
- **Remove Wrappers**: Remove the `authApi`, `complaintApi`, `staffApi`, etc. constant objects.
- **Verify Firebase Consistency**: Ensure all functions use modular SDK imports (`firebase/auth`, `firebase/firestore`, etc.) and the singleton instances from `@/src/config/firebase`.

### 2. Combined API Cleanup (`src/api/index.ts`)
- **Remove `api` Object**: Delete the combined `api` object that re-exports all methods.
- **Export All**: Use `export * from './authApi';` etc. to expose all functions as top-level exports from the API module.

### 3. Context & Hook Updates
- **`src/context/auth.tsx`**: Update to use direct imports (e.g., `logAction`, `getProfile`) and remove `api.` prefixes.

### 4. Application Screen Updates (`app/**/*.tsx`)
- **Fix Registration**: Add missing `checkMobileUnique` import to `app/(auth)/register.tsx`.
- **Global Search & Replace**: Update all occurrences of `api.<method>` to `<method>` and update the corresponding `import { api }` to named imports.

### 5. Firebase Initialization Audit
- **`src/config/firebase.ts`**: Confirm it remains the sole source of initialized `auth`, `db`, and `storage` instances.
- **`src/api/client.ts`**: Maintain the `SecondaryApp` for administrative Auth tasks but ensure it uses the shared config.

## Verification Plan

### Automated Checks
- **Grep Verification**: Ensure no remaining `api.` references exist in the `app/` or `src/` directories.
- **TypeScript Check**: The project should compile without "Unresolved reference" errors (manually verified via `analyze_file`).

### Manual Verification
- **New User Registration**: Verify that account creation works on both Web and Android without the "Can't find variable: api" error.
- **Basic App Flow**: Log in as a Citizen and a Super Admin to ensure the refactored API calls still function correctly.
