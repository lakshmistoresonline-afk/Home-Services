# Implementation Plan - Add Android APK Download Button to Web Landing Page

This plan describes the addition of a "Download Android App" button to the web version of the MyComplaints application landing page.

## User Review Required

> [!IMPORTANT]
> The button will only be visible on the web version of the application. It will link to the GitHub release APK URL provided.

- **APK URL**: `https://github.com/lakshmistoresonline-afk/complaintsfirestore/releases/download/v1.0.0/MyComplaints.apk`
- **Location**: Landing Page (`app/(auth)/login.tsx`), below the registration link.

## Proposed Changes

### Web Application UI

#### [MODIFY] [login.tsx](file:///D:/complaintsfirestore/frontend/app/(auth)/login.tsx)
- Import `Platform` and `Linking` from `react-native`.
- Add a "Download Android App" button that only renders on `Platform.OS === 'web'`.
- The button will use the existing `Ionicons` library with the `logo-android` icon.
- Styled to match the existing professional UI theme (using `colors.border` and `colors.textSecondary` for a subtle yet professional look).
- Positioned at the bottom of the login card, ensuring it doesn't disturb the primary login/register flow.

## Verification Plan

### Manual Verification
- **Web Verification**: Open the web application and confirm the "Download Android App" button is visible and clicking it opens the APK download in a new tab.
- **Android/iOS Verification**: Ensure the button is **not** visible on native builds to maintain a clean mobile experience.
- **Functional Check**: Verify that the login and registration flows remain fully functional.
