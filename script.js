// import firebase modules
import { initializeApp } from "firebase/app"; // initializes the Firebase app
import {
  getFirestore,        // access Firestore database
  collection,          // reference a collection in Firestore
  addDoc,              // add a new document to Firestore
  getDocs,             // fetch documents from Firestore
  serverTimestamp      // generate a timestamp on the server
} from "firebase/firestore";

import {
  getStorage,          // access Firebase Storage
  ref,                 // reference a location in storage
  uploadBytes,         // upload file to Firebase Storage
  getDownloadURL       // get a file's public download URL
} from "firebase/storage";

// firebase config (from your project settings)
const firebaseConfig = {
  apiKey: "AIzaSyB81gmgAVn3iC9LM2JrM8EkAADsv7RqEo",
  authDomain: "siza-platform.firebaseapp.com",
  projectId: "siza-platform",
  storageBucket: "siza-platform.appspot.com",
  messagingSenderId: "1019647938747",
  appId: "1:1019647938747:web:5e2bf5f8f8b6fa11d7599e",
  measurementId: "G-WB4MVXMLSH"
};

// initialize firebase services
const app = initializeApp(firebaseConfig); // start the app
const db = getFirestore(app);             // get Firestore instance
const storage = getStorage(app);          // get Storage instance

// test fetching existing pitches from Firestore 
const colRef = collection(db, "testPitches"); // reference the 'testPitches' collection
getDocs(colRef)
  .then((snapshot) => {
    snapshot.docs.forEach(doc => {
      console.log("📄 pitch:", doc.id, doc.data()); // log each pitch
    });
  })
  .catch((err) => {
    console.error("error fetching pitches:", err); // log error
  });

// wait for the page to fully load before accessing DOM
document.addEventListener("DOMContentLoaded", () => {
  const pitchForm = document.getElementById("pitchForm");     // pitch submission form
  const imageInput = document.getElementById("pitchImage");   // image file input
  const videoInput = document.getElementById("pitchVideo");   // video file input

  // if form isn't found, exit early
  if (!pitchForm) return;

  // handle form submission
  pitchForm.addEventListener("submit", async (e) => {
    e.preventDefault(); // prevent page reload

    // get input values
    const title = document.getElementById("pitchTitle").value.trim();
    const shortPitch = document.getElementById("shortPitch").value.trim();
    const description = document.getElementById("pitchDescription").value.trim();
    const financialProjections = document.getElementById("financialProjections").value.trim();

    // validate required fields
    if (!title || !shortPitch || !description || !financialProjections) {
      alert("Please fill in all the fields.");
      return;
    }

    // check if user is logged in (from localStorage)
    const user = JSON.parse(localStorage.getItem("sizaUser"));
    if (!user) {
      alert("⚠ You must be logged in to submit a pitch.");
      return;
    }

    try {
      let imageUrl = ""; // to store uploaded image URL
      let videoUrl = ""; // to store uploaded video URL

      // upload image if selected
      if (imageInput?.files?.length) {
        const file = imageInput.files[0];
        const imageRef = ref(storage, `pitchImages/${Date.now()}_${file.name}`);
        await uploadBytes(imageRef, file); // upload to Firebase Storage
        imageUrl = await getDownloadURL(imageRef); // get public URL
      }

      //  upload video if selected
      if (videoInput?.files?.length) {
        const file = videoInput.files[0];
        const videoRef = ref(storage, `pitchVideos/${Date.now()}_${file.name}`);
        await uploadBytes(videoRef, file);
        videoUrl = await getDownloadURL(videoRef);
      }

      //  log pitch data to console (for debugging)
      console.log("🔥 submitting to Firestore:", {
        title,
        shortPitch,
        description,
        financialProjections,
        imageUrl,
        videoUrl
      });

      //  add pitch to Firestore
      await addDoc(colRef, {
        title,
        shortPitch,
        description,
        financialProjections,
        imageUrl,
        videoUrl,
        entrepreneurID: user.id || "unknown", // add user info from localStorage
        author: user.name || "Unknown",
        email: user.email || "unknown@siza.com",
        timestamp: serverTimestamp()
      });

      //  on success: alert, reset form
      alert("Your pitch has been submitted!");
      pitchForm.reset();
      if (imageInput) imageInput.value = "";
      if (videoInput) videoInput.value = "";
    } catch (err) {
      console.error("Failed to submit pitch:", err);
      alert("Error submitting your pitch. Try again.");
    }
  });
});

//  record NDA acceptance from investor
async function acceptNDA(pitchId) {
  const user = JSON.parse(localStorage.getItem("sizaUser"));
  if (!user) {
    alert("You must be logged in to accept the NDA.");
    return;
  }

  try {
    // add NDA acceptance record to Firestore
    await addDoc(collection(db, "ndaAcceptances"), {
      investorId: user.id || user.uid || "unknown",
      pitchId,
      email: user.email || "",
      acceptedAt: serverTimestamp()
    });
    console.log("NDA acceptance recorded");
  } catch (err) {
    console.error("Error saving NDA acceptance:", err);
    alert("Failed to record NDA acceptance. Try again.");
  }
}
