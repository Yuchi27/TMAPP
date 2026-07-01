import { auth, db } from "./firebase.js";
import { onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";
import {
  collection, doc, getDoc, query, orderBy, onSnapshot, deleteDoc, getDocs
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

let allLogs = [];
let currentFilter = "all";

const ACTION_CONFIG = {
  MAKE_ADMIN:    { label: "Make Admin",    icon: "ti-shield",        color: "#6c63ff" },
  REMOVE_ADMIN:  { label: "Remove Admin",  icon: "ti-shield-off",    color: "#f5a623" },
  BANNED:        { label: "Banned",        icon: "ti-ban",           color: "#e74c3c" },
  SUSPENDED:     { label: "Suspended",     icon: "ti-player-pause",  color: "#f5a623" },
  ACTIVE:        { label: "Unbanned",      icon: "ti-circle-check",  color: "#27ae60" },
};

function formatDateTime(ts) {
  if (!ts) return "—";
  const d = ts.toDate ? ts.toDate() : new Date(ts);
  return d.toLocaleDateString("en-US", {
    month: "short", day: "numeric", year: "numeric"
  }) + " · " + d.toLocaleTimeString("en-US", {
    hour: "2-digit", minute: "2-digit"
  });
}

function renderLogs() {
  const search = document.getElementById("log-search").value.toLowerCase();
  let logs = [...allLogs];

  if (currentFilter !== "all") {
    logs = logs.filter(l => l.action === currentFilter);
  }

  if (search) {
    logs = logs.filter(l =>
      (l.targetUserName || "").toLowerCase().includes(search) ||
      (l.performedByName || "").toLowerCase().includes(search) ||
      (l.action || "").toLowerCase().includes(search) ||
      (l.detail || "").toLowerCase().includes(search)
    );
  }

  const tbody = document.getElementById("logs-tbody");
  const countEl = document.getElementById("logs-count");

  if (!logs.length) {
    tbody.innerHTML = `<tr><td colspan="5" style="text-align:center;padding:32px;color:#8a9bb0">
      <i class="ti ti-clipboard-list" style="font-size:28px;display:block;margin-bottom:8px;opacity:0.4"></i>
      No logs found
    </td></tr>`;
    countEl.textContent = "";
    return;
  }

  tbody.innerHTML = logs.map(log => {
    const cfg = ACTION_CONFIG[log.action] || { label: log.action, icon: "ti-activity", color: "#6b7a99" };
    return `
      <tr>
        <td>
          <span class="audit-action-badge" style="background:${cfg.color}22;color:${cfg.color}">
            <i class="ti ${cfg.icon}"></i> ${cfg.label}
          </span>
        </td>
        <td><span class="audit-user">${log.targetUserName || "—"}</span></td>
        <td><span class="audit-by">${log.performedByName || "—"}</span></td>
        <td style="color:#8a9bb0;font-size:12px">${log.detail || "—"}</td>
        <td style="color:#6b7a99;font-size:12px;white-space:nowrap">${formatDateTime(log.createdAt)}</td>
      </tr>
    `;
  }).join("");

  countEl.textContent = `${logs.length} log${logs.length !== 1 ? "s" : ""}`;
}

window.setLogFilter = (f, el) => {
  currentFilter = f;
  document.querySelectorAll(".filter-btn").forEach(b => b.classList.remove("active"));
  el.classList.add("active");
  renderLogs();
};

window.confirmClearLogs = async () => {
  if (!confirm("Clear ALL audit logs? This cannot be undone.")) return;
  const btn = document.getElementById("clear-logs-btn");
  btn.disabled = true;
  btn.innerHTML = `<i class="ti ti-loader"></i> Clearing...`;
  try {
    const snap = await getDocs(collection(db, "audit_logs"));
    await Promise.all(snap.docs.map(d => deleteDoc(doc(db, "audit_logs", d.id))));
  } catch (e) {
    alert("Failed to clear logs: " + e.message);
  } finally {
    btn.disabled = false;
    btn.innerHTML = `<i class="ti ti-trash"></i> Clear All Logs`;
  }
};

document.getElementById("log-search").addEventListener("input", renderLogs);

onAuthStateChanged(auth, async (user) => {
  if (!user) { window.location.replace("../pages/auth.html"); return; }

  const snap = await getDoc(doc(db, "users", user.uid));
  if (!snap.exists() || snap.data().role !== "admin") {
    window.location.replace("../pages/dashboard.html");
    return;
  }

  document.getElementById("logout-btn").addEventListener("click", async (e) => {
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

  // Live listener so new logs appear instantly without refresh
  const q = query(collection(db, "audit_logs"), orderBy("createdAt", "desc"));
  onSnapshot(q, (snap) => {
    allLogs = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    renderLogs();
  }, (err) => {
    console.error("Audit logs error:", err);
    document.getElementById("logs-tbody").innerHTML =
      `<tr><td colspan="5" style="text-align:center;padding:24px;color:#e74c3c">
        Failed to load logs. Check Firestore rules for audit_logs collection.
      </td></tr>`;
  });
});