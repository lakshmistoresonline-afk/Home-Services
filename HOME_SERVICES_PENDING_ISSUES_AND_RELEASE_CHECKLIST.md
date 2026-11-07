# 📋 HOME SERVICES APPLICATION — RELEASE CHECKLIST & PENDING ISSUES

**Project**: Home Services Application  
**Repository**: https://github.com/lakshmistoresonline-afk/Home-Services.git  
**Firebase Staging Project**: home-services-8789c  
**Date**: November 7, 2026  

---

## Production Release Checklist

- [x] Firestore security rules deployed to staging (`ruleset 10fbb3f6`).
- [x] Storage rules remediated with explicit PDF MIME comparison (`contentType == 'application/pdf'`).
- [x] Cloud Functions compiled cleanly (`npm run build` in `functions/`).
- [x] Collision-safe Service Request ID loop implemented in `functions/src/requests.ts`.
- [x] Production web export compiled cleanly (`npx expo export --platform web --clear`).
- [ ] Deploy Cloud Functions to production via `firebase deploy --only functions` upon final release.
- [ ] Deploy Storage Rules to production via `firebase deploy --only storage` upon final release.
- [ ] Deploy Hosting web bundle from `dist/` via `firebase deploy --only hosting` upon final release.
