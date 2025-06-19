// ✅ import firebase modules
import { initializeApp } from "firebase/app";
import {
  getFirestore,
  collection,
  addDoc,
  getDocs,
  serverTimestamp
} from "firebase/firestore";

import {
  getStorage,
  ref,
  uploadBytes,
  getDownloadURL
} from "firebase/storage";

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

// ✅ initialize firebase + firestore + storage
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const storage = getStorage(app);

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
  const imageInput = document.getElementById("pitchImage"); // file input for image
  const videoInput = document.getElementById("pitchVideo"); // file input for video

  if (!pitchForm) return;

  pitchForm.addEventListener("submit", async (e) => {
    e.preventDefault();

    const title = document.getElementById("pitchTitle").value.trim();
    const shortPitch = document.getElementById("shortPitch").value.trim();
    const description = document.getElementById("pitchDescription").value.trim();
    const financialProjections = document.getElementById("financialProjections").value.trim();

    if (!title || !shortPitch || !description || !financialProjections) {
      alert("Please fill in all the fields.");
      return;
    }

    const user = JSON.parse(localStorage.getItem("sizaUser"));
    if (!user) {
      alert("⚠ You must be logged in to submit a pitch.");
      return;
    }

    try {
      let imageUrl = "";
      let videoUrl = "";

      if (imageInput?.files?.length) {
        const file = imageInput.files[0];
        const imageRef = ref(storage, `pitchImages/${Date.now()}_${file.name}`);
        await uploadBytes(imageRef, file);
        imageUrl = await getDownloadURL(imageRef);
      }

      if (videoInput?.files?.length) {
        const file = videoInput.files[0];
        const videoRef = ref(storage, `pitchVideos/${Date.now()}_${file.name}`);
        await uploadBytes(videoRef, file);
        videoUrl = await getDownloadURL(videoRef);
      }

      console.log("🔥 submitting to Firestore:", { title, shortPitch, description, financialProjections, imageUrl, videoUrl });

      await addDoc(colRef, {
        title,
        shortPitch,
        description,
        financialProjections,
        imageUrl,
        videoUrl,
        entrepreneurID: user.id || "unknown",
        author: user.name || "Unknown",
        email: user.email || "unknown@siza.com",
        timestamp: serverTimestamp()
      });

      alert("✅ Your pitch has been submitted!");
      pitchForm.reset();
      if (imageInput) imageInput.value = "";
      if (videoInput) videoInput.value = "";
    } catch (err) {
      console.error("❌ Failed to submit pitch:", err);
      alert("Error submitting your pitch. Try again.");
    }
  });
});

// when NDA accepted
async function acceptNDA(pitchId) {
  const user = JSON.parse(localStorage.getItem("sizaUser"));
  if (!user) {
    alert("You must be logged in to accept the NDA.");
    return;
  }

  try {
    await addDoc(collection(db, "ndaAcceptances"), {
      investorId: user.id || user.uid || "unknown",
      pitchId,
      email: user.email || "",
      acceptedAt: serverTimestamp()
    });
    console.log("✅ NDA acceptance recorded");
  } catch (err) {
    console.error("❌ Error saving NDA acceptance:", err);
    alert("Failed to record NDA acceptance. Try again.");
  }
}
