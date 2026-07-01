import { auth, db } from "./firebase.js";
import { onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";
import {
  collection, getDocs, doc, getDoc, updateDoc, addDoc, serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

let allUsers = [];
let currentFilter = "all";
let currentUser = null;
let adminName = "";

function formatDate(ts) {
  if (!ts) return "—";
  const d = ts.toDate ? ts.toDate() : new Date(ts);
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function getInitial(name) {
  return name ? name.charAt(0).toUpperCase() : "?";
}

async function writeAuditLog(action, targetUser, detail = "") {
  try {
    await addDoc(collection(db, "audit_logs"), {
      action,
      targetUserId: targetUser.id,
      targetUserName: targetUser.name || targetUser.email || "Unknown",
      performedBy: currentUser.uid,
      performedByName: adminName,
      detail,
      createdAt: serverTimestamp()
    });
  } catch (e) {
    console.warn("Audit log failed:", e.message);
  }
}

function statusBadge(status) {
  if (status === "banned")    return `<span class="role-badge banned">Banned</span>`;
  if (status === "suspended") return `<span class="role-badge suspended">Suspended</span>`;
  return `<span class="role-badge active-badge">Active</span>`;
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

  if (currentFilter === "admin")     users = users.filter(u => u.role === "admin");
  if (currentFilter === "user")      users = users.filter(u => u.role !== "admin");
  if (currentFilter === "banned")    users = users.filter(u => u.status === "banned");
  if (currentFilter === "suspended") users = users.filter(u => u.status === "suspended");

  const tbody = document.getElementById("users-tbody");

  if (!users.length) {
    tbody.innerHTML = `<tr><td colspan="6" style="text-align:center;padding:24px;color:#8a9bb0">No users found</td></tr>`;
    return;
  }

  tbody.innerHTML = users.map(u => {
    const isMe    = u.id === currentUser.uid;
    const isAdmin = u.role === "admin";
    const status  = u.status || "active";

    const roleBtn = isMe
      ? `<button class="btn-you"><i class="ti ti-user"></i> You</button>`
      : isAdmin
        ? `<button class="btn-remove-admin" onclick="setRole('${u.id}', 'user')"><i class="ti ti-shield-off"></i> Remove Admin</button>`
        : `<button class="btn-make-admin" onclick="setRole('${u.id}', 'admin')"><i class="ti ti-shield"></i> Make Admin</button>`;

    let statusBtn = "";
    if (!isMe) {
      if (status === "active") {
        statusBtn = `
          <button class="btn-suspend" onclick="setStatus('${u.id}', 'suspended')"><i class="ti ti-player-pause"></i> Suspend</button>
          <button class="btn-ban"     onclick="setStatus('${u.id}', 'banned')"><i class="ti ti-ban"></i> Ban</button>`;
      } else {
        statusBtn = `<button class="btn-unban" onclick="setStatus('${u.id}', 'active')"><i class="ti ti-circle-check"></i> Unban</button>`;
      }
    }

    return `
      <tr class="${status !== "active" ? "row-" + status : ""}">
        <td>
          <div class="user-row-info">
            <div class="user-avatar-sm">${getInitial(u.name)}</div>
            <div class="user-name-sm">${u.name || "Unknown"}</div>
          </div>
        </td>
        <td>${u.email || "—"}</td>
        <td><span class="role-badge ${isAdmin ? "admin" : "user"}">${isAdmin ? "Admin" : "User"}</span></td>
        <td>${statusBadge(status)}</td>
        <td>${formatDate(u.createdAt)}</td>
        <td><div class="action-btns">${roleBtn}${statusBtn}</div></td>
      </tr>
    `;
  }).join("");
}

window.setRole = async (uid, role) => {
  const msg = role === "admin" ? "Make this user an Admin?" : "Remove Admin role from this user?";
  if (!confirm(msg)) return;
  await updateDoc(doc(db, "users", uid), { role });
  const u = allUsers.find(u => u.id === uid);
  if (u) {
    await writeAuditLog(role === "admin" ? "MAKE_ADMIN" : "REMOVE_ADMIN", u, `Role changed to ${role}`);
    u.role = role;
  }
  renderTable();
};

window.setStatus = async (uid, status) => {
  const labels = { banned: "Ban", suspended: "Suspend", active: "Unban" };
  if (!confirm(`${labels[status]} this user?`)) return;
  await updateDoc(doc(db, "users", uid), { status });
  const u = allUsers.find(u => u.id === uid);
  if (u) {
    await writeAuditLog(status.toUpperCase(), u, `Status set to ${status}`);
    u.status = status;
  }
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

  const snap = await getDoc(doc(db, "users", user.uid));
  if (!snap.exists() || snap.data().role !== "admin") {
    window.location.replace("../pages/dashboard.html");
    return;
  }
  adminName = snap.data().name || user.email;

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

  const usersSnap = await getDocs(collection(db, "users"));
  allUsers = usersSnap.docs.map(d => ({ id: d.id, ...d.data() }))
    .sort((a, b) => {
      const da = a.createdAt?.toDate?.() || new Date(0);
      const db2 = b.createdAt?.toDate?.() || new Date(0);
      return db2 - da;
    });

  renderTable();
});