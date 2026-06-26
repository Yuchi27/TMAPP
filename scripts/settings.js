import { auth } from "./firebase.js";
import { onAuthStateChanged, signOut, updateProfile } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";

const darkToggle     = document.getElementById("dark-toggle");
const avatarBox      = document.getElementById("profile-avatar");
const avatarInput    = document.getElementById("avatar-input");
const avatarUploadBtn = document.getElementById("avatar-upload-btn");
const nicknameInput  = document.getElementById("nickname-input");
const saveBtn        = document.getElementById("profile-save-btn");
const msgEl          = document.getElementById("profile-msg");

let pendingPhotoDataUrl = null; // holds resized base64 until user hits Save

function syncToggleUI() {
  const isDark = window.getTheme() === "dark";
  darkToggle.classList.toggle("on", isDark);
}

darkToggle.addEventListener("click", () => {
  window.toggleTheme();
  syncToggleUI();
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

// Resize + compress the chosen image so it's small enough to store
// directly on the Firebase Auth profile (photoURL field).
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

  if (!file.type.startsWith("image/")) {
    return setMsg("Please choose an image file.", "err");
  }

  try {
    const dataUrl = await resizeImage(file);
    pendingPhotoDataUrl = dataUrl;
    renderAvatar(dataUrl); // instant preview, not saved yet
    setMsg("Photo ready — click Save Changes to apply.", "ok");
  } catch {
    setMsg("Couldn't read that image. Try another one.", "err");
  }
});

saveBtn.addEventListener("click", async () => {
  const nickname = nicknameInput.value.trim();
  if (!nickname) return setMsg("Nickname can't be empty.", "err");

  saveBtn.disabled = true;
  saveBtn.textContent = "Saving...";

  try {
    const updates = { displayName: nickname };
    if (pendingPhotoDataUrl) updates.photoURL = pendingPhotoDataUrl;

    await updateProfile(auth.currentUser, updates);
    pendingPhotoDataUrl = null;
    setMsg("Profile updated!", "ok");
  } catch (e) {
    setMsg(e.message || "Something went wrong.", "err");
  } finally {
    saveBtn.disabled = false;
    saveBtn.textContent = "Save Changes";
  }
});

async function doLogout() {
  await signOut(auth);
  window.location.replace("auth.html");
}

document.addEventListener("tma:logout", doLogout); // fired by nav.js
document.getElementById("settings-logout-btn").addEventListener("click", doLogout);

onAuthStateChanged(auth, (user) => {
  if (!user) { window.location.replace("auth.html"); return; }
  nicknameInput.value = user.displayName || user.email.split("@")[0];
  document.getElementById("profile-email").textContent = user.email;
  renderAvatar(user.photoURL);
  syncToggleUI();
});