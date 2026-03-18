import { initializeApp, getApps } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyAZurxGvHaEzkzT3Fd1W0Ymdb-PLuoCH3U",
  authDomain: "journeyweight-28792.firebaseapp.com",
  projectId: "journeyweight-28792",
  storageBucket: "journeyweight-28792.firebasestorage.app",
  messagingSenderId: "890764972908",
  appId: "1:890764972908:web:085d6cd7502944c5931949",
};

const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0];

export { app };
export const auth = getAuth(app);
export const db = getFirestore(app);
