// ✅ Pitch form submission logic
document.addEventListener("DOMContentLoaded", () => {
  const pitchForm = document.getElementById("pitchForm");

  if (!pitchForm) return;

  pitchForm.addEventListener("submit", (e) => {
    e.preventDefault();

    const titleInput = document.getElementById("pitchTitle");
    const descInput = document.getElementById("pitchDescription");

    if (!titleInput || !descInput) {
      alert("Pitch form fields not found.");
      return;
    }

    const title = titleInput.value.trim();
    const description = descInput.value.trim();

    if (!title || !description) {
      alert("Please fill in both the Business Name and the Description.");
      return;
    }

    const user = JSON.parse(localStorage.getItem("sizaUser"));
    if (!user) {
      alert("⚠ You must be logged in to submit a pitch.");
      return;
    }

    const pitches = JSON.parse(localStorage.getItem("sizaPitches")) || [];

    const newPitch = {
      title,
      description,
      author: user.name || "Unknown",
      email: user.email || "unknown@siza.com",
      timestamp: new Date().toISOString()
    };

    pitches.push(newPitch);
    localStorage.setItem("sizaPitches", JSON.stringify(pitches));

    alert("✅ Your pitch has been submitted!");
    pitchForm.reset();
  });
});
