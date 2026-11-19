import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyCY2sz1UNEmUrrHgrCxOqSHiYJZ6nm2cF4",
  authDomain: "teamflow-c441c.firebaseapp.com",
  projectId: "teamflow-c441c",
  storageBucket: "teamflow-c441c.firebasestorage.app",
  messagingSenderId: "605163842942",
  appId: "1:605163842942:web:f1b8061dc44a724665172f",
  measurementId: "G-ZZPV5YQ8SM"
};

const app = initializeApp(firebaseConfig);

export const auth = getAuth(app);
export const db = getFirestore(app);
export default app;
