  import { auth, db } from "./firebase.js";
  import { onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";
  import {
    collection, query, onSnapshot, orderBy, getDoc, doc
  } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";
  import { initNotifications, loadNotifications, checkDeadlines } from "./notifications.js";
  import { loadUserAnnouncements } from "./load-announcements.js";

  const quotes = [
    { text: "The secret of getting ahead is getting started.", author: "Mark Twain" },
    { text: "It always seems impossible until it's done.", author: "Nelson Mandela" },
    { text: "Don't watch the clock; do what it does. Keep going.", author: "Sam Levenson" },
    { text: "Focus on being productive instead of busy.", author: "Tim Ferriss" },
    { text: "You don't have to be great to start, but you have to start to be great.", author: "Zig Ziglar" },
    { text: "laban diha boss", author: "Archie A.K.A LALANG" },
  ];

  let latestTasks = [];
  let latestSchedules = [];

  function getGreeting() {
    const h = new Date().getHours();
    if (h < 12) return "Good Morning";
    if (h < 18) return "Good Afternoon";
    return "Good Evening";
  }

  function pad(n) { return n.toString().padStart(2, "0"); }
  function dateKey(d) { return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`; }

  function formatDate(ts) {
    if (!ts) return "";
    const d = ts.toDate ? ts.toDate() : new Date(ts);
    return d.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });
  }

  function formatTime12(timeStr) {
    if (!timeStr) return "";
    const [h, m] = timeStr.split(":").map(Number);
    const ampm = h >= 12 ? "PM" : "AM";
    const h12 = h % 12 === 0 ? 12 : h % 12;
    return `${h12}:${pad(m)}${ampm}`;
  }

  function isToday(ts) {
    if (!ts) return false;
    const d = ts.toDate ? ts.toDate() : new Date(ts);
    return d.toDateString() === new Date().toDateString();
  }

  function isUpcoming(ts) {
    if (!ts) return false;
    const d = ts.toDate ? ts.toDate() : new Date(ts);
    const now = new Date();
    const in7 = new Date();
    in7.setDate(now.getDate() + 7);
    return d > now && d <= in7;
  }

  function scheduleDateObj(s) {
    const [y, m, d] = s.date.split("-").map(Number);
    const [h, min] = (s.startTime || "00:00").split(":").map(Number);
    return new Date(y, m - 1, d, h, min);
  }

  function isScheduleToday(s) {
    return s.date === dateKey(new Date());
  }

  function isScheduleUpcoming(s) {
    const d = scheduleDateObj(s);
    const now = new Date();
    const in7 = new Date();
    in7.setDate(now.getDate() + 7);
    return d > now && d <= in7;
  }

  function priorityBadge(p) {
    const cls = p === "High" ? "high" : p === "Medium" ? "medium" : "low";
    return `<span class="priority-badge ${cls}">${p}</span>`;
  }

  function categoryBadge(cat) {
    const cls = cat === "Work" ? "high" : "low";
    return `<span class="priority-badge ${cls}">${cat || "Personal"}</span>`;
  }

  function renderPanelItem(task) {
    return `<div class="panel-item">
      <div class="task-name">${task.title}</div>
      <div class="task-meta">${priorityBadge(task.priority)} &nbsp; ${formatDate(task.deadline)}</div>
    </div>`;
  }

  function formatScheduleDate(dateStr) {
    if (!dateStr) return "";
    const [y, m, d] = dateStr.split("-").map(Number);
    return new Date(y, m - 1, d).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });
  }

  function renderSchedulePanelItem(s) {
    return `<div class="panel-item">
      <div class="task-name">${s.title}</div>
      <div class="task-meta">${categoryBadge(s.category)} &nbsp; ${formatScheduleDate(s.date)} &nbsp; ${formatTime12(s.startTime)}${s.endTime ? " - " + formatTime12(s.endTime) : ""}</div>
    </div>`;
  }

  function renderPanels() {
    const todayTasks = latestTasks.filter(t => t.status !== "completed" && isToday(t.deadline));
    document.getElementById("today-deadlines").innerHTML = todayTasks.length
      ? todayTasks.map(renderPanelItem).join("")
      : `<p class="panel-empty">No deadlines today</p>`;

    const upcomingTasks = latestTasks.filter(t => t.status !== "completed" && isUpcoming(t.deadline));
    document.getElementById("upcoming-deadlines").innerHTML = upcomingTasks.length
      ? upcomingTasks.map(renderPanelItem).join("")
      : `<p class="panel-empty">No upcoming deadlines</p>`;

    const recent = latestTasks.filter(t => t.status === "completed").slice(0, 3);
    document.getElementById("recent-activity").innerHTML = recent.length
      ? recent.map(renderPanelItem).join("")
      : `<p class="panel-empty">No recent activity</p>`;

    const upcomingSchedules = latestSchedules
      .filter(s => isScheduleToday(s) || isScheduleUpcoming(s))
      .sort((a, b) => scheduleDateObj(a) - scheduleDateObj(b));
    document.getElementById("schedules-list").innerHTML = upcomingSchedules.length
      ? upcomingSchedules.map(renderSchedulePanelItem).join("")
      : `<p class="panel-empty">No schedules yet</p>`;
  }

  onAuthStateChanged(auth, async (user) => {
    if (!user) { window.location.replace("auth.html"); return; }

    // Greeting — kini diretso na, dili na hulaton ang notifications
    let name = user.email.split("@")[0];
    try {
      const snap = await getDoc(doc(db, "users", user.uid));
      if (snap.exists() && snap.data().name) name = snap.data().name;
    } catch (e) {
      console.log("Profile name fetch skipped:", e.message || e);
    }
    document.getElementById("greeting-text").textContent = `${getGreeting()}, ${name}!`;

    // Random quote
    const q = quotes[Math.floor(Math.random() * quotes.length)];
    document.getElementById("quote-text").innerHTML = `"${q.text}"<br><br>— ${q.author}`;

    // Logout
    document.getElementById("logout-btn").addEventListener("click", async (e) => {
      e.preventDefault();
      await signOut(auth);
      window.location.replace("auth.html");
    });

    // Notifications — OPTIONAL nga feature. Kung mag-fail ni (blocked sa
    // ad-blocker, walay VAPID key, etc.), dili na makaapekto sa stats/panels
    // sa ubos kay naa sa kaugalingong try/catch.
    try {
      await initNotifications(user.uid);
      loadNotifications(user.uid);
    } catch (e) {
      console.log("Notifications init skipped:", e.message || e);
    }

     loadUserAnnouncements("announcements-list");

    // Real-time tasks — kini ang nag-update sa Total/Pending/Completed/High Priority
    const tasksRef = collection(db, "users", user.uid, "tasks");
    const q2 = query(tasksRef, orderBy("createdAt", "desc"));

    onSnapshot(q2, (snap) => {
      latestTasks = snap.docs.map(d => ({ id: d.id, ...d.data() }));

      document.getElementById("total-tasks").textContent     = latestTasks.length;
      document.getElementById("pending-tasks").textContent   = latestTasks.filter(t => t.status !== "completed").length;
      document.getElementById("completed-tasks").textContent = latestTasks.filter(t => t.status === "completed").length;
      document.getElementById("high-tasks").textContent      = latestTasks.filter(t => t.priority === "High" && t.status !== "completed").length;

      try { checkDeadlines(user.uid, latestTasks); } catch (e) { console.log("checkDeadlines skipped:", e.message || e); }
      renderPanels();
    }, (err) => {
      console.error("Tasks snapshot error:", err);
    });

    // Real-time schedules
    const schedulesRef = collection(db, "users", user.uid, "schedules");
    onSnapshot(schedulesRef, (snap) => {
      latestSchedules = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      renderPanels();
    }, (err) => {
      console.error("Schedules snapshot error:", err);
    });
  });