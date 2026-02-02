import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getMessaging } from "firebase/messaging";

// Your web app's Firebase configuration
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID
};

// Initialize Firebase
let app;
let auth;
let db;
let messaging;

try {
  // Check if config is present
  if (!firebaseConfig.apiKey) {
    throw new Error("Missing Firebase API Key in environment variables.");
  }
  
  app = initializeApp(firebaseConfig);
  auth = getAuth(app);
  db = getFirestore(app);
  messaging = getMessaging(app);
} catch (error) {
  console.error("Firebase Initialization Error:", error);
  // Show visible error on screen since React might not mount
  if (typeof window !== 'undefined') {
    const errorDiv = document.createElement('div');
    errorDiv.style.color = 'red';
    errorDiv.style.padding = '20px';
    errorDiv.style.fontWeight = 'bold';
    errorDiv.innerHTML = `
      <h1>Configuration Error</h1>
      <p>Failed to initialize Firebase: ${error.message}</p>
      <p>Please check your .env file and ensure VITE_FIREBASE_API_KEY and other variables are set.</p>
    `;
    document.body.prepend(errorDiv);
  }
}

export { auth, db, messaging };
export default app;
