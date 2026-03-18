/* eslint-disable no-undef */
importScripts("https://www.gstatic.com/firebasejs/10.14.1/firebase-app-compat.js");
importScripts("https://www.gstatic.com/firebasejs/10.14.1/firebase-messaging-compat.js");

firebase.initializeApp({
  apiKey: "AIzaSyAZurxGvHaEzkzT3Fd1W0Ymdb-PLuoCH3U",
  authDomain: "journeyweight-28792.firebaseapp.com",
  projectId: "journeyweight-28792",
  storageBucket: "journeyweight-28792.firebasestorage.app",
  messagingSenderId: "890764972908",
  appId: "1:890764972908:web:085d6cd7502944c5931949",
});

const messaging = firebase.messaging();

messaging.onBackgroundMessage((payload) => {
  const { title, body, icon } = payload.notification || {};
  self.registration.showNotification(title || "Milestone Rewards", {
    body: body || "Something happened on your journey!",
    icon: icon || "/icon.png",
    badge: "/icon.png",
  });
});
