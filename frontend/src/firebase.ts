// Import the functions you need from the SDKs you need
import { initializeApp } from "firebase/app";
import { getAnalytics, logEvent } from "firebase/analytics";
// TODO: Add SDKs for Firebase products that you want to use
// https://firebase.google.com/docs/web/setup#available-libraries

// Your web app's Firebase configuration
// For Firebase JS SDK v7.20.0 and later, measurementId is optional
const firebaseConfig = {
  apiKey: "AIzaSyCY80SnN2_AFigVFcexIbaoVHkBL7CuNx0",
  authDomain: "mandiq-2f585.firebaseapp.com",
  projectId: "mandiq-2f585",
  storageBucket: "mandiq-2f585.firebasestorage.app",
  messagingSenderId: "349134390368",
  appId: "1:349134390368:web:13d87c9efcdab2b0d66f05",
  measurementId: "G-W282MSE3C4"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
export const analytics = getAnalytics(app);
export { logEvent };