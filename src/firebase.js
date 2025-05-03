import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";  // Add this import

const firebaseConfig = {
  apiKey: "AIzaSyBmFGltIdddTXF-XSlJQU8wj9dpaMq96mI",
  authDomain: "money-5e423.firebaseapp.com",
  projectId: "money-5e423",
  storageBucket: "money-5e423.firebasestorage.app",
  messagingSenderId: "1340066990",
  appId: "1:1340066990:web:40a1a1e786116bc2cb713f",
  measurementId: "G-4N3D6RH5F0"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);  // Initialize Firestore

export { db };  // Export Firestore instance