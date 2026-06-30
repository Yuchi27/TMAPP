import { auth, db } from "./firebase.js";
import { onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";
import {
  collection, query, orderBy, onSnapshot, addDoc,
  updateDoc, doc, serverTimestamp, getDoc, getDocs,
  where, arrayUnion, limit, deleteDoc, writeBatch
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

let currentUser = null;
let currentUserData = null;
let activeConvId = null;
let activeConvData = null;
let activeTab = "dm"; // "dm" | "group"
let allConvs = [];
let selectedUsers = []; // for new chat modal
let newChatMode = "dm"; // "dm" | "group"
let unsubConvs = null;
let unsubMessages = null;

// ── Auth ──
onAuthStateChanged(auth, async (user) => {
  if (!user) { window.location.href = "auth.html"; return; }
  currentUser = user;
  const snap = await getDoc(doc(db, "users", user.uid));
  currentUserData = snap.exists() ? snap.data() : {};
  document.getElementById("loader").style.display = "none";
  subscribeToConversations();
  await updateDoc(doc(db, "users", user.uid), { online: true, lastSeen: serverTimestamp() }).catch(() => {});
});

document.getElementById("logout-btn")?.addEventListener("click", async (e) => {
  e.preventDefault();
  await updateDoc(doc(db, "users", currentUser.uid), { online: false }).catch(() => {});
  await signOut(auth);
  window.location.href = "auth.html";
});

// ── Conversations subscription ──
function subscribeToConversations() {
  if (unsubConvs) unsubConvs();
  const q = query(
    collection(db, "conversations"),
    where("memberIds", "array-contains", currentUser.uid),
    orderBy("lastMessageAt", "desc")
  );
  unsubConvs = onSnapshot(q, (snap) => {
    allConvs = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    renderConvList();
  });
}

function renderConvList() {
  const filtered = allConvs.filter(c => {
    if (activeTab === "dm") return c.type === "dm";
    return c.type === "group";
  });
  const search = document.getElementById("conv-search").value.toLowerCase();
  const list = filtered.filter(c => {
    const name = getConvDisplayName(c).toLowerCase();
    return name.includes(search);
  });
  const el = document.getElementById("conv-list");
  if (!list.length) {
    el.innerHTML = `<div class="conv-empty">No ${activeTab === "dm" ? "direct messages" : "groups"} yet<br>
      <small>Click the ✏️ button to start one</small></div>`;
    return;
  }
  el.innerHTML = list.map(c => buildConvItem(c)).join("");
}

function getConvDisplayName(conv) {
  if (conv.type === "group") return conv.name || "Group";
  const other = (conv.members || []).find(m => m.uid !== currentUser.uid);
  return other?.name || other?.email || "Unknown";
}

function getConvAvatar(conv) {
  if (conv.type === "group") return `<div class="conv-avatar group-av"><i class="ti ti-users"></i></div>`;
  const other = (conv.members || []).find(m => m.uid !== currentUser.uid);
  if (other?.photoURL) return `<div class="conv-avatar"><img src="${other.photoURL}" alt=""></div>`;
  const initials = (other?.name || other?.email || "U")[0].toUpperCase();
  return `<div class="conv-avatar">${initials}</div>`;
}

function buildConvItem(conv) {
  const name = getConvDisplayName(conv);
  const avatarHtml = getConvAvatar(conv);
  const preview = conv.lastMessage || "No messages yet";
  const time = conv.lastMessageAt?.toDate ? timeAgo(conv.lastMessageAt.toDate()) : "";
  const unread = (conv.unread || {})[currentUser.uid] || 0;
  const isActive = conv.id === activeConvId ? "active" : "";
  return `
  <div class="conv-item ${isActive}" onclick="openConversation('${conv.id}')">
    ${avatarHtml}
    <div class="conv-info">
      <div class="conv-name">${escHtml(name)}</div>
      <div class="conv-preview ${unread > 0 ? 'unread' : ''}">${escHtml(preview)}</div>
    </div>
    <div class="conv-meta">
      <span class="conv-time">${time}</span>
      ${unread > 0 ? `<span class="conv-unread-badge">${unread > 9 ? '9+' : unread}</span>` : ''}
    </div>
  </div>`;
}

// ── Tab switch ──
window.switchTab = (tab) => {
  activeTab = tab;
  document.querySelectorAll(".msg-tab").forEach(t => t.classList.remove("active"));
  document.querySelector(`.msg-tab[data-tab="${tab}"]`)?.classList.add("active");

  // Update new chat button behavior
  const newBtn = document.getElementById("new-chat-btn");
  if (tab === "group") {
    newBtn.title = "New Group";
  } else {
    newBtn.title = "New Message";
  }

  renderConvList();
};

window.filterConversations = () => renderConvList();

// ── Open conversation ──
window.openConversation = async (convId) => {
  activeConvId = convId;
  activeConvData = allConvs.find(c => c.id === convId);
  if (!activeConvData) return;

  // Mobile: show chat panel
  document.querySelector(".msg-layout")?.classList.add("chat-open");

  // Mark unread as 0
  const unreadUpdate = {};
  unreadUpdate[`unread.${currentUser.uid}`] = 0;
  await updateDoc(doc(db, "conversations", convId), unreadUpdate).catch(() => {});

  renderConvList();
  renderChatWindow(activeConvData);
  subscribeToMessages(convId);
};

function renderChatWindow(conv) {
  const name = getConvDisplayName(conv);
  const isGroup = conv.type === "group";
  const memberCount = (conv.members || []).length;

  const avatarHtml = isGroup
    ? `<div class="chat-header-avatar group-av"><i class="ti ti-users"></i></div>`
    : (() => {
        const other = (conv.members || []).find(m => m.uid !== currentUser.uid);
        return other?.photoURL
          ? `<div class="chat-header-avatar"><img src="${other.photoURL}" alt=""></div>`
          : `<div class="chat-header-avatar">${(other?.name || "U")[0].toUpperCase()}</div>`;
      })();

  document.getElementById("msg-chat").innerHTML = `
    <div class="chat-header">
      <button class="chat-icon-btn" onclick="closeChatMobile()" style="display:none" id="back-btn">
        <i class="ti ti-arrow-left"></i>
      </button>
      ${avatarHtml}
      <div class="chat-header-info">
        <div class="chat-header-name">${escHtml(name)}</div>
        <div class="chat-header-sub">${isGroup ? `${memberCount} members` : 'Direct Message'}</div>
      </div>
      ${isGroup ? `<button class="chat-icon-btn" onclick="showGroupInfo()" title="Group info"><i class="ti ti-info-circle"></i></button>` : ''}
      <button class="chat-icon-btn" onclick="deleteConversation('${conv.id}')" title="Delete conversation"><i class="ti ti-trash"></i></button>
    </div>
    <div class="chat-messages" id="chat-messages"></div>
    <div class="typing-indicator" id="typing-indicator" style="display:none">
      <div class="typing-dots"><span></span><span></span><span></span></div>
      <span id="typing-text"></span>
    </div>
    <div class="chat-input-area">
      <textarea class="chat-input" id="chat-input" placeholder="Type a message..." rows="1"
        oninput="autoResize(this); handleTyping()"
        onkeydown="if(event.key==='Enter'&&!event.shiftKey){sendMessage();event.preventDefault();}"></textarea>
      <button class="chat-send-btn" onclick="sendMessage()"><i class="ti ti-send"></i></button>
    </div>`;

  // Show back btn on mobile
  if (window.innerWidth <= 768) {
    document.getElementById("back-btn").style.display = "flex";
  }
}

// ── Messages subscription ──
function subscribeToMessages(convId) {
  if (unsubMessages) unsubMessages();
  const q = query(
    collection(db, "conversations", convId, "messages"),
    orderBy("createdAt", "asc"),
    limit(100)
  );
  unsubMessages = onSnapshot(q, (snap) => {
    renderMessages(snap.docs.map(d => ({ id: d.id, ...d.data() })));
  });
}

function renderMessages(messages) {
  const el = document.getElementById("chat-messages");
  if (!el) return;
  let lastDate = null;
  let html = "";

  messages.forEach(msg => {
    const date = msg.createdAt?.toDate ? msg.createdAt.toDate() : new Date();
    const dateStr = date.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" });
    if (dateStr !== lastDate) {
      html += `<div class="chat-date-sep">${dateStr}</div>`;
      lastDate = dateStr;
    }
    html += buildMessageBubble(msg);
  });

  el.innerHTML = html || `<div style="text-align:center;color:#a0aab8;font-size:13px;padding:40px">Start the conversation!</div>`;
  el.scrollTop = el.scrollHeight;
}

function buildMessageBubble(msg) {
  const isMine = msg.senderId === currentUser.uid;
  const time = msg.createdAt?.toDate
    ? msg.createdAt.toDate().toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" })
    : "";
  const avHtml = msg.senderPhoto
    ? `<img src="${msg.senderPhoto}" alt="">`
    : (msg.senderName || "U")[0].toUpperCase();
  const isGroup = activeConvData?.type === "group";

  return `
  <div class="msg-row ${isMine ? 'mine' : ''}">
    ${!isMine ? `<div class="msg-row-avatar">${avHtml}</div>` : ''}
    <div class="msg-bubble-wrap">
      ${isGroup && !isMine ? `<div class="msg-sender-name">${escHtml(msg.senderName || "User")}</div>` : ''}
      <div class="msg-bubble">${escHtml(msg.text)}</div>
      <div class="msg-time">${time}</div>
    </div>
  </div>`;
}

// ── Send message ──
window.sendMessage = async () => {
  const input = document.getElementById("chat-input");
  const text = input?.value?.trim();
  if (!text || !activeConvId) return;
  input.value = "";
  autoResize(input);

  const msgData = {
    text,
    senderId: currentUser.uid,
    senderName: currentUserData.name || currentUser.email,
    senderPhoto: currentUserData.photoURL || null,
    createdAt: serverTimestamp()
  };

  await addDoc(collection(db, "conversations", activeConvId, "messages"), msgData);

  // Update conversation metadata + unread counts
  const conv = allConvs.find(c => c.id === activeConvId);
  const unreadUpdate = { lastMessage: text, lastMessageAt: serverTimestamp() };
  (conv?.memberIds || []).forEach(uid => {
    if (uid !== currentUser.uid) {
      unreadUpdate[`unread.${uid}`] = ((conv?.unread || {})[uid] || 0) + 1;
    }
  });
  await updateDoc(doc(db, "conversations", activeConvId), unreadUpdate);
};

// ── Typing indicator ──
let typingTimeout = null;
window.handleTyping = async () => {
  if (!activeConvId) return;
  await updateDoc(doc(db, "conversations", activeConvId), {
    [`typing.${currentUser.uid}`]: true
  }).catch(() => {});
  clearTimeout(typingTimeout);
  typingTimeout = setTimeout(async () => {
    await updateDoc(doc(db, "conversations", activeConvId), {
      [`typing.${currentUser.uid}`]: false
    }).catch(() => {});
  }, 2000);
};

// ── Auto-resize textarea ──
window.autoResize = (el) => {
  el.style.height = "auto";
  el.style.height = Math.min(el.scrollHeight, 140) + "px";
};

// ── Mobile back ──
window.closeChatMobile = () => {
  document.querySelector(".msg-layout")?.classList.remove("chat-open");
  activeConvId = null;
};

// ── Delete conversation ──
window.deleteConversation = async (convId) => {
  const conv = allConvs.find(c => c.id === convId);
  const name = conv ? getConvDisplayName(conv) : "this conversation";
  if (!confirm(`Delete conversation with ${name}? All messages will be permanently removed.`)) return;

  try {
    // Delete all messages in the subcollection first
    const msgsSnap = await getDocs(collection(db, "conversations", convId, "messages"));
    if (!msgsSnap.empty) {
      const batch = writeBatch(db);
      msgsSnap.forEach(msgDoc => batch.delete(msgDoc.ref));
      await batch.commit();
    }

    // Delete the conversation document itself
    await deleteDoc(doc(db, "conversations", convId));

    // Reset chat panel
    if (activeConvId === convId) {
      activeConvId = null;
      activeConvData = null;
      document.querySelector(".msg-layout")?.classList.remove("chat-open");
      document.getElementById("msg-chat").innerHTML = `
        <div class="chat-placeholder">
          <i class="ti ti-messages" style="font-size:48px;color:#c8d0e0"></i>
          <p>Select a conversation to start chatting</p>
          <button class="btn-start-chat" onclick="openNewChatModal()"><i class="ti ti-plus"></i> New Message</button>
        </div>`;
    }
  } catch (e) {
    console.error(e);
    alert("Failed to delete conversation.");
  }
};

// ── New Chat Modal ──
window.openNewChatModal = () => {
  newChatMode = activeTab;
  selectedUsers = [];

  const title = document.getElementById("new-modal-title");
  const label = document.getElementById("new-modal-label");
  const groupNameField = document.getElementById("group-name-field");
  const createLabel = document.getElementById("create-btn-label");

  if (newChatMode === "group") {
    title.textContent = "New Group Chat";
    label.textContent = "Add members (search by email)";
    groupNameField.style.display = "block";
    createLabel.textContent = "Create Group";
  } else {
    title.textContent = "New Direct Message";
    label.textContent = "Search users by email";
    groupNameField.style.display = "none";
    createLabel.textContent = "Start Chat";
  }

  document.getElementById("user-search-input").value = "";
  document.getElementById("group-name-input").value = "";
  document.getElementById("user-search-results").innerHTML = "";
  document.getElementById("selected-users").innerHTML = "";
  document.getElementById("new-dm-modal").style.display = "flex";
};

window.closeNewChatModal = () => {
  document.getElementById("new-dm-modal").style.display = "none";
  selectedUsers = [];
};

// ── User search ──
let searchDebounce = null;
window.searchUsers = () => {
  clearTimeout(searchDebounce);
  searchDebounce = setTimeout(doUserSearch, 350);
};

async function doUserSearch() {
  const input = document.getElementById("user-search-input").value.trim().toLowerCase();
  const resultsEl = document.getElementById("user-search-results");
  if (!input || input.length < 2) { resultsEl.innerHTML = ""; return; }

  // Search users by email prefix in Firestore
  const snap = await getDocs(
    query(collection(db, "users"),
      where("email", ">=", input),
      where("email", "<=", input + "\uf8ff"),
      limit(8))
  );

  const users = snap.docs
    .map(d => ({ id: d.id, ...d.data() }))
    .filter(u => u.id !== currentUser.uid && !selectedUsers.find(s => s.uid === u.id));

  if (!users.length) {
    resultsEl.innerHTML = `<div style="padding:12px;text-align:center;color:#a0aab8;font-size:13px">No users found</div>`;
    return;
  }

  resultsEl.innerHTML = users.map(u => {
    const avHtml = u.photoURL
      ? `<img src="${u.photoURL}" alt="">`
      : `<i class="ti ti-user"></i>`;
    return `
    <div class="user-result-item">
      <div class="user-result-avatar">${avHtml}</div>
      <div style="flex:1">
        <div class="user-result-name">${escHtml(u.name || u.email)}</div>
        <div class="user-result-email">${escHtml(u.email)}</div>
      </div>
      <button class="add-btn" onclick="addUserToSelection('${u.id}', '${escHtml(u.name || u.email)}', '${u.email}', '${u.photoURL || ''}')">
        <i class="ti ti-plus"></i> Add
      </button>
    </div>`;
  }).join("");
}

window.addUserToSelection = (uid, name, email, photoURL) => {
  if (selectedUsers.find(u => u.uid === uid)) return;

  // For DMs: only allow 1 user
  if (newChatMode === "dm" && selectedUsers.length >= 1) {
    selectedUsers = [];
  }

  selectedUsers.push({ uid, name, email, photoURL });
  renderSelectedUsers();
  document.getElementById("user-search-results").innerHTML = "";
  document.getElementById("user-search-input").value = "";
};

function renderSelectedUsers() {
  document.getElementById("selected-users").innerHTML = selectedUsers.map(u => `
    <div class="selected-chip">
      ${escHtml(u.name || u.email)}
      <button class="chip-remove" onclick="removeFromSelection('${u.uid}')">
        <i class="ti ti-x" style="font-size:9px"></i>
      </button>
    </div>`).join("");
}

window.removeFromSelection = (uid) => {
  selectedUsers = selectedUsers.filter(u => u.uid !== uid);
  renderSelectedUsers();
};

// ── Create conversation ──
window.createConversation = async () => {
  if (!selectedUsers.length) {
    alert("Please select at least one user.");
    return;
  }

  const isGroup = newChatMode === "group";

  if (isGroup && selectedUsers.length < 1) {
    alert("Add at least one member to create a group.");
    return;
  }

  const groupName = document.getElementById("group-name-input").value.trim();
  if (isGroup && !groupName) {
    alert("Please enter a group name.");
    return;
  }

  const me = {
    uid: currentUser.uid,
    name: currentUserData.name || currentUser.email,
    email: currentUser.email,
    photoURL: currentUserData.photoURL || null
  };

  const members = [me, ...selectedUsers.map(u => ({
    uid: u.uid, name: u.name, email: u.email, photoURL: u.photoURL || null
  }))];
  const memberIds = members.map(m => m.uid);

  // For DMs: check if convo already exists (query Firestore directly, not just local cache)
  if (!isGroup) {
    const otherUid = selectedUsers[0].uid;
    const dupCheckSnap = await getDocs(
      query(collection(db, "conversations"),
        where("type", "==", "dm"),
        where("memberIds", "array-contains", currentUser.uid))
    );
    const existingDoc = dupCheckSnap.docs.find(d =>
      (d.data().memberIds || []).includes(otherUid)
    );
    if (existingDoc) {
      closeNewChatModal();
      activeTab = "dm";
      document.querySelectorAll(".msg-tab").forEach(t => t.classList.remove("active"));
      document.querySelector(`.msg-tab[data-tab="dm"]`)?.classList.add("active");
      renderConvList();
      openConversation(existingDoc.id);
      return;
    }
  }

  const convData = {
    type: isGroup ? "group" : "dm",
    name: isGroup ? groupName : null,
    members,
    memberIds,
    createdAt: serverTimestamp(),
    lastMessage: null,
    lastMessageAt: serverTimestamp(),
    unread: {}
  };

  const ref = await addDoc(collection(db, "conversations"), convData);
  closeNewChatModal();

  // Switch to proper tab and open
  activeTab = isGroup ? "group" : "dm";
  document.querySelectorAll(".msg-tab").forEach(t => t.classList.remove("active"));
  document.querySelector(`.msg-tab[data-tab="${activeTab}"]`)?.classList.add("active");
  renderConvList();
  setTimeout(() => openConversation(ref.id), 400);
};

// ── Group Info ──
window.showGroupInfo = () => {
  if (!activeConvData) return;
  const members = activeConvData.members || [];
  const membersHtml = members.map(m => {
    const avHtml = m.photoURL ? `<img src="${m.photoURL}" alt="">` : (m.name || "U")[0].toUpperCase();
    return `
    <div class="group-member-item">
      <div class="gm-avatar">${avHtml}</div>
      <div>
        <div class="gm-name">${escHtml(m.name || m.email)}</div>
        <div class="gm-role">${m.uid === currentUser.uid ? 'You' : 'Member'}</div>
      </div>
    </div>`;
  }).join("");

  // Show in a simple alert-style overlay
  const overlay = document.createElement("div");
  overlay.className = "modal-overlay";
  overlay.style.zIndex = "1001";
  overlay.innerHTML = `
    <div class="new-chat-modal" style="max-width:360px">
      <div class="modal-header">
        <h3>${escHtml(activeConvData.name || "Group")}</h3>
        <button class="modal-close-btn" onclick="this.closest('.modal-overlay').remove()"><i class="ti ti-x"></i></button>
      </div>
      <div class="modal-body">
        <div style="font-size:12px;font-weight:700;color:#6b7a99;margin-bottom:10px">MEMBERS (${members.length})</div>
        <div class="group-members-list">${membersHtml}</div>
      </div>
      <div class="modal-footer">
        <button class="btn-primary" onclick="this.closest('.modal-overlay').remove()">Close</button>
      </div>
    </div>`;
  document.body.appendChild(overlay);
};

// ── Helpers ──
function timeAgo(date) {
  const diff = Date.now() - date.getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "now";
  if (mins < 60) return `${mins}m`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h`;
  const days = Math.floor(hrs / 24);
  if (days < 7) return `${days}d`;
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function escHtml(str) {
  if (!str) return "";
  return String(str).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}