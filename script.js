import { initializeApp } from "https://www.gstatic.com/firebasejs/10.4.0/firebase-app.js";

import {
  getFirestore,
  collection,
  addDoc,
  setDoc,
  doc,
  serverTimestamp,
  getDoc,
  getDocs,
  query,
  orderBy,
} from "https://www.gstatic.com/firebasejs/10.4.0/firebase-firestore.js";

import {
  getAuth,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  GoogleAuthProvider,
  signInWithPopup,
  updateProfile,
} from "https://www.gstatic.com/firebasejs/10.4.0/firebase-auth.js";

import {
  getStorage,
  ref,
  uploadBytes,
  getDownloadURL,
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
   Small helpers
-------------------------- */
const $ = (sel) => document.querySelector(sel);
const qs = (id) => document.getElementById(id);
const param = (name) => new URLSearchParams(location.search).get(name);
const DEFAULT_AVATAR = "https://cdn.jsdelivr.net/gh/alohe/avatars/png/vibrent_6.png";

function getStoredUser() {
  try {
    const raw = localStorage.getItem("sizaUser");
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}
function storeUserLocally(user) {
  const prev = getStoredUser();
  // If switching accounts, replace; otherwise merge
  if (!prev || prev.id !== user.id) {
    localStorage.setItem("sizaUser", JSON.stringify(user));
  } else {
    localStorage.setItem("sizaUser", JSON.stringify({ ...prev, ...user }));
  }
}

async function fetchUserData(uid) {
  try {
    const snap = await getDoc(doc(db, "users", uid));
    return snap.exists() ? snap.data() : null;
  } catch (err) {
    console.error("Error fetching user data:", err);
    return null;
  }
}

/* === Global loader helpers === */
function ensureGlobalLoader() {
  if (document.getElementById("appLoader")) return;
  const el = document.createElement("div");
  el.id = "appLoader";
  el.innerHTML = '<div class="spinner" aria-label="Loading"></div>';
  document.body.appendChild(el);
}
function showGlobalLoader(on = true) {
  ensureGlobalLoader();
  const el = document.getElementById("appLoader");
  if (el) el.style.display = on ? "grid" : "none";
}

/* === Button loading wrapper === */
async function withButtonLoading(btn, fn) {
  if (btn) { btn.classList.add("is-loading"); btn.disabled = true; }
  try {
    showGlobalLoader(true);
    return await fn();
  } finally {
    showGlobalLoader(false);
    if (btn) { btn.classList.remove("is-loading"); btn.disabled = false; }
  }
}

/* -------------------------
   FIRST-CLASS AVATAR SUPPORT
-------------------------- */
function applyAvatarImages(userLike) {
  // Navbar avatar (show only when a custom pic exists)
  const navAvatar = qs("navAvatar");
  if (navAvatar) {
    if (userLike?.profilePic) {
      navAvatar.src = userLike.profilePic;
      navAvatar.alt = (userLike?.name || "User") + " avatar";
      navAvatar.style.display = "inline-block";
    } else {
      navAvatar.style.display = "none";
    }
  }
  // Any .profile-img on the page
  document.querySelectorAll("img.profile-img").forEach((img) => {
    if (img.dataset.static === "true") return;
    img.src = userLike?.profilePic || DEFAULT_AVATAR;
  });
}

/* -------------------------
   Cloudinary (free) uploads
-------------------------- */
const CLOUDINARY_CLOUD_NAME = "dxjnbf2ds";        // ✅ your cloud name
const CLOUDINARY_UPLOAD_PRESET = "siza_unsigned"; // ✅ your unsigned preset

async function uploadToCloudinary(file, folder = "siza/profilePics") {
  if (!file) return null;
  if (!CLOUDINARY_CLOUD_NAME || !CLOUDINARY_UPLOAD_PRESET) {
    throw new Error("Cloudinary config missing (cloud name / unsigned preset).");
  }
  const url = `https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD_NAME}/auto/upload`;
  const form = new FormData();
  form.append("file", file);
  form.append("upload_preset", CLOUDINARY_UPLOAD_PRESET);
  form.append("folder", folder);

  const res = await fetch(url, { method: "POST", body: form });
  if (!res.ok) {
    const txt = await res.text().catch(() => "");
    throw new Error("Cloudinary upload failed: " + (txt || res.status));
  }
  const data = await res.json();
  return data.secure_url; // public HTTPS URL
}

/* -------------------------
   Auth functions
-------------------------- */
async function saveUserToFirestore(user) {
  try {
    await setDoc(
      doc(db, "users", user.id),
      {
        name: user.name,
        email: user.email,
        accountType: user.accountType, // "entrepreneur" | "investor" | "unknown"
        plan: "basic",
        goldVerified: false,
        profileComplete: user.profileComplete ?? false,
        createdAt: serverTimestamp(),
      },
      { merge: true }
    );
  } catch (err) {
    console.error("Error saving user:", err);
  }
}

async function signup(email, password, name, accountType) {
  const cred = await createUserWithEmailAndPassword(auth, email, password);
  const user = cred.user;
  try { await updateProfile(user, { displayName: name }); } catch {}
  const userData = { id: user.uid, name, email: user.email, accountType, profileComplete: false };
  await saveUserToFirestore(userData);
  storeUserLocally(userData);
  return user;
}

async function login(email, password) {
  const cred = await signInWithEmailAndPassword(auth, email, password);
  const user = cred.user;
  const userData = await fetchUserData(user.uid);
  const storeData = {
    id: user.uid,
    name: userData?.name || user.displayName || "Unknown",
    email: user.email,
    accountType: userData?.accountType || "unknown",
    profileComplete: userData?.profileComplete ?? false,
    bio: userData?.bio || "",
    focus: userData?.focus || "",
    location: userData?.location || "",
    budget: userData?.budget || "",
    industry: userData?.industry || "",
    website: userData?.website || "",
    pitchTitle: userData?.pitchTitle || "",
    fundingGoal: userData?.fundingGoal || "",
    profilePic: userData?.profilePic || "",
    plan: userData?.plan || "basic",
    goldVerified: userData?.goldVerified ?? false,
  };
  storeUserLocally(storeData);
  return storeData;
}

async function signInWithGoogle() {
  const result = await signInWithPopup(auth, provider);
  const user = result.user;

  // Fetch or create the Firestore user
  let userData = await fetchUserData(user.uid);
  if (!userData) {
    userData = {
      id: user.uid,
      name: user.displayName || "Unknown",
      email: user.email,
      accountType: "unknown",
      plan: "basic",
      goldVerified: false,
      profileComplete: false,
    };
    await setDoc(doc(db, "users", user.uid), userData, { merge: true });
  }

  // Ensure we have a role
  const { userLike } = await ensureAccountType(userData);

  storeUserLocally(userLike);
  return userLike; // includes a valid accountType now
}

async function logout() {
  try { await signOut(auth); } catch {}
  localStorage.removeItem("sizaUser");
  window.location.replace("index.html");
}

/* -------------------------
   Writers (Cloudinary)
-------------------------- */
async function saveProfile(userId, data, files = {}) {
  const updateData = { profileComplete: true, ...data };

  for (const [key, file] of Object.entries(files)) {
    if (file instanceof File) {
      const url = await uploadToCloudinary(file, `siza/${key}/${userId}`);
      updateData[key] = url;
    }
  }

  await setDoc(doc(db, "users", userId), updateData, { merge: true });

  const cached = getStoredUser() || { id: userId };
  const merged = { ...cached, ...updateData, id: userId };
  storeUserLocally(merged);
  applyAvatarImages(merged);

  return updateData;
}

async function submitPitch(data, files = {}) {
  const fbUser = auth.currentUser;
  if (!fbUser) throw new Error("You must be logged in to submit a pitch.");

  const user = getStoredUser(); // for name/email display
  const pitchData = {
    ...data,
    entrepreneurID: fbUser.uid,         // use Auth UID here
    author: user?.name || fbUser.email,
    email: user?.email || fbUser.email,
    timestamp: serverTimestamp(),
  };

  // ... your Cloudinary uploads ...
  await addDoc(collection(db, "testPitches"), pitchData);
}


/* -------------------------
   NDA record (optional)
-------------------------- */
async function acceptNDA(pitchId) {
  const user = getStoredUser();
  if (!user) throw new Error("You must be logged in to accept the NDA.");
  await addDoc(collection(db, "ndaAcceptances"), {
    investorId: user.id,
    pitchId,
    email: user.email,
    acceptedAt: serverTimestamp(),
  });
}

/* -------------------------
   Route guard
-------------------------- */
function requireAuth(roles = []) {
  onAuthStateChanged(auth, async (user) => {
    if (!user) {
      localStorage.removeItem("sizaUser");
      window.location.href = "index.html";
      return;
    }
    if (roles.length) {
      const data = (await fetchUserData(user.uid)) || getStoredUser();
      const role = data?.accountType || "unknown";
      if (!roles.includes(role)) {
        alert("You do not have access to this page.");
        window.location.href = "index.html";
      }
    }
  });
}

/* -------------------------
   Render helpers
-------------------------- */
function setText(id, value, fallback = "—") {
  const el = qs(id);
  if (el) el.textContent = value || fallback;
}
function setSrc(id, url, fallback = "") {
  const el = qs(id);
  if (!el) return;
  el.src = url || fallback || el.src || DEFAULT_AVATAR;
}
function fileLink(id, url, label) {
  const el = qs(id);
  if (!el) return;
  el.innerHTML = url ? `<a href="${url}" target="_blank" rel="noopener">${label || "Open"}</a>` : "—";
}
function show(el, on = true) {
  if (el) el.style.display = on ? "" : "none";
}
async function loadUserDoc(uid) {
  try {
    const snap = await getDoc(doc(db, "users", uid));
    return snap.exists() ? snap.data() : null;
  } catch (e) {
    const cached = getStoredUser();
    if (cached && cached.id === uid) return cached;
    throw e;
  }
}
function showSkeleton(on) {
  const sk = $(".profile-skeleton");
  const main = $(".profile-main");
  show(sk, !!on);
  show(main, !on);
}

/* -------------------------
   Navbar links + avatar
-------------------------- */
function updateNavForUser(u) {
  const navDashboard = qs("nav-dashboard");
  const navProfile   = qs("nav-profile");
  const navEdit      = qs("nav-edit");
  const navLogout    = qs("nav-logout");
  if (!navDashboard || !navProfile || !navEdit || !navLogout) return;

  if (!u) {
    ["nav-dashboard","nav-profile","nav-edit","nav-logout"].forEach((id) => {
      const el = qs(id);
      if (el) el.style.display = "none";
    });
    return;
  }

  const isInvestor = u.accountType === "investor";
  const dashUrl = isInvestor ? "investor-dashboard.html" : "entrepreneur-dashboard.html";
  const viewUrl = isInvestor ? "investor.html" : "entrepreneur.html";
  const editUrl = isInvestor ? "edit-investor.html" : "edit-entrepreneur.html";

  navDashboard.href = `${dashUrl}?uid=${encodeURIComponent(u.id)}`;

  if (u.profileComplete) {
    // Show: My Profile + Edit Profile
    navProfile.textContent = "My Profile";
    navProfile.href = `${viewUrl}?uid=${encodeURIComponent(u.id)}`;
    navProfile.style.display = "";
    navEdit.href = `${editUrl}?uid=${encodeURIComponent(u.id)}`;
    navEdit.style.display = "";
  } else {
    // Show only: Finish Profile (hide Edit Profile to avoid duplicate)
    navProfile.textContent = "Finish Profile";
    navProfile.href = `${editUrl}?uid=${encodeURIComponent(u.id)}`;
    navProfile.style.display = "";
    navEdit.style.display = "none";
  }

  navDashboard.style.display = "";
  navLogout.style.display    = "";

  applyAvatarImages(u);
}

/* -------------------------
   Pitch form wiring
-------------------------- */
function wirePitchForm() {
  // Support either #pitchForm or #submitPitchForm
  const form = qs("pitchForm") || qs("submitPitchForm");
  if (!form) return;

  // Try multiple IDs so you don’t have to rename your HTML
  const el = (idArr) => idArr.map(qs).find(Boolean);

  const titleEl   = el(["pitchTitle", "pfTitle", "entPitchTitle"]);
  const shortEl   = el(["pitchShort", "pfShort", "shortPitch"]);
  const projEl    = el(["pitchFinancials", "pfFinancials", "financialProjections"]);
  const industryEl= el(["pitchIndustry", "entIndustry", "industry"]);
  const fundingEl = el(["pitchFundingGoal", "entFundingGoal", "fundingGoal"]);
  const deckIn    = el(["pitchDeck", "entPitchDeck", "pfDeck"]);
  const videoIn   = el(["pitchVideo", "entPitchVideo", "pfVideo"]);

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const btn = e.submitter || form.querySelector('button[type="submit"]');
    const user = getStoredUser();
    if (!user) return alert("Please log in first.");

    // Normalize fields to what the dashboard expects
    const data = {
      title: (titleEl?.value || "").trim(),
      shortPitch: (shortEl?.value || "").trim(),
      financialProjections: (projEl?.value || "").trim(),
      industry: (industryEl?.value || "").trim(),
      fundingGoal: (fundingEl?.value || "").trim(),
    };

    // Very light validation so you don’t submit empty cards
    if (!data.title) return alert("Please add a pitch title.");
    if (!data.shortPitch) data.shortPitch = "—";

    const files = {
      pitchDeck: deckIn?.files?.[0] || null,
      pitchVideo: videoIn?.files?.[0] || null,
    };

    try {
      await withButtonLoading(btn, () => submitPitch(data, files));
      alert("Pitch submitted successfully!");
      form.reset();
      // Optional: reload grid if you’re on the investor page too
      if (qs("pitchGrid")) loadPitchesIntoGrid();
    } catch (err) {
      console.error(err);
      alert("Could not submit pitch: " + (err?.message || err));
    }
  });
}



/* -------------------------
   Investor dashboard grid
-------------------------- */
async function loadPitchesIntoGrid() {
  const grid = qs("pitchGrid");
  if (!grid) return;

  grid.innerHTML = `<div class="card">Loading pitches…</div>`;
  try {
    const qRef = query(collection(db, "testPitches"), orderBy("timestamp", "desc"));
    const snap = await getDocs(qRef);

    if (snap.empty) {
      grid.innerHTML = `<div class="card">No pitches submitted yet.</div>`;
      return;
    }

    grid.innerHTML = "";
    snap.forEach((docSnap) => {
      const p = docSnap.data();
      const pid = docSnap.id;

      const title = p.title || p.pitchTitle || "Untitled Pitch";
      const desc  = p.shortPitch || p.description || "No short description provided.";
      const fin   = p.financialProjections || p.projections || "N/A";

      const card = document.createElement("div");
      card.className = "idea-card";
      card.innerHTML = `
        <h3>${title}</h3>
        <p><strong>Description:</strong> ${desc}</p>
        <p><strong>Financial Projections:</strong> ${fin}</p>
        ${p.pitchDeck ? `<p><a class="btn" href="${p.pitchDeck}" target="_blank" rel="noopener">Open Deck</a></p>` : ""}
        <button class="btn view-pitch-btn" data-pitch-id="${pid}">View Pitch</button>
      `;
      grid.appendChild(card);
    });

    // NDA modal wiring
    const modal = qs("ndaModal");
    if (!modal) return;
    let selectedPitchId = null;

    grid.querySelectorAll(".view-pitch-btn").forEach((btn) => {
      btn.addEventListener("click", (e) => {
        e.preventDefault();
        selectedPitchId = btn.dataset.pitchId;
        modal.style.display = "flex";
      });
    });

    qs("acceptNDA")?.addEventListener("click", () => {
      modal.style.display = "none";
      if (selectedPitchId) {
        window.location.href = `pitch-details.html?id=${selectedPitchId}`;
      }
    });
    qs("declineNDA")?.addEventListener("click", () => {
      modal.style.display = "none";
      selectedPitchId = null;
    });
  } catch (err) {
    console.error(err);
    grid.innerHTML = `<div class="card">Could not load pitches.</div>`;
  }
}


/* -------------------------
   Pitch details renderer
-------------------------- */
async function renderPitchDetailsIfNeeded() {
  if (!location.pathname.endsWith("pitch-details.html")) return;
  const id = new URLSearchParams(location.search).get("id");
  if (!id) return alert("Missing pitch id.");

  try {
    const snap = await getDoc(doc(db, "testPitches", id));
    if (!snap.exists()) return alert("Pitch not found.");

    const p = snap.data();

    const title = p.title || p.pitchTitle || "Untitled Pitch";
    const desc  = p.shortPitch || p.description || "—";
    const fin   = p.financialProjections || p.projections || "—";

    setText("pdTitle", title);
    setText("pdAuthor", p.author || "—");
    setText("pdEmail", p.email || "—");
    setText("pdDesc", desc);
    setText("pdProjections", fin);
    setText("pdIndustry", p.industry || "—");
    setText("pdFunding", p.fundingGoal || "—");
    fileLink("pdDeck", p.pitchDeck, "Open Deck");

    const vwrap = qs("pdVideoWrap");
    const vsrc  = qs("pdVideoSrc");
    if (p.pitchVideo && vwrap && vsrc) {
      vsrc.src = p.pitchVideo;
      vwrap.style.display = "";
    } else if (vwrap) {
      vwrap.style.display = "none";
    }
  } catch (e) {
    console.error(e);
    alert("Could not load pitch details.");
  }
}


/* -------------------------
   Auth/UI helpers for index
-------------------------- */
const isIndexPage = () =>
  location.pathname.endsWith("/") ||
  location.pathname.endsWith("/index.html") ||
  location.pathname === "/index.html";

function setAuthUI(u, { skipRedirect = false } = {}) {
  const authSection = document.getElementById("auth");
  const navLogin    = document.getElementById("nav-login");

  if (u) {
    if (authSection) authSection.style.display = "none";
    if (navLogin)    navLogin.style.display    = "none";
    updateNavForUser(u);
    applyAvatarImages(u);

    if (!skipRedirect && isIndexPage()) {
      const dash = u.accountType === "investor"
        ? "investor-dashboard.html"
        : "entrepreneur-dashboard.html";
      window.location.replace(`${dash}?uid=${encodeURIComponent(u.id)}`);
    }
  } else {
    if (authSection) authSection.style.display = "";
    if (navLogin)    navLogin.style.display    = "";

    ["nav-dashboard","nav-profile","nav-edit","nav-logout"].forEach(id => {
      const el = document.getElementById(id);
      if (el) el.style.display = "none";
    });
    applyAvatarImages(null);
  }
}

async function ensureAccountType(u) {
  let type = (u?.accountType || "").toLowerCase();
  const valid = (t) => t === "investor" || t === "entrepreneur";

  if (!valid(type)) {
    type = (prompt("Are you an 'investor' or 'entrepreneur'?") || "").toLowerCase().trim();
    if (!valid(type)) {
      alert("Please choose either 'investor' or 'entrepreneur' to continue.");
      throw new Error("Account type not chosen");
    }
    await setDoc(doc(db, "users", u.id), { accountType: type }, { merge: true });
    u = { ...u, accountType: type };
    storeUserLocally(u);
  }
  return { userLike: u, type };
}

/* -------------------------
   DOMContentLoaded – wire up
-------------------------- */
document.addEventListener("DOMContentLoaded", () => {
  // Greeting
  const usernameSpan = qs("username");
  if (usernameSpan) usernameSpan.textContent = getStoredUser()?.name || "Guest";
  applyAvatarImages(getStoredUser());

  // Initial UI (no redirect from cache)
  setAuthUI(getStoredUser(), { skipRedirect: true });

  // Auth state sync
  onAuthStateChanged(auth, async (fbUser) => {
    if (!fbUser) {
      if (usernameSpan) usernameSpan.textContent = "Guest";
      setAuthUI(null);
      return;
    }
    const userData = await fetchUserData(fbUser.uid);
    const merged = {
      id: fbUser.uid,
      name: userData?.name || fbUser.displayName || "User",
      email: fbUser.email,
      ...userData,
    };
    storeUserLocally(merged);
    if (usernameSpan) usernameSpan.textContent = merged.name;
    setAuthUI(merged); // may redirect from index → dashboard
  });

  // Logout
  qs("nav-logout")?.addEventListener("click", async (e) => {
    e.preventDefault();
    await logout();
  });

  // Guards
  if (location.pathname.endsWith("entrepreneur-dashboard.html")) requireAuth(["entrepreneur"]);
  if (location.pathname.endsWith("investor-dashboard.html"))     requireAuth(["investor"]);

  // -------- Auth forms (index.html) --------
  const loginForm = qs("loginForm");
  loginForm?.addEventListener("submit", async (e) => {
    e.preventDefault();
    const btn = e.submitter || loginForm.querySelector('button[type="submit"]');
    await withButtonLoading(btn, async () => {
      const email = qs("loginEmail").value.trim();
      const password = qs("loginPassword").value;
      const userData = await login(email, password);

      if (!userData.profileComplete) {
        window.location.href =
          userData.accountType === "investor"
            ? `edit-investor.html?uid=${userData.id}`
            : `edit-entrepreneur.html?uid=${userData.id}`;
        return;
      }
      window.location.href =
        userData.accountType === "investor"
          ? `investor-dashboard.html?uid=${userData.id}`
          : `entrepreneur-dashboard.html?uid=${userData.id}`;
    });
  });

  qs("googleSignInBtn")?.addEventListener("click", async (e) => {
    const btn = e.currentTarget;
    await withButtonLoading(btn, async () => {
      const userData = await signInWithGoogle();
      if (!userData.profileComplete) {
        window.location.href =
          userData.accountType === "investor"
            ? `edit-investor.html?uid=${userData.id}`
            : `edit-entrepreneur.html?uid=${userData.id}`;
        return;
      }
      window.location.href =
        userData.accountType === "investor"
          ? `investor-dashboard.html?uid=${userData.id}`
          : `entrepreneur-dashboard.html?uid=${userData.id}`;
    });
  });

  const signupForm = qs("signupForm");
  signupForm?.addEventListener("submit", async (e) => {
    e.preventDefault();
    const btn = e.submitter || signupForm.querySelector('button[type="submit"]');
    await withButtonLoading(btn, async () => {
      const name = qs("signupName").value.trim();
      const email = qs("signupEmail").value.trim();
      const password = qs("signupPassword").value.trim();
      const accountType = qs("accountType")?.value;
      if (!name || !email || !password || !accountType) {
        alert("Please fill in all fields.");
        return;
      }
      const user = await signup(email, password, name, accountType);
      window.location.href =
        accountType === "investor"
          ? `edit-investor.html?uid=${user.uid}`
          : `edit-entrepreneur.html?uid=${user.uid}`;
    });

  });

  // -------- Edit Investor page --------
  const invForm = qs("editInvestorForm");
  if (invForm) {
    const user = getStoredUser();

    const nameEl = qs("editName");
    const bioEl = qs("editBio");
    const focusEl = qs("editFocus");
    const locationEl = qs("editLocation");
    const budgetEl = qs("editBudget");
    const picInput = qs("profile-pic");
    const preview = qs("profilePreview");

    if (user) {
      nameEl.value = user.name || "";
      bioEl.value = user.bio || "";
      if (focusEl) focusEl.value = user.focus || "";
      locationEl.value = user.location || "";
      budgetEl.value = user.budget || "";
      if (user.profilePic && preview) preview.src = user.profilePic;
      applyAvatarImages(user);
    }

    picInput?.addEventListener("change", (e) => {
      if (preview && e.target.files[0]) preview.src = URL.createObjectURL(e.target.files[0]);
    });

    invForm.addEventListener("submit", async (e) => {
      e.preventDefault();
      const btn = e.submitter || invForm.querySelector('button[type="submit"]');
      await withButtonLoading(btn, async () => {
        if (!user) { alert("User not logged in"); return; }

        const data = {
          name: nameEl.value.trim(),
          bio: bioEl.value.trim(),
          focus: focusEl?.value || "",
          location: locationEl.value.trim(),
          budget: budgetEl.value.trim(),
          accountType: "investor",
        };
        const files = { profilePic: picInput?.files?.[0] || null };

        await saveProfile(user.id, data, files);
        window.location.href = `profile-complete.html?role=investor&uid=${encodeURIComponent(user.id)}`;
      });
    });
  }

  // -------- Edit Entrepreneur page --------
  const entForm = qs("editEntrepreneurForm");
  if (entForm) {
    const user = getStoredUser();

    const nameEl = qs("entName");
    const bioEl = qs("entBio");
    const industryEl = qs("entIndustry");
    const locationEl = qs("entLocation");
    const websiteEl = qs("entWebsite");
    const pitchTitleEl = qs("entPitchTitle");
    const fundingEl = qs("entFundingGoal");

    const picInput = qs("entProfilePic");
    const deckInput = qs("entPitchDeck");
    const videoInput = qs("entPitchVideo");
    const preview = qs("entProfilePreview");

    if (user) {
      nameEl.value = user.name || "";
      bioEl.value = user.bio || "";
      industryEl.value = user.industry || "";
      locationEl.value = user.location || "";
      websiteEl.value = user.website || "";
      if (user.profilePic && preview) preview.src = user.profilePic;
      applyAvatarImages(user);
    }

    picInput?.addEventListener("change", (e) => {
      if (preview && e.target.files[0]) preview.src = URL.createObjectURL(e.target.files[0]);
    });

    entForm.addEventListener("submit", async (e) => {
      e.preventDefault();
      const btn = e.submitter || entForm.querySelector('button[type="submit"]');
      await withButtonLoading(btn, async () => {
        if (!user) { alert("User not logged in"); return; }

        const data = {
          name: nameEl.value.trim(),
          bio: bioEl.value.trim(),
          industry: industryEl.value,
          location: locationEl.value.trim(),
          website: websiteEl.value.trim(),
          pitchTitle: pitchTitleEl.value.trim(),
          fundingGoal: fundingEl.value.trim(),
          accountType: "entrepreneur",
        };

        const files = {
          profilePic: picInput?.files?.[0] || null,
          pitchDeck:  deckInput?.files?.[0] || null,
          pitchVideo: videoInput?.files?.[0] || null,
        };

        await saveProfile(user.id, data, files);
        window.location.href = `profile-complete.html?role=entrepreneur&uid=${encodeURIComponent(user.id)}`;
      });
    });
  }

  // -------- Dynamic profile pages --------
  (async function renderProfileIfNeeded() {
    const type = document.body?.dataset?.profile; // "investor" | "entrepreneur"
    if (!type) return;

    try {
      showSkeleton(true);
      let uid = param("uid") || getStoredUser()?.id;
      if (!uid) {
        alert("Please log in to view this profile.");
        window.location.href = "index.html";
        return;
      }

      const data = await loadUserDoc(uid);
      if (!data) { alert("Profile not found."); return; }

      // Common header
      setText("profName", data.name || "Unknown");
      setText("profLocation", data.location);
      setText("profRole", data.accountType === "investor" ? "Investor" : "Entrepreneur");
      setSrc("profAvatar", data.profilePic, DEFAULT_AVATAR);
      const badge = qs("goldBadge");
      if (badge) badge.style.display = data.goldVerified ? "" : "none";

      if (type === "entrepreneur") {
        setText("bizIdea", data.pitchTitle || data.bio);
        setText("bizDesc", data.bio);
        setText("bizIndustry", data.industry);
        setText("bizFunding", data.fundingGoal);
        fileLink("docDeck", data.pitchDeck, "Pitch Deck");
        fileLink("docPlan", data.businessPlanURL, "Business Plan");
        fileLink("docForecast", data.financialForecastURL, "Financial Forecast");

        const videoWrap = qs("videoWrap");
        const srcEl = qs("pitchVideoSrc");
        if (data.pitchVideo && srcEl && videoWrap) {
          srcEl.src = data.pitchVideo;
          videoWrap.style.display = "";
        } else if (videoWrap) {
          videoWrap.style.display = "none";
        }
      } else {
        setText("invFocus", data.focus);
        setText("invBudget", data.budget);
        setText("invBio", data.bio);
      }

      applyAvatarImages({ profilePic: data.profilePic, name: data.name });
    } catch (e) {
      console.error(e);
      alert("Could not load profile.");
    } finally {
      showSkeleton(false);
    }
  })();

  // Pages:
  loadPitchesIntoGrid();
  renderPitchDetailsIfNeeded();
  wirePitchForm();

});

/* ===============================
   Deal Room (WebRTC via Firestore)
   =============================== */

// UI elements (resolved at runtime)
let drCreateBtn, drJoinForm, drJoinInput, drCopyBtn, drRoomWrap, drRoomIdEl;
let drHangupBtn, drToggleMicBtn, drToggleCamBtn, drLocalVideo, drRemoteVideo;

// PeerConnection + media
let drPC = null;
let drLocalStream = null;
let drRemoteStream = null;

// Firestore refs + unsubscribers
let drRoomRef = null;
let drUnsubs = []; // onSnapshot unsub functions

const ICE_SERVERS = [{ urls: ['stun:stun.l.google.com:19302'] }];

async function drRequireSignedIn() {
  return new Promise(resolve => {
    const stop = onAuthStateChanged(auth, (u) => {
      stop();
      if (!u) {
        alert("Please sign in to use the Deal Room.");
        window.location.href = "index.html";
      } else {
        resolve(u);
      }
    });
  });
}

async function drInitMedia() {
  if (drLocalStream) return drLocalStream;
  try {
    drLocalStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
    drLocalVideo.srcObject = drLocalStream;
    return drLocalStream;
  } catch (e) {
    console.error(e);
    alert("Camera/Mic permission is required.");
    throw e;
  }
}

function drCreatePC() {
  drPC = new RTCPeerConnection({ iceServers: ICE_SERVERS });

  // Local → send tracks
  drLocalStream.getTracks().forEach(t => drPC.addTrack(t, drLocalStream));

  // Remote → receive tracks
  drRemoteStream = new MediaStream();
  drRemoteVideo.srcObject = drRemoteStream;
  drPC.ontrack = (evt) => {
    evt.streams[0].getTracks().forEach(t => drRemoteStream.addTrack(t));
  };

  drPC.oniceconnectionstatechange = () => {
    // console.log('ICE state:', drPC.iceConnectionState);
    if (['disconnected','failed','closed'].includes(drPC.iceConnectionState)) {
      // optional cleanup
    }
  };
}

function drSetButtons(onCall) {
  drHangupBtn.style.display = onCall ? "" : "none";
  drToggleMicBtn.style.display = onCall ? "" : "none";
  drToggleCamBtn.style.display = onCall ? "" : "none";
}

async function drCreateRoom() {
  await drRequireSignedIn();
  await drInitMedia();
  drCreatePC();

  // Create room doc
  const user = getStoredUser();
  drRoomRef = await addDoc(collection(db, "rooms"), {
    createdBy: user?.id || auth.currentUser.uid,
    createdAt: serverTimestamp()
  });

  // Local ICE candidates → offerCandidates
  const offerCands = collection(drRoomRef, "offerCandidates");
  drPC.onicecandidate = (evt) => {
    if (evt.candidate) addDoc(offerCands, evt.candidate.toJSON()).catch(console.error);
  };

  // Create & store offer
  const offer = await drPC.createOffer();
  await drPC.setLocalDescription(offer);
  await setDoc(drRoomRef, { offer: { type: offer.type, sdp: offer.sdp } }, { merge: true });

  // Listen for answer on room doc
  const unsubAns = onSnapshot(drRoomRef, async (snap) => {
    const data = snap.data();
    if (!drPC.currentRemoteDescription && data?.answer) {
      await drPC.setRemoteDescription(new RTCSessionDescription(data.answer));
    }
  });
  drUnsubs.push(unsubAns);

  // Listen for remote ICE from answerCandidates
  const answerCands = collection(drRoomRef, "answerCandidates");
  const unsubAC = onSnapshot(answerCands, (snap) => {
    snap.docChanges().forEach(change => {
      if (change.type === 'added') {
        drPC.addIceCandidate(new RTCIceCandidate(change.doc.data())).catch(console.error);
      }
    });
  });
  drUnsubs.push(unsubAC);

  // Show room id
  drRoomIdEl.textContent = drRoomRef.id;
  drRoomWrap.style.display = "";
  drSetButtons(true);
}

async function drJoinRoom(roomId) {
  const roomDoc = await getDoc(doc(db, "rooms", roomId));
  if (!roomDoc.exists()) return alert("Room not found.");

  await drRequireSignedIn();
  await drInitMedia();
  drCreatePC();

  const roomData = roomDoc.data();

  // Local ICE → answerCandidates
  const roomRef = doc(db, "rooms", roomId);
  drRoomRef = roomRef;
  await setDoc(roomRef, { joinedBy: auth.currentUser.uid }, { merge: true });

  const answerCands = collection(roomRef, "answerCandidates");
  drPC.onicecandidate = (evt) => {
    if (evt.candidate) addDoc(answerCands, evt.candidate.toJSON()).catch(console.error);
  };

  // Set remote offer
  if (!roomData.offer) {
    alert("Room has no offer yet.");
    return;
  }
  await drPC.setRemoteDescription(new RTCSessionDescription(roomData.offer));

  // Create & push answer
  const answer = await drPC.createAnswer();
  await drPC.setLocalDescription(answer);
  await setDoc(roomRef, { answer: { type: answer.type, sdp: answer.sdp } }, { merge: true });

  // Listen for remote ICE from offerCandidates
  const offerCands = collection(roomRef, "offerCandidates");
  const unsubOC = onSnapshot(offerCands, (snap) => {
    snap.docChanges().forEach(change => {
      if (change.type === 'added') {
        drPC.addIceCandidate(new RTCIceCandidate(change.doc.data())).catch(console.error);
      }
    });
  });
  drUnsubs.push(unsubOC);

  // Reflect room id in UI
  drRoomIdEl.textContent = roomId;
  drRoomWrap.style.display = "";
  drSetButtons(true);
}

async function drHangUp() {
  try {
    drUnsubs.forEach(u => { try { u(); } catch {} });
    drUnsubs = [];
    if (drPC) { drPC.close(); drPC = null; }

    if (drLocalStream) {
      drLocalStream.getTracks().forEach(t => t.stop());
      drLocalStream = null;
    }
    if (drRemoteVideo) drRemoteVideo.srcObject = null;
    if (drLocalVideo)  drLocalVideo.srcObject = null;
  } finally {
    drSetButtons(false);
  }
}

function drToggleMic() {
  const enabled = drLocalStream?.getAudioTracks().some(t => t.enabled);
  drLocalStream?.getAudioTracks().forEach(t => t.enabled = !enabled);
  drToggleMicBtn.textContent = enabled ? "Unmute Mic" : "Mute Mic";
  drToggleMicBtn.classList.toggle("muted", enabled);
}

function drToggleCam() {
  const enabled = drLocalStream?.getVideoTracks().some(t => t.enabled);
  drLocalStream?.getVideoTracks().forEach(t => t.enabled = !enabled);
  drToggleCamBtn.textContent = enabled ? "Turn Camera On" : "Turn Camera Off";
  drToggleCamBtn.classList.toggle("muted", enabled);
}

// Wire UI if we're on deal-room.html
function wireDealRoomUIIfNeeded() {
  if (!location.pathname.endsWith("deal-room.html")) return;

  // pull elements
  drCreateBtn     = document.getElementById("drCreate");
  drJoinForm      = document.getElementById("drJoinForm");
  drJoinInput     = document.getElementById("drJoinId");
  drCopyBtn       = document.getElementById("drCopy");
  drRoomWrap      = document.getElementById("drRoom");
  drRoomIdEl      = document.getElementById("drRoomId");
  drHangupBtn     = document.getElementById("drHangup");
  drToggleMicBtn  = document.getElementById("drToggleMic");
  drToggleCamBtn  = document.getElementById("drToggleCam");
  drLocalVideo    = document.getElementById("drLocal");
  drRemoteVideo   = document.getElementById("drRemote");

  // events
  drCreateBtn?.addEventListener("click", drCreateRoom);
  drJoinForm?.addEventListener("submit", async (e) => {
    e.preventDefault();
    const id = (drJoinInput.value || "").trim();
    if (!id) return;
    await drJoinRoom(id);
  });
  drCopyBtn?.addEventListener("click", async () => {
    const id = drRoomIdEl?.textContent || "";
    if (!id) return;
    try { await navigator.clipboard.writeText(id); alert("Room ID copied"); } catch {}
  });
  drHangupBtn?.addEventListener("click", drHangUp);
  drToggleMicBtn?.addEventListener("click", drToggleMic);
  drToggleCamBtn?.addEventListener("click", drToggleCam);

  // auth gate (optional but recommended)
  requireAuth(); // or requireAuth(['investor','entrepreneur'])
}
// call after your existing DOMContentLoaded wiring
document.addEventListener("DOMContentLoaded", wireDealRoomUIIfNeeded);
