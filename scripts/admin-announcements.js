import { auth, db } from "./firebase.js";
import { onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";
import {
  collection, addDoc, onSnapshot, orderBy, query,
  doc, getDoc, deleteDoc, serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

function formatDate(ts) {
  if (!ts) return "";
  const d = ts.toDate ? ts.toDate() : new Date(ts);
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) +
    " at " + d.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" });
}

const typeConfig = {
  info:    { emoji: "ℹ️", color: "#4a7cff", bg: "#eef2ff" },
  warning: { emoji: "⚠️", color: "#f5a623", bg: "#fff8ee" },
  success: { emoji: "✅", color: "#27ae60", bg: "#eefff4" },
  urgent:  { emoji: "🚨", color: "#e74c3c", bg: "#fff0ee" },
};

function renderAnnouncement(a) {
  const cfg = typeConfig[a.type] || typeConfig.info;
  return `
    <div class="ann-card" style="background:${cfg.bg};border-left:4px solid ${cfg.color}">
      <div class="ann-header">
        <span class="ann-type">${cfg.emoji} ${a.type?.toUpperCase() || "INFO"}</span>
        <span class="ann-date">${formatDate(a.createdAt)}</span>
        <button class="ann-delete" onclick="deleteAnn('${a.id}')">
          <i class="ti ti-trash"></i>
        </button>
      </div>
      <div class="ann-title">${a.title}</div>
      <div class="ann-body">${a.body}</div>
      <div class="ann-by">Posted by: ${a.postedBy || "Admin"}</div>
    </div>
  `;
}

async function postAnnouncement() {
  const title = document.getElementById("ann-title").value.trim();
  const body  = document.getElementById("ann-body").value.trim();
  const type  = document.getElementById("ann-type").value;
  const msgEl = document.getElementById("ann-msg");

  if (!title || !body) {
    msgEl.style.color = "#e74c3c";
    msgEl.textContent = "Please fill in title and message.";
    return;
  }

  try {
    const user = auth.currentUser;
    const snap = await getDoc(doc(db, "users", user.uid));
    const name = snap.exists() ? snap.data().name : "Admin";

    await addDoc(collection(db, "announcements"), {
      title,
      body,
      type,
      postedBy: name,
      postedByUid: user.uid,
      createdAt: serverTimestamp()
    });

    document.getElementById("ann-title").value = "";
    document.getElementById("ann-body").value = "";
    msgEl.style.color = "#27ae60";
    msgEl.textContent = "✅ Announcement posted successfully!";
    setTimeout(() => msgEl.textContent = "", 3000);
  } catch(e) {
    msgEl.style.color = "#e74c3c";
    msgEl.textContent = "Error: " + e.message;
  }
}

window.deleteAnn = async (id) => {
  if (!confirm("Delete this announcement?")) return;
  await deleteDoc(doc(db, "announcements", id));
};

onAuthStateChanged(auth, async (user) => {
  if (!user) { window.location.replace("../pages/auth.html"); return; }

  const snap = await getDoc(doc(db, "users", user.uid));
  if (!snap.exists() || snap.data().role !== "admin") {
    window.location.replace("../pages/dashboard.html");
    return;
  }

  // Logout
  document.getElementById("logout-btn").addEventListener("click", async (e) => {
    e.preventDefault();
    await signOut(auth);
    window.location.replace("../pages/auth.html");
  });

  // Go to app
  document.getElementById("go-to-app")?.addEventListener("click", (e) => {
    e.preventDefault();
    window.location.replace("../pages/dashboard.html");
  });

  document.getElementById("go-to-app-mobile")?.addEventListener("click", (e) => {
    e.preventDefault();
    window.location.replace("../pages/dashboard.html");
  });

  // Post announcement button — DIRI ang tamang lugar
  document.getElementById("post-ann-btn").addEventListener("click", postAnnouncement);

  // Real-time announcements list
  const q = query(collection(db, "announcements"), orderBy("createdAt", "desc"));
  onSnapshot(q, (snap) => {
    const anns = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    const listEl = document.getElementById("ann-list");
    listEl.innerHTML = anns.length
      ? anns.map(renderAnnouncement).join("")
      : `<p class="panel-empty">No announcements yet</p>`;
  });
});