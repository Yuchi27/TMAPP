import { auth, db } from "./firebase.js";
import { onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";
import {
  collection, getDocs, doc, getDoc, query, orderBy, onSnapshot, limit
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

function getGreeting() {
  const h = new Date().getHours();
  if (h < 12) return "Good Morning";
  if (h < 18) return "Good Afternoon";
  return "Good Evening";
}

function formatDate(ts) {
  if (!ts) return "—";
  const d = ts.toDate ? ts.toDate() : new Date(ts);
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function isThisWeek(ts) {
  if (!ts) return false;
  const d = ts.toDate ? ts.toDate() : new Date(ts);
  const now = new Date();
  const weekAgo = new Date();
  weekAgo.setDate(now.getDate() - 7);
  return d >= weekAgo && d <= now;
}

const typeConfig = {
  info:    { emoji: "ℹ️", color: "#4a7cff" },
  warning: { emoji: "⚠️", color: "#f5a623" },
  success: { emoji: "✅", color: "#27ae60" },
  urgent:  { emoji: "🚨", color: "#e74c3c" },
};

onAuthStateChanged(auth, async (user) => {
  if (!user) { window.location.replace("../pages/auth.html"); return; }

  const snap = await getDoc(doc(db, "users", user.uid));
  if (!snap.exists() || snap.data().role !== "admin") {
    window.location.replace("../pages/dashboard.html");
    return;
  }

  document.getElementById("greeting-text").textContent =
    `${getGreeting()}, ${snap.data().name || "Admin"}!`;

  document.getElementById("logout-btn").addEventListener("click", async (e) => {
    e.preventDefault();
    await signOut(auth);
    window.location.replace("../pages/auth.html");
  });

  document.getElementById("logout-btn-mobile")?.addEventListener("click", async (e) => {
    e.preventDefault();
    await signOut(auth);
    window.location.replace("../pages/auth.html");
  });

  document.getElementById("go-to-app").addEventListener("click", (e) => {
    e.preventDefault();
    window.location.replace("../pages/dashboard.html");
  });

  document.getElementById("go-to-app-mobile")?.addEventListener("click", (e) => {
    e.preventDefault();
    window.location.replace("../pages/dashboard.html");
  });

  // Load users
  const usersSnap = await getDocs(collection(db, "users"));
  const users = usersSnap.docs.map(d => ({ id: d.id, ...d.data() }));

  document.getElementById("total-users").textContent   = users.length;
  document.getElementById("total-admins").textContent  = users.filter(u => u.role === "admin").length;
  document.getElementById("total-regular").textContent = users.filter(u => u.role !== "admin").length;
  document.getElementById("new-users").textContent     = users.filter(u => isThisWeek(u.createdAt)).length;

  const sorted = [...users].sort((a, b) => {
    const da = a.createdAt?.toDate?.() || new Date(0);
    const db2 = b.createdAt?.toDate?.() || new Date(0);
    return db2 - da;
  }).slice(0, 5);

  document.getElementById("recent-users").innerHTML = sorted.length
    ? sorted.map(u => `
        <div class="panel-item">
          <div>
            <div class="user-name">${u.name || "Unknown"}</div>
            <div class="user-email">${u.email || ""} · ${formatDate(u.createdAt)}</div>
          </div>
        </div>`).join("")
    : `<p class="panel-empty">No users yet</p>`;

  const admins = users.filter(u => u.role === "admin");
  document.getElementById("admin-list").innerHTML = admins.length
    ? admins.map(u => `
        <div class="panel-item">
          <div>
            <div class="user-name">${u.name || "Unknown"}</div>
            <div class="user-email">${u.email || ""}</div>
          </div>
        </div>`).join("")
    : `<p class="panel-empty">No admins yet</p>`;

  // Recent announcements
  const annQ = query(collection(db, "announcements"), orderBy("createdAt", "desc"), limit(3));
  onSnapshot(annQ, (snap) => {
    const anns = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    const el = document.getElementById("recent-announcements");
    el.innerHTML = anns.length
      ? anns.map(a => {
          const cfg = typeConfig[a.type] || typeConfig.info;
          return `
            <div class="panel-item">
              <div>
                <div class="user-name">${cfg.emoji} ${a.title}</div>
                <div class="user-email">${a.body?.substring(0, 60)}${a.body?.length > 60 ? "..." : ""}</div>
              </div>
            </div>`;
        }).join("")
      : `<p class="panel-empty">No announcements yet</p>`;
  });
});