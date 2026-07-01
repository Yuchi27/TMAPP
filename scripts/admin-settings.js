import { auth, db } from "./firebase.js";
import { onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";
import {
  doc, getDoc, setDoc, serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

const SETTINGS_DOC = doc(db, "config", "appSettings");

const appNameInput      = document.getElementById("app-name-input");
const supportEmailInput = document.getElementById("support-email-input");
const appInfoSaveBtn    = document.getElementById("app-info-save-btn");
const appInfoMsg        = document.getElementById("app-info-msg");

const maintenanceToggle = document.getElementById("maintenance-toggle");
const maintenanceMsgInput = document.getElementById("maintenance-message-input");
const maintenanceSaveBtn  = document.getElementById("maintenance-save-btn");
const maintenanceMsgEl    = document.getElementById("maintenance-msg");
const maintenancePill     = document.getElementById("maintenance-pill");

let maintenanceOn = false;

function setMsg(el, text, type) {
  el.textContent = text;
  el.className = "msg " + type;
}

function setPill(isOn) {
  maintenanceOn = isOn;
  maintenancePill.textContent = isOn ? "Maintenance ON" : "Live";
  maintenancePill.classList.toggle("on", isOn);
  maintenancePill.classList.toggle("off", !isOn);
}

function syncToggleUI() {
  maintenanceToggle.classList.toggle("on", maintenanceOn);
}

maintenanceToggle.addEventListener("click", () => {
  setPill(!maintenanceOn);
  syncToggleUI();
});

async function loadSettings() {
  try {
    const snap = await getDoc(SETTINGS_DOC);
    const data = snap.exists() ? snap.data() : {};

    appNameInput.value = data.appName || "";
    supportEmailInput.value = data.supportEmail || "";
    maintenanceMsgInput.value = data.maintenanceMessage ||
      "We're currently performing scheduled maintenance. Please check back soon.";

    setPill(!!data.maintenanceMode);
    syncToggleUI();
  } catch (e) {
    setMsg(maintenanceMsgEl, "Couldn't load settings: " + e.message, "err");
  }
}

appInfoSaveBtn.addEventListener("click", async () => {
  const appName = appNameInput.value.trim();
  const supportEmail = supportEmailInput.value.trim();

  if (!appName) return setMsg(appInfoMsg, "App name can't be empty.", "err");

  appInfoSaveBtn.disabled = true;
  appInfoSaveBtn.textContent = "Saving...";
  try {
    await setDoc(SETTINGS_DOC, {
      appName,
      supportEmail,
      updatedAt: serverTimestamp(),
      updatedBy: auth.currentUser.uid,
    }, { merge: true });
    setMsg(appInfoMsg, "Saved!", "ok");
  } catch (e) {
    setMsg(appInfoMsg, e.message || "Something went wrong.", "err");
  } finally {
    appInfoSaveBtn.disabled = false;
    appInfoSaveBtn.textContent = "Save Changes";
  }
});

maintenanceSaveBtn.addEventListener("click", async () => {
  const message = maintenanceMsgInput.value.trim();
  if (maintenanceOn && !message) {
    return setMsg(maintenanceMsgEl, "Add a message for users before enabling maintenance mode.", "err");
  }

  maintenanceSaveBtn.disabled = true;
  maintenanceSaveBtn.textContent = "Saving...";
  try {
    await setDoc(SETTINGS_DOC, {
      maintenanceMode: maintenanceOn,
      maintenanceMessage: message,
      updatedAt: serverTimestamp(),
      updatedBy: auth.currentUser.uid,
    }, { merge: true });
    setMsg(maintenanceMsgEl, maintenanceOn ? "Maintenance mode is now ON." : "Maintenance mode is now OFF.", "ok");
  } catch (e) {
    setMsg(maintenanceMsgEl, e.message || "Something went wrong.", "err");
  } finally {
    maintenanceSaveBtn.disabled = false;
    maintenanceSaveBtn.textContent = "Save Changes";
  }
});

document.getElementById("logout-btn").addEventListener("click", async (e) => {
  e.preventDefault();
  await signOut(auth);
  window.location.replace("auth.html");
});

// ── AUTH + ROLE GATE ──
onAuthStateChanged(auth, async (user) => {
  if (!user) { window.location.replace("auth.html"); return; }

  try {
    const userSnap = await getDoc(doc(db, "users", user.uid));
    if (!userSnap.exists() || userSnap.data().role !== "admin") {
      window.location.replace("dashboard.html");
      return;
    }
  } catch {
    window.location.replace("dashboard.html");
    return;
  }

  loadSettings();
});