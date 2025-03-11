// Import the functions you need from the SDKs you need
import { initializeApp } from "firebase/app";
import { getAnalytics } from "firebase/analytics";
// TODO: Add SDKs for Firebase products that you want to use
// https://firebase.google.com/docs/web/setup#available-libraries

// Your web app's Firebase configuration
// For Firebase JS SDK v7.20.0 and later, measurementId is optional
const firebaseConfig = {
  apiKey: "AIzaSyCeEwGPEtfBM23t4OVQGrD9MTF6TjRi1u0",
  authDomain: "dronenglb.firebaseapp.com",
  projectId: "dronenglb",
  storageBucket: "dronenglb.firebasestorage.app",
  messagingSenderId: "896131806649",
  appId: "1:896131806649:web:a9def7530a4ddd975ab268",
  measurementId: "G-NVMJMDXDLK"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const analytics = getAnalytics(app);
