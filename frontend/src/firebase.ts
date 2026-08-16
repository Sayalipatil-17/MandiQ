import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";

const firebaseConfig = {
  apiKey: "AIzaSyCOIUQe3uCK1PtZq4u7_1qpWNMsk7FJjMM",
  authDomain: "mandiq-app.firebaseapp.com",
  projectId: "mandiq-app",
  storageBucket: "mandiq-app.firebasestorage.app",
  messagingSenderId: "696167815335",
  appId: "1:696167815335:web:e9d1fa3c67f0d1560a2382",
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
