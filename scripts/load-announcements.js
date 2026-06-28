
import { db } from "./firebase.js";
import {
  collection, query, orderBy, limit, onSnapshot
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

const typeConfig = {
  info:    { emoji: "ℹ️", color: "#4a7cff", bg: "#eef2ff" },
  warning: { emoji: "⚠️", color: "#f5a623", bg: "#fff8ee" },
  success: { emoji: "✅", color: "#27ae60", bg: "#eefff4" },
  urgent:  { emoji: "🚨", color: "#e74c3c", bg: "#fff0ee" },
};

export function loadUserAnnouncements(elementId = "announcements-list") {
  const el = document.getElementById(elementId);
  if (!el) return;

  const q = query(collection(db, "announcements"), orderBy("createdAt", "desc"), limit(5));
  onSnapshot(q, (snap) => {
    const anns = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    el.innerHTML = anns.length
      ? anns.map(a => {
          const cfg = typeConfig[a.type] || typeConfig.info;
          return `
<div class="user-ann-card">

    <div class="user-ann-header">
        <div class="user-ann-icon" style="background:${cfg.bg};color:${cfg.color}">
            ${cfg.emoji}
        </div>

        <div class="user-ann-info">
            <div class="user-ann-title">${a.title}</div>
            <div class="user-ann-author">
                <div class="user-ann-meta">Posted by Taskora Team</div>
            </div>
        </div>
    </div>

    <div class="user-ann-body">
        ${a.body}
    </div>

</div>`;
        }).join("")
      : `<p class="panel-empty" style="color:#8a9bb0">No announcements</p>`;
  });
}