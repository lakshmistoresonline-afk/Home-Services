export const firebaseConfig = {
  apiKey: process.env.EXPO_PUBLIC_FIREBASE_API_KEY || "AIzaSyDV0pt5j6blSKv7_HVe46ew_DHl_fplszA",
  authDomain: process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN || "mycomplaintstcr.firebaseapp.com",
  projectId: process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID || "mycomplaintstcr",
  storageBucket: process.env.EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET || "mycomplaintstcr.firebasestorage.app",
  messagingSenderId: process.env.EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID || "443682764229",
  appId: process.env.EXPO_PUBLIC_FIREBASE_APP_ID || "1:443682764229:web:09f3d5fd4edcc7027507ac"
};
