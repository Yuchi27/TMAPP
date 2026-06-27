import { auth, db } from "./firebase.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";
import {
  collection, query, onSnapshot, orderBy,
  doc, setDoc, addDoc, serverTimestamp, getDocs, where
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";
import { getApps } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";

const VAPID_KEY = "BC5yN146NT4RW9xYzIjTY-sA3uQhchzFMWwPbxY9O4-OZiNvdzEL3LhqCXIafenBXQmt2xnGZrh197bBnI7lTwI";

// ── Request notification permission + get FCM token ──
// NOTE: firebase-messaging.js gi-import DYNAMICALLY dinhi (dili sa taas sa
// file). Kung ma-block ni sa ad-blocker o mag-fail sa pag-load, dili na
// makaapekto sa uban parts sa app — push notifications ra ang mawala,
// dashboard/tasks/etc. magpadayon gihapon og normal.
export async function initNotifications(userId) {
  if (!("Notification" in window)) return;
  if (!("serviceWorker" in navigator)) return;
  if (!VAPID_KEY || VAPID_KEY === "YOUR_VAPID_KEY") {
    console.log("Push notifications skipped: VAPID key dili pa na-set.");
    return;
  }

  try {
    const permission = await Notification.requestPermission();
    if (permission !== "granted") return;

    const { getMessaging, getToken, onMessage } = await import(
      "https://www.gstatic.com/firebasejs/10.12.0/firebase-messaging.js"
    );

    const app = getApps()[0];
    const messaging = getMessaging(app);

    const token = await getToken(messaging, { vapidKey: VAPID_KEY });
    if (!token) return;

    // Save token sa Firestore
    await setDoc(doc(db, "users", userId, "fcmTokens", token), {
      token,
      createdAt: serverTimestamp()
    });

    console.log("FCM Token saved:", token);

    // Handle foreground messages
    onMessage(messaging, (payload) => {
      const { title, body } = payload.notification || {};
      showInAppNotification(title, body, userId);
    });

  } catch (e) {
    // Push notifications failed (blocked, unsupported, network, etc).
    // Swallow it — in-app notifications (bell dropdown) still work fine
    // via loadNotifications() below, which doesn't depend on this.
    console.log("Push notification setup skipped:", e.message || e);
  }
}

// ── Save in-app notification sa Firestore ──
export async function saveNotification(userId, title, body, url = "/pages/dashboard.html") {
  try {
    await addDoc(collection(db, "users", userId, "notifications"), {
      title,
      body,
      url,
      read: false,
      createdAt: serverTimestamp()
    });
  } catch (e) {
    console.log("saveNotification error:", e.message || e);
  }
}

// ── Show in-app notification (toast) ──
export function showInAppNotification(title, body, userId) {
  try {
    updateBellBadge(userId);

    const toast = document.createElement("div");
    toast.className = "notif-toast";
    toast.innerHTML = `
      <div class="notif-toast-title">${title}</div>
      <div class="notif-toast-body">${body}</div>
    `;
    document.body.appendChild(toast);
    setTimeout(() => toast.classList.add("show"), 100);
    setTimeout(() => {
      toast.classList.remove("show");
      setTimeout(() => toast.remove(), 400);
    }, 4000);
  } catch (e) {
    console.log("showInAppNotification error:", e.message || e);
  }
}

// ── Update bell badge count ──
export async function updateBellBadge(userId) {
  try {
    const snap = await getDocs(
      query(
        collection(db, "users", userId, "notifications"),
        where("read", "==", false)
      )
    );
    const count = snap.size;
    const badge = document.getElementById("notif-badge");
    if (badge) {
      badge.textContent = count;
      badge.style.display = count > 0 ? "flex" : "none";
    }
  } catch (e) {}
}

// ── Check deadlines — trigger notification if < 24hrs ──
export function checkDeadlines(userId, tasks) {
  try {
    const now = new Date();
    const in24 = new Date(now.getTime() + 24 * 60 * 60 * 1000);

    tasks.forEach(async (task) => {
      if (task.status === "completed" || !task.deadline) return;
      const deadline = task.deadline.toDate ? task.deadline.toDate() : new Date(task.deadline);

      if (deadline > now && deadline <= in24) {
        const hoursLeft = Math.round((deadline - now) / (1000 * 60 * 60));
        const title = "⏰ Deadline Alert!";
        const body = `"${task.title}" is due in ${hoursLeft} hour${hoursLeft !== 1 ? "s" : ""}!`;

        showInAppNotification(title, body, userId);
        await saveNotification(userId, title, body, "/pages/tasks.html");
      }
    });
  } catch (e) {
    console.log("checkDeadlines error:", e.message || e);
  }
}

// ── Load notifications dropdown ──
export function loadNotifications(userId) {
  try {
    const listEl = document.getElementById("notif-list");
    if (!listEl) return;

    const q = query(
      collection(db, "users", userId, "notifications"),
      orderBy("createdAt", "desc")
    );

    onSnapshot(q, (snap) => {
      const notifs = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      const unread = notifs.filter(n => !n.read).length;

      const badge = document.getElementById("notif-badge");
      if (badge) {
        badge.textContent = unread;
        badge.style.display = unread > 0 ? "flex" : "none";
      }

      if (!notifs.length) {
        listEl.innerHTML = `<div class="notif-empty">No notifications yet</div>`;
        return;
      }

      listEl.innerHTML = notifs.slice(0, 10).map(n => `
        <div class="notif-item ${n.read ? "" : "unread"}" onclick="markRead('${n.id}', '${userId}', '${n.url || ""}')">
          <div class="notif-item-title">${n.title}</div>
          <div class="notif-item-body">${n.body}</div>
          <div class="notif-item-time">${formatTime(n.createdAt)}</div>
        </div>
      `).join("");
    }, (err) => {
      console.log("loadNotifications snapshot error:", err.message || err);
    });
  } catch (e) {
    console.log("loadNotifications error:", e.message || e);
  }
}

function formatTime(ts) {
  if (!ts) return "";
  const d = ts.toDate ? ts.toDate() : new Date(ts);
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" }) + " " +
    d.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" });
}

window.markRead = async (notifId, userId, url) => {
  try {
    const { updateDoc } = await import("https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js");
    await updateDoc(doc(db, "users", userId, "notifications", notifId), { read: true });
    if (url) window.location.href = url;
  } catch (e) {
    console.log("markRead error:", e.message || e);
  }
};