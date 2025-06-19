// ✅ import firebase modules
import { initializeApp } from "firebase/app";
import {
  getFirestore,
  collection,
  addDoc,
  getDocs,
  serverTimestamp
} from "firebase/firestore";

// ✅ firebase config
const firebaseConfig = {
  apiKey: "AIzaSyB81gmgAVn3iC9LM2JrM8EkAADsv7RqEo",
  authDomain: "siza-platform.firebaseapp.com",
  projectId: "siza-platform",
  storageBucket: "siza-platform.appspot.com",
  messagingSenderId: "1019647938747",
  appId: "1:1019647938747:web:5e2bf5f8f8b6fa11d7599e",
  measurementId: "G-WB4MVXMLSH"
};

// ✅ initialize firebase + firestore
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

// ✅ test fetching existing pitches (optional)
const colRef = collection(db, "testPitches");
getDocs(colRef)
  .then((snapshot) => {
    snapshot.docs.forEach(doc => {
      console.log("📄 pitch:", doc.id, doc.data());
    });
  })
  .catch((err) => {
    console.error("❌ error fetching pitches:", err);
  });

// ✅ wait for DOM to load
document.addEventListener("DOMContentLoaded", () => {
  const pitchForm = document.getElementById("pitchForm");

  if (!pitchForm) return;

  pitchForm.addEventListener("submit", async (e) => {
    e.preventDefault();

    const title = document.getElementById("pitchTitle").value.trim();
    const description = document.getElementById("pitchDescription").value.trim();
    const financialProjections = document.getElementById("financialProjections").value.trim();

    if (!title || !description || !financialProjections) {
      alert("Please fill in all the fields.");
      return;
    }

    const user = JSON.parse(localStorage.getItem("sizaUser"));
    if (!user) {
      alert("⚠ You must be logged in to submit a pitch.");
      return;
    }

    try {
      console.log("🔥 submitting to Firestore:", { title, description, financialProjections });

      await addDoc(colRef, {
        title,
        description,
        financialProjections,
        entrepreneurID: user.id || "unknown",
        author: user.name || "Unknown",
        email: user.email || "unknown@siza.com",
        timestamp: serverTimestamp()
      });

      alert("✅ Your pitch has been submitted!");
      pitchForm.reset();
    } catch (err) {
      console.error("❌ Failed to submit pitch:", err);
      alert("Error submitting your pitch. Try again.");
    }
  });
});

