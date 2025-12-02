import { initializeApp } from "firebase/app";
import { getDatabase } from "firebase/database";

// Your web app's Firebase configuration
const firebaseConfig = {
  apiKey: process.env.REACT_APP_FIREBASE_API_KEY || "AIzaSyDTF37wXZSd5lQnmOxEkhzssxozWUsOTxU",
  authDomain: process.env.REACT_APP_FIREBASE_AUTH_DOMAIN || "khao-ji.firebaseapp.com",
  databaseURL: process.env.REACT_APP_FIREBASE_DATABASE_URL || "https://khao-ji-default-rtdb.firebaseio.com",
  projectId: process.env.REACT_APP_FIREBASE_PROJECT_ID || "khao-ji",
  storageBucket: process.env.REACT_APP_FIREBASE_STORAGE_BUCKET || "khao-ji.firebasestorage.app",
  messagingSenderId: process.env.REACT_APP_FIREBASE_MESSAGING_SENDER_ID || "50219127194",
  appId: process.env.REACT_APP_FIREBASE_APP_ID || "1:50219127194:web:af8028327c59301f61aa23"
};

// Check for override in LocalStorage (Allows you to change keys via the UI if needed)
let finalConfig = firebaseConfig;
try {
    const stored = localStorage.getItem('nexpos_firebase_config');
    if (stored) {
        const parsed = JSON.parse(stored);
        if (parsed.apiKey && parsed.databaseURL) {
            finalConfig = parsed;
            console.log("Loaded Firebase config from storage");
        }
    }
} catch (e) {
    console.error("Failed to load firebase config", e);
}

// Initialize Firebase
const app = initializeApp(finalConfig);

// Initialize Realtime Database
export const db = getDatabase(app);
