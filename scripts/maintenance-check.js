import { auth, db } from "./firebase.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";
import { doc, getDoc, onSnapshot } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

const SETTINGS_DOC = doc(db, "config", "appSettings");
const OVERLAY_ID = "maintenance-overlay";

function injectStyles() {
  if (document.getElementById("maintenance-overlay-styles")) return;
  const style = document.createElement("style");
  style.id = "maintenance-overlay-styles";
  style.textContent = `
    #${OVERLAY_ID} {
      position: fixed;
      inset: 0;
      z-index: 999999;
      background: #0f172a;
      color: #e2e8f0;
      display: flex;
      align-items: center;
      justify-content: center;
      text-align: center;
      font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif;
      padding: 24px;
    }
    #${OVERLAY_ID} .maintenance-box { max-width: 420px; }
    #${OVERLAY_ID} .maintenance-icon { font-size: 42px; margin-bottom: 14px; }
    #${OVERLAY_ID} h1 { font-size: 20px; font-weight: 800; margin: 0 0 10px; }
    #${OVERLAY_ID} p { font-size: 14px; color: #94a3b8; line-height: 1.6; margin: 0; }
  `;
  document.head.appendChild(style);
}

function showOverlay(message) {
  injectStyles();
  let overlay = document.getElementById(OVERLAY_ID);
  if (!overlay) {
    overlay = document.createElement("div");
    overlay.id = OVERLAY_ID;
    document.body.appendChild(overlay);
  }
  overlay.innerHTML = `
    <div class="maintenance-box">
      <div class="maintenance-icon">🛠️</div>
      <h1>Under Maintenance</h1>
      <p>${message}</p>
    </div>`;
  document.documentElement.style.overflow = "hidden";
}

function hideOverlay() {
  document.getElementById(OVERLAY_ID)?.remove();
  document.documentElement.style.overflow = "";
}

let unsubSettings = null;

onAuthStateChanged(auth, async (user) => {
  // Not logged in: each page's own auth guard handles the redirect to
  // auth.html. Nothing for this script to block here.
  if (!user) {
    unsubSettings?.();
    hideOverlay();
    return;
  }

  let isAdmin = false;
  try {
    const userSnap = await getDoc(doc(db, "users", user.uid));
    isAdmin = userSnap.exists() && userSnap.data().role === "admin";
  } catch {
    isAdmin = false;
  }

  // Admins are never blocked — they always need a way in to turn
  // maintenance mode back off from admin-settings.html.
  if (isAdmin) return;

  unsubSettings?.();
  unsubSettings = onSnapshot(SETTINGS_DOC, (snap) => {
    const data = snap.data() || {};
    if (data.maintenanceMode) {
      showOverlay(data.maintenanceMessage ||
        "We're currently performing scheduled maintenance. Please check back soon.");
    } else {
      hideOverlay();
    }
  });
});