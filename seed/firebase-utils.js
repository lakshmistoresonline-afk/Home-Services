const { initializeApp, cert, getApps } = require("firebase-admin/app");
const { getFirestore } = require("firebase-admin/firestore");
const { getAuth } = require("firebase-admin/auth");
const { getStorage } = require("firebase-admin/storage");
const path = require("path");

const serviceAccountPath = path.join(__dirname, "serviceAccountKey.json");
const serviceAccount = require(serviceAccountPath);

if (getApps().length === 0) {
    initializeApp({
        credential: cert(serviceAccount)
    });
}

const db = getFirestore();
const auth = getAuth();
const storage = getStorage();

module.exports = {
    db,
    auth,
    storage,
    projectId: serviceAccount.project_id,
    serviceAccountPath
};
