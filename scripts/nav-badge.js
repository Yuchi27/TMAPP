import { auth, db } from "./firebase.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";
import {
  collection, query, where, onSnapshot
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

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