import { auth, db } from "./firebase.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";
import {
  collection, query, where, onSnapshot
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

function keepActiveNavInView() {
  const nav = document.querySelector(".bottom-nav");
  const active = nav?.querySelector("a.active");
  if (!nav || !active) return;
  // Position instantly (no smooth animation) so it doesn't look like it's "sliding back"
  const target = active.offsetLeft - (nav.clientWidth / 2) + (active.clientWidth / 2);
  nav.scrollLeft = Math.max(0, target);
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", keepActiveNavInView);
} else {
  keepActiveNavInView();
}

onAuthStateChanged(auth, (user) => {
  if (!user) return;

  const q = query(
    collection(db, "conversations"),
    where("memberIds", "array-contains", user.uid)
  );

  onSnapshot(q, (snap) => {
    let total = 0;
    snap.forEach(d => {
      const unread = d.data().unread || {};
      total += unread[user.uid] || 0;
    });
    updateMessagesBadge(total);
  });
});

function updateMessagesBadge(count) {
  document.querySelectorAll(".messages-nav-badge").forEach(el => {
    if (count > 0) {
      el.textContent = count > 9 ? "9+" : count;
      el.style.display = "inline-flex";
    } else {
      el.style.display = "none";
    }
  });
}