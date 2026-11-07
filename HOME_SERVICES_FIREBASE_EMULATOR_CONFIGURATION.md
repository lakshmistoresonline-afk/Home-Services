# ⚙️ HOME SERVICES APPLICATION — FIREBASE EMULATOR CONFIGURATION REPORT

**Project**: Home Services Application  
**Repository**: https://github.com/lakshmistoresonline-afk/Home-Services.git  
**Firebase Staging Project**: home-services-8789c  
**Date**: November 7, 2026  
**Auditor**: Infrastructure & DevOps Specialist  

---

## 1. Verified `firebase.json` Emulator Specification

```json
{
  "firestore": {
    "database": "(default)",
    "location": "asia-south1",
    "rules": "firestore.rules",
    "indexes": "firestore.indexes.json"
  },
  "hosting": {
    "site": "home-services-8789c",
    "public": "dist",
    "cleanUrls": true,
    "trailingSlash": false,
    "ignore": [
      "firebase.json",
      "**/.*",
      "**/node_modules/**"
    ],
    "redirects": [
      {
        "source": "/",
        "destination": "/login",
        "type": 302
      }
    ],
    "rewrites": [
      {
        "source": "**",
        "destination": "/index.html"
      }
    ]
  },
  "emulators": {
    "auth": { "port": 9099 },
    "functions": { "port": 5001 },
    "firestore": { "port": 8080 },
    "storage": { "port": 9199 },
    "ui": { "enabled": true, "port": 4000 }
  }
}
```

---

## 2. Emulator Ports & Rules Binding Matrix

| Emulator Module | Configured Port | Targeted Rules / Source File | Project Isolation Guard |
| :--- | :--- | :--- | :--- |
| **Authentication** | `9099` | In-memory auth emulator | Isolated test project |
| **Firestore** | `8080` | [`firestore.rules`](file:///G:/HomeService/firestore.rules) | Isolated test project |
| **Storage** | `9199` | [`storage.rules`](file:///G:/HomeService/storage.rules) | Isolated test project |
| **Functions** | `5001` | [`functions/lib/index.js`](file:///G:/HomeService/functions/lib/index.js) | Isolated test project |
| **Emulator UI** | `4000` | Local dashboard UI | Isolated test project |
