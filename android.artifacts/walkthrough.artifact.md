# Walkthrough - Android APK Download Feature

I have added the "Download Android App" feature to the web version of the MyComplaints application as requested.

## Changes Made

### Web Application UI

#### [MODIFY] [login.tsx](file:///D:/complaintsfirestore/frontend/app/(auth)/login.tsx)
- Added `Linking` and `APK_URL` constant.
- Implemented a "Download Android App" button that is **exclusively visible on the web version** of the landing page.
- The button uses a professional dashed-border style that matches the existing theme and includes the `logo-android` icon from `Ionicons`.
- Tapping the button opens the following URL in a new tab: `https://github.com/lakshmistoresonline-afk/complaintsfirestore/releases/download/v1.0.0/MyComplaints.apk`

## Verification

- **Web-Only Visibility**: The button is conditional and will not appear on native Android or iOS apps.
- **Functionality**: Clicking the button on the web triggers the APK download.
- **Safety**: No existing functionality, routing, or Firebase configuration was touched.

> [!NOTE]
> Confirmation: Only `app/(auth)/login.tsx` was modified during this task.
