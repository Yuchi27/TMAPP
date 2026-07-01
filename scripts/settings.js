import { auth, db } from "./firebase.js";
import { onAuthStateChanged, signOut, updatePassword } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";
import { doc, getDoc, updateDoc } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

const darkToggle      = document.getElementById("dark-toggle");
const avatarBox       = document.getElementById("profile-avatar");
const avatarInput     = document.getElementById("avatar-input");
const avatarUploadBtn = document.getElementById("avatar-upload-btn");
const nicknameInput   = document.getElementById("nickname-input");
const saveBtn         = document.getElementById("profile-save-btn");
const msgEl           = document.getElementById("profile-msg");

const swatchEls        = document.querySelectorAll(".theme-swatch");
const customAccentInput = document.getElementById("custom-accent-input");
const resetAccentBtn    = document.getElementById("reset-accent-btn");

let pendingPhotoDataUrl = null;

function syncToggleUI() {
  const isDark = window.getTheme() === "dark";
  darkToggle.classList.toggle("on", isDark);
}

darkToggle.addEventListener("click", () => {
  window.toggleTheme();
  syncToggleUI();
  saveThemePrefs();
});

function setMsg(text, type) {
  msgEl.textContent = text;
  msgEl.className = "msg " + type;
}

function renderAvatar(photoURL) {
  avatarBox.innerHTML = photoURL
    ? `<img src="${photoURL}" alt="avatar">`
    : `<i class="ti ti-user"></i>`;
}

function resizeImage(file, maxSize = 160, quality = 0.8) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement("canvas");
        let { width, height } = img;
        if (width > height) {
          if (width > maxSize) { height *= maxSize / width; width = maxSize; }
        } else {
          if (height > maxSize) { width *= maxSize / height; height = maxSize; }
        }
        canvas.width = width;
        canvas.height = height;
        canvas.getContext("2d").drawImage(img, 0, 0, width, height);
        resolve(canvas.toDataURL("image/jpeg", quality));
      };
      img.onerror = reject;
      img.src = e.target.result;
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

avatarUploadBtn.addEventListener("click", () => avatarInput.click());

avatarInput.addEventListener("change", async () => {
  const file = avatarInput.files[0];
  if (!file) return;
  if (!file.type.startsWith("image/")) return setMsg("Please choose an image file.", "err");
  try {
    const dataUrl = await resizeImage(file);
    pendingPhotoDataUrl = dataUrl;
    renderAvatar(dataUrl);
    setMsg("Photo ready — click Save Changes to apply.", "ok");
  } catch {
    setMsg("Couldn't read that image. Try another one.", "err");
  }
});

// ── SAVE PROFILE — Firestore only, no Firebase Auth updateProfile ──
saveBtn.addEventListener("click", async () => {
  const nickname = nicknameInput.value.trim();
  if (!nickname) return setMsg("Nickname can't be empty.", "err");

  saveBtn.disabled = true;
  saveBtn.textContent = "Saving...";

  try {
    const firestoreUpdate = { name: nickname };
    if (pendingPhotoDataUrl) firestoreUpdate.photoURL = pendingPhotoDataUrl;
    await updateDoc(doc(db, "users", auth.currentUser.uid), firestoreUpdate);

    if (pendingPhotoDataUrl) renderAvatar(pendingPhotoDataUrl);
    pendingPhotoDataUrl = null;
    setMsg("Profile updated!", "ok");
  } catch (e) {
    setMsg(e.message || "Something went wrong.", "err");
  } finally {
    saveBtn.disabled = false;
    saveBtn.textContent = "Save Changes";
  }
});

// ── CUSTOMIZATION: theme presets + custom accent ──
function syncSwatchUI() {
  const activePreset = window.getCustomAccent() ? null : window.getPreset();
  swatchEls.forEach(el => {
    el.classList.toggle("selected", !window.getCustomAccent() && el.dataset.preset === activePreset);
  });
  const customAccent = window.getCustomAccent();
  if (customAccent) customAccentInput.value = customAccent;
}

swatchEls.forEach(el => {
  el.addEventListener("click", () => {
    window.applyPreset(el.dataset.preset);
    syncSwatchUI();
    saveThemePrefs();
  });
});

customAccentInput.addEventListener("input", () => {
  window.setCustomAccent(customAccentInput.value);
  syncSwatchUI();
});

customAccentInput.addEventListener("change", () => {
  saveThemePrefs();
});

resetAccentBtn.addEventListener("click", () => {
  window.applyPreset("indigo");
  customAccentInput.value = "#3b4fc8";
  syncSwatchUI();
  saveThemePrefs();
});

// Debounced Firestore write so cross-device sync doesn't spam writes
// while someone is dragging the color picker around.
let saveThemeTimer = null;
function saveThemePrefs() {
  clearTimeout(saveThemeTimer);
  saveThemeTimer = setTimeout(async () => {
    if (!auth.currentUser) return;
    try {
      await updateDoc(doc(db, "users", auth.currentUser.uid), {
        theme: window.getTheme(),
        themePreset: window.getPreset(),
        accentColor: window.getCustomAccent() || null,
      });
    } catch {}
  }, 400);
}

// ── CHANGE PASSWORD ──
document.getElementById("change-pass-btn").addEventListener("click", async () => {
  const newPass     = document.getElementById("new-pass").value;
  const confirmPass = document.getElementById("confirm-pass").value;
  const passMsg     = document.getElementById("pass-msg");

  if (!newPass || !confirmPass) {
    passMsg.className = "msg err";
    passMsg.textContent = "Fill in both fields.";
    return;
  }
  if (newPass !== confirmPass) {
    passMsg.className = "msg err";
    passMsg.textContent = "Passwords do not match.";
    return;
  }
  if (newPass.length < 6) {
    passMsg.className = "msg err";
    passMsg.textContent = "Password must be 6+ characters.";
    return;
  }

  try {
    await updatePassword(auth.currentUser, newPass);
    passMsg.className = "msg ok";
    passMsg.textContent = "Password changed successfully!";
    document.getElementById("new-pass").value = "";
    document.getElementById("confirm-pass").value = "";
  } catch(e) {
    passMsg.className = "msg err";
    passMsg.textContent = e.code === "auth/requires-recent-login"
      ? "Please sign out and sign in again before changing password."
      : e.message;
  }
});

async function doLogout() {
  await signOut(auth);
  window.location.replace("auth.html");
}

document.addEventListener("tma:logout", doLogout);
document.getElementById("settings-logout-btn").addEventListener("click", doLogout);

// ── AUTH STATE ──
onAuthStateChanged(auth, async (user) => {
  if (!user) { window.location.replace("auth.html"); return; }

  nicknameInput.value = user.displayName || user.email.split("@")[0];
  document.getElementById("profile-email").textContent = user.email;
  syncToggleUI();
  syncSwatchUI();

  try {
    const snap = await getDoc(doc(db, "users", user.uid));
    if (snap.exists()) {
      const data = snap.data();

      // Use name from Firestore if available
      if (data.name) nicknameInput.value = data.name;

      // Photo from Firestore
      renderAvatar(data.photoURL || null);

      // Role
      document.getElementById("user-role").textContent =
        data.role === "admin" ? "🛡️ Admin" : "👤 Regular User";

      // Joined date
      if (data.createdAt) {
        const d = data.createdAt.toDate();
        document.getElementById("user-joined").textContent =
          d.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });
      }

      // Cross-device theme sync: apply whatever this account saved
      // elsewhere, then refresh the picker UI to match.
      if (window.syncThemeFromProfile) {
        window.syncThemeFromProfile({
          theme: data.theme,
          preset: data.themePreset,
          accentColor: data.accentColor,
        });
        syncToggleUI();
        syncSwatchUI();
      }
    }
  } catch(e) {}
});