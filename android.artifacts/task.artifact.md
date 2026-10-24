# Task: Add APK Download Feature to Web

- [x] Add "Download Android App" button to `app/(auth)/login.tsx`
    - [x] Import `Linking` and `Platform` if not already available
    - [x] Implement `handleDownloadAPK` function (inline via `Linking.openURL`)
    - [x] Add the button UI restricted to `Platform.OS === 'web'`
- [x] Verify existing functionality remains unchanged
- [x] Create walkthrough report
