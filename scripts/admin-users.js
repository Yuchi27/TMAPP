import { auth, db } from "./firebase.js";
import { onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";
import {
  collection, getDocs, doc, getDoc, updateDoc
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

let allUsers = [];
let currentFilter = "all";
let currentUser = null;

function formatDate(ts) {
  if (!ts) return "—";
  const d = ts.toDate ? ts.toDate() : new Date(ts);
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function getInitial(name) {
  return name ? name.charAt(0).toUpperCase() : "?";
}

function renderTable() {
  const search = document.getElementById("search-input").value.toLowerCase();
  let users = [...allUsers];

  if (search) {
    users = users.filter(u =>
      (u.name || "").toLowerCase().includes(search) ||
      (u.email || "").toLowerCase().includes(search)
    );
  }

  if (currentFilter === "admin") users = users.filter(u => u.role === "admin");
  if (currentFilter === "user")  users = users.filter(u => u.role !== "admin");

  const tbody = document.getElementById("users-tbody");

  if (!users.length) {
    tbody.innerHTML = `<tr><td colspan="5" style="text-align:center;padding:24px;color:#8a9bb0">No users found</td></tr>`;
    return;
  }

  tbody.innerHTML = users.map(u => {
    const isMe = u.id === currentUser.uid;
    const isAdmin = u.role === "admin";

    const actionBtn = isMe
      ? `<button class="btn-you"><i class="ti ti-user"></i> You</button>`
      : isAdmin
        ? `<button class="btn-remove-admin" onclick="setRole('${u.id}', 'user')"><i class="ti ti-shield-off"></i> Remove Admin</button>`
        : `<button class="btn-make-admin" onclick="setRole('${u.id}', 'admin')"><i class="ti ti-shield"></i> Make Admin</button>`;

    return `
      <tr>
        <td>
          <div class="user-row-info">
            <div class="user-avatar-sm">${getInitial(u.name)}</div>
            <div class="user-name-sm">${u.name || "Unknown"}</div>
          </div>
        </td>
        <td>${u.email || "—"}</td>
        <td><span class="role-badge ${isAdmin ? 'admin' : 'user'}">${isAdmin ? 'Admin' : 'User'}</span></td>
        <td>${formatDate(u.createdAt)}</td>
        <td><div class="action-btns">${actionBtn}</div></td>
      </tr>
    `;
  }).join("");
}

window.setRole = async (uid, role) => {
  const confirm_msg = role === "admin"
    ? "Make this user an Admin?"
    : "Remove Admin role from this user?";
  if (!confirm(confirm_msg)) return;

  await updateDoc(doc(db, "users", uid), { role });

  // Update local
  const u = allUsers.find(u => u.id === uid);
  if (u) u.role = role;
  renderTable();
};

window.setFilter = (f, el) => {
  currentFilter = f;
  document.querySelectorAll(".filter-btn").forEach(b => b.classList.remove("active"));
  el.classList.add("active");
  renderTable();
};

document.getElementById("search-input").addEventListener("input", renderTable);

onAuthStateChanged(auth, async (user) => {
  if (!user) { window.location.replace("../pages/auth.html"); return; }
  currentUser = user;

  // Check if admin
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

  document.getElementById("logout-btn-mobile")?.addEventListener("click", async (e) => {
    e.preventDefault();
    await signOut(auth);
    window.location.replace("../pages/auth.html");
  });

  // Go to app
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
  allUsers = usersSnap.docs.map(d => ({ id: d.id, ...d.data() }))
    .sort((a, b) => {
      const da = a.createdAt?.toDate?.() || new Date(0);
      const db2 = b.createdAt?.toDate?.() || new Date(0);
      return db2 - da;
    });

  renderTable();
});