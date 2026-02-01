importScripts('https://www.gstatic.com/firebasejs/9.0.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/9.0.0/firebase-messaging-compat.js');

// REPLACE WITH YOUR FIREBASE CONFIG
// You can find this in your Firebase Console -> Project Settings
const firebaseConfig = {
  apiKey: "AIzaSyDOlpyJu7OemOaMimLOFEN5vvrkSjAjhR0",
  authDomain: "practice-ceb72.firebaseapp.com",
  projectId: "practice-ceb72",
  storageBucket: "practice-ceb72.firebasestorage.app",
  messagingSenderId: "362830638404",
  appId: "1:362830638404:web:ea898a30834c32672b7b11",
};

firebase.initializeApp(firebaseConfig);

const messaging = firebase.messaging();

messaging.onBackgroundMessage(function(payload) {
  console.log('[firebase-messaging-sw.js] Received background message ', payload);
  // Customize notification here
  const notificationTitle = payload.notification.title;
  const notificationOptions = {
    body: payload.notification.body,
    icon: '/vite.svg'
  };

  self.registration.showNotification(notificationTitle, notificationOptions);
});
