import { auth, db } from "./firebase.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";
import { doc, getDoc } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

onAuthStateChanged(auth, async (user) => {
  if (!user) return;
  try {
    const snap = await getDoc(doc(db, "users", user.uid));
    if (!snap.exists()) return;
    const { photoURL, name, role } = snap.data();

    // Update topbar avatar on every page
    const avatarEl = document.querySelector(".topbar .avatar");
    if (avatarEl) {
      if (photoURL) {
        avatarEl.innerHTML = `<img src="${photoURL}" alt="avatar"
          style="width:100%;height:100%;object-fit:cover;border-radius:50%;">`;
      } else {
        avatarEl.innerHTML = `<i class="ti ti-user"></i>`;
      }
      // Make avatar clickable → settings
      avatarEl.style.cursor = "pointer";
      avatarEl.title = name || user.email;
      avatarEl.onclick = () => window.location.href = "settings.html";
    }

    // Admins get a quick button back to their Admin Dashboard
    if (role === "admin") {
      const sidebarBottom = document.querySelector(".sidebar-bottom");
      if (sidebarBottom && !document.getElementById("admin-dashboard-link")) {
        const link = document.createElement("a");
        link.id = "admin-dashboard-link";
        link.href = "../admin/dashboard.html";
        link.innerHTML = `<i class="ti ti-shield-check"></i> Admin Dashboard`;
        sidebarBottom.prepend(link);
      }

      const bottomNav = document.querySelector(".bottom-nav");
      if (bottomNav && !document.getElementById("admin-dashboard-link-mobile")) {
        const link = document.createElement("a");
        link.id = "admin-dashboard-link-mobile";
        link.href = "../admin/dashboard.html";
        link.innerHTML = `<i class="ti ti-shield-check"></i> Admin`;
        bottomNav.appendChild(link);
      }
    }
  } catch (e) {
    console.log("load-profile skipped:", e.message);
  }
});