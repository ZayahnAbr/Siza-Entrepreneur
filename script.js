import { initializeApp } from "https://www.gstatic.com/firebasejs/10.4.0/firebase-app.js";
import {
  getFirestore,
  collection,
  addDoc,
  setDoc,
  doc,
  serverTimestamp,
  getDoc
} from "https://www.gstatic.com/firebasejs/10.4.0/firebase-firestore.js";
import {
  getAuth,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  GoogleAuthProvider,
  signInWithPopup
} from "https://www.gstatic.com/firebasejs/10.4.0/firebase-auth.js";
import {
  getStorage,
  ref,
  uploadBytes,
  getDownloadURL
} from "https://www.gstatic.com/firebasejs/10.4.0/firebase-storage.js";

/* -------------------------
   Firebase Configuration
-------------------------- */
const firebaseConfig = {
  apiKey: "AIzaSyB81g5mgAVn3iC9LM2JrM8EkAADsv7RqEo",
  authDomain: "siza-platform.firebaseapp.com",
  projectId: "siza-platform",
  storageBucket: "siza-platform.firebasestorage.app",
  messagingSenderId: "1019647938747",
  appId: "1:1019647938747:web:5e2bf5f8f8b6fa11d7599e",
  measurementId: "G-WB4MVXMLSH"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const storage = getStorage(app);
const auth = getAuth(app);
const provider = new GoogleAuthProvider();

/* -------------------------
   Helpers
-------------------------- */
async function fetchUserData(uid) {
  try {
    const snap = await getDoc(doc(db, "users", uid));
    return snap.exists() ? snap.data() : null;
  } catch (err) {
    console.error("Error fetching user data:", err);
    return null;
  }
}

async function saveUserToFirestore(user) {
  try {
    await setDoc(doc(db, "users", user.id), {
      name: user.name,
      email: user.email,
      accountType: user.accountType,
      profileComplete: false,
      createdAt: serverTimestamp()
    });
  } catch (err) {
    console.error("Error saving user:", err);
  }
}

function storeUserLocally(user) {
  localStorage.setItem("sizaUser", JSON.stringify(user));
}

function getStoredUser() {
  return JSON.parse(localStorage.getItem("sizaUser"));
}

/* -------------------------
   Auth Functions
-------------------------- */
async function signup(email, password, name, accountType) {
  const userCredential = await createUserWithEmailAndPassword(auth, email, password);
  const user = userCredential.user;
  const userData = {
    id: user.uid,
    name,
    email: user.email,
    accountType
  };
  await saveUserToFirestore(userData);
  storeUserLocally(userData);
  return user;
}

async function login(email, password) {
  const userCredential = await signInWithEmailAndPassword(auth, email, password);
  const user = userCredential.user;
  const userData = await fetchUserData(user.uid);
  storeUserLocally({
    id: user.uid,
    name: userData?.name || user.displayName || "Unknown",
    email: user.email,
    accountType: userData?.accountType || "unknown",
    profileComplete: userData?.profileComplete || false
  });
  return userData;
}

async function signInWithGoogle() {
  const result = await signInWithPopup(auth, provider);
  const user = result.user;
  let userData = await fetchUserData(user.uid);

  if (!userData) {
    userData = {
      id: user.uid,
      name: user.displayName || "Unknown",
      email: user.email,
      accountType: "unknown",
      profileComplete: false
    };
    await saveUserToFirestore(userData);
  }
  storeUserLocally(userData);
  return userData;
}

async function logout() {
  await signOut(auth);
  localStorage.removeItem("sizaUser");
  window.location.href = "home.html";
}

/* -------------------------
   Event Listeners
-------------------------- */
document.addEventListener("DOMContentLoaded", () => {

  // ===== Display username dynamically =====
  const usernameSpan = document.getElementById("username");
  const storedUser = getStoredUser();
  if (storedUser && usernameSpan) {
    usernameSpan.textContent = storedUser.name || "User";
  }

  // Optional: update if auth state changes
  onAuthStateChanged(auth, user => {
    if (user && usernameSpan) {
      const updatedUser = getStoredUser();
      usernameSpan.textContent = updatedUser?.name || "User";
    }
  });

  // ===== Login form =====
  const loginForm = document.getElementById("loginForm");
  loginForm?.addEventListener("submit", async (e) => {
    e.preventDefault();
    const email = document.getElementById("loginEmail").value.trim();
    const password = document.getElementById("loginPassword").value;

    try {
      const userData = await login(email, password);
      if (!userData) return alert("User not found!");
      window.location.href = userData.accountType === "investor"
        ? `investor-dashboard.html?uid=${userData.id}`
        : `entrepreneur-dashboard.html?uid=${userData.id}`;
    } catch (err) {
      alert("Login failed: " + err.message);
    }
  });

  // ===== Google login =====
  const googleBtn = document.getElementById("googleSignInBtn");
  googleBtn?.addEventListener("click", async () => {
    try {
      const userData = await signInWithGoogle();
      window.location.href = userData.accountType === "investor"
        ? `investor-dashboard.html?uid=${userData.id}`
        : `entrepreneur-dashboard.html?uid=${userData.id}`;
    } catch (err) {
      alert("Google login failed: " + err.message);
    }
  });

  // ===== Signup form =====
  const signupForm = document.getElementById("signupForm");
  signupForm?.addEventListener("submit", async (e) => {
    e.preventDefault();
    const name = document.getElementById("signupName").value.trim();
    const email = document.getElementById("signupEmail").value.trim();
    const password = document.getElementById("signupPassword").value.trim();
    const accountType = document.getElementById("accountType")?.value;

    if (!name || !email || !password || !accountType) {
      return alert("Please fill in all fields.");
    }

    try {
      const user = await signup(email, password, name, accountType);
      window.location.href = accountType === "investor"
        ? `edit-investor.html?uid=${user.uid}`
        : `edit-entrepreneur.html?uid=${user.uid}`;
    } catch (err) {
      alert("Signup failed: " + err.message);
    }
  });

});

/* -------------------------
   Profile Editing
-------------------------- */
export async function saveProfile(userId, data, files = {}) {
  const updateData = { profileComplete: true, ...data };

  for (const key in files) {
    if (!files[key]) continue;
    const fileRef = ref(storage, `${key}/${userId}_${Date.now()}_${files[key].name}`);
    await uploadBytes(fileRef, files[key]);
    updateData[key] = await getDownloadURL(fileRef);
  }

  await setDoc(doc(db, "users", userId), updateData, { merge: true });
  const stored = getStoredUser();
  storeUserLocally({ ...stored, ...updateData });
  return updateData;
}

/* -------------------------
   Pitch Submission
-------------------------- */
export async function submitPitch(data, files = {}) {
  const user = getStoredUser();
  if (!user) throw new Error("You must be logged in to submit a pitch.");

  const pitchData = {
    ...data,
    entrepreneurID: user.id,
    author: user.name,
    email: user.email,
    timestamp: serverTimestamp()
  };

  for (const key in files) {
    if (!files[key]) continue;
    const fileRef = ref(storage, `${key}/${Date.now()}_${files[key].name}`);
    await uploadBytes(fileRef, files[key]);
    pitchData[key] = await getDownloadURL(fileRef);
  }

  await addDoc(collection(db, "testPitches"), pitchData);
  return pitchData;
}

/* -------------------------
   NDA Acceptance
-------------------------- */
export async function acceptNDA(pitchId) {
  const user = getStoredUser();
  if (!user) throw new Error("You must be logged in to accept the NDA.");

  await addDoc(collection(db, "ndaAcceptances"), {
    investorId: user.id,
    pitchId,
    email: user.email,
    acceptedAt: serverTimestamp()
  });
}
