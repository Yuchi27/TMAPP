import { auth, db } from "./firebase.js";
import { onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";
import {
  collection, query, orderBy, onSnapshot, addDoc,
  updateDoc, doc, serverTimestamp, getDoc, getDocs,
  arrayUnion, arrayRemove, where, limit, deleteDoc
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

let currentUser = null;
let currentUserData = null;
let selectedPostType = "update";
let unsubFeed = null;
let currentPosts = [];

// ── Tag buttons ──
document.querySelectorAll(".tag-btn").forEach(btn => {
  btn.addEventListener("click", () => {
    document.querySelectorAll(".tag-btn").forEach(b => b.classList.remove("active"));
    btn.classList.add("active");
    selectedPostType = btn.dataset.type;
  });
});

// ── Auth ──
onAuthStateChanged(auth, async (user) => {
  if (!user) { window.location.href = "auth.html"; return; }
  currentUser = user;

  const snap = await getDoc(doc(db, "users", user.uid));
  currentUserData = snap.exists() ? snap.data() : {};

  // Update composer avatar
  const av = document.getElementById("composer-avatar");
  if (currentUserData.photoURL) {
    av.innerHTML = `<img src="${currentUserData.photoURL}" alt="avatar">`;
  }

  // Hide loader
  document.getElementById("loader").style.display = "none";

  subscribeToFeed();
  loadActiveUsers();
  loadTopPosts();

  // Mark user as online
  await updateDoc(doc(db, "users", user.uid), {
    lastSeen: serverTimestamp(),
    online: true
  }).catch(() => {});
});

// ── Logout ──
document.getElementById("logout-btn")?.addEventListener("click", async (e) => {
  e.preventDefault();
  await signOut(auth);
  window.location.href = "auth.html";
});

// ── Feed ──
function subscribeToFeed() {
  const q = query(collection(db, "posts"), orderBy("createdAt", "desc"), limit(50));
  unsubFeed = onSnapshot(q, (snap) => {
    renderFeed(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    loadTopPosts(snap.docs.map(d => ({ id: d.id, ...d.data() })));
  });
}

function renderFeed(posts) {
  currentPosts = posts;
  const el = document.getElementById("feed-list");
  if (!posts.length) {
    el.innerHTML = `<div class="feed-empty"><i class="ti ti-mood-empty"></i><br>No posts yet. Be the first to share!</div>`;
    return;
  }
  el.innerHTML = posts.map(p => buildPostCard(p)).join("");
}

function buildPostCard(post) {
  const isLiked = (post.likes || []).includes(currentUser?.uid);
  const isAuthor = post.authorId === currentUser?.uid;
  const likeCount = (post.likes || []).length;
  const commentCount = (post.comments || []).length;
  const avatarHtml = post.authorPhoto
    ? `<img src="${post.authorPhoto}" alt="">`
    : `<i class="ti ti-user"></i>`;
  const timeStr = post.createdAt?.toDate
    ? timeAgo(post.createdAt.toDate())
    : "Just now";

  return `
  <div class="post-card" id="post-${post.id}">
    <div class="post-header">
      <div class="post-avatar">${avatarHtml}</div>
      <div class="post-meta">
        <div class="post-author">${escHtml(post.authorName || "User")}</div>
        <div class="post-time">${timeStr}</div>
      </div>
      <span class="post-type-badge ${post.type || 'update'}">${post.type || 'update'}</span>
      ${isAuthor ? `
      <button class="post-delete-btn" onclick="deletePost('${post.id}')" title="Delete post">
        <i class="ti ti-trash"></i>
      </button>` : ''}
    </div>
    <div class="post-content">${escHtml(post.content)}</div>
    <div class="post-actions">
      <button class="post-action-btn ${isLiked ? 'liked' : ''}" onclick="toggleLike('${post.id}', ${isLiked})">
        <i class="ti ti-heart${isLiked ? '-filled' : ''}"></i> ${likeCount || ''} Like
      </button>
      <button class="post-action-btn" onclick="toggleComments('${post.id}')">
        <i class="ti ti-message-circle"></i> ${commentCount || ''} Comment
      </button>
    </div>
    <div class="post-comments" id="comments-${post.id}" style="display:none">
      ${(post.comments || []).map((c, idx) => buildComment(c, post.id, idx)).join("")}
      <div class="comment-input-row">
        <div class="comment-avatar">${avatarHtml}</div>
        <input class="comment-input" type="text" placeholder="Write a comment..."
          id="comment-input-${post.id}"
          onkeydown="if(event.key==='Enter' && !event.shiftKey){submitComment('${post.id}');event.preventDefault();}">
        <button class="comment-send-btn" onclick="submitComment('${post.id}')">
          <i class="ti ti-send"></i>
        </button>
      </div>
    </div>
  </div>`;
}

function buildComment(c, postId, idx) {
  const avHtml = c.authorPhoto
    ? `<img src="${c.authorPhoto}" alt="">`
    : `<i class="ti ti-user" style="font-size:12px"></i>`;
  const isCommentAuthor = c.authorId === currentUser?.uid;
  return `
  <div class="comment-item">
    <div class="comment-avatar">${avHtml}</div>
    <div class="comment-bubble">
      <div class="comment-bubble-top">
        <div class="comment-author">${escHtml(c.authorName || "User")}</div>
        ${isCommentAuthor ? `
        <button class="comment-delete-btn" onclick="deleteComment('${postId}', ${idx})" title="Delete comment">
          <i class="ti ti-x"></i>
        </button>` : ''}
      </div>
      <div class="comment-text">${escHtml(c.text)}</div>
    </div>
  </div>`;
}

// ── Post submission ──
window.submitPost = async () => {
  const content = document.getElementById("post-content").value.trim();
  if (!content) return;

  const btn = document.querySelector(".btn-post");
  btn.disabled = true;
  btn.innerHTML = `<i class="ti ti-loader"></i> Posting...`;

  try {
    await addDoc(collection(db, "posts"), {
      content,
      type: selectedPostType,
      authorId: currentUser.uid,
      authorName: currentUserData.name || currentUser.email,
      authorPhoto: currentUserData.photoURL || null,
      createdAt: serverTimestamp(),
      likes: [],
      comments: []
    });
    document.getElementById("post-content").value = "";
  } catch (e) {
    console.error(e);
  }

  btn.disabled = false;
  btn.innerHTML = `<i class="ti ti-send"></i> Post`;
};

// ── Like ──
window.toggleLike = async (postId, isLiked) => {
  const ref = doc(db, "posts", postId);
  if (isLiked) {
    await updateDoc(ref, { likes: arrayRemove(currentUser.uid) });
  } else {
    await updateDoc(ref, { likes: arrayUnion(currentUser.uid) });
  }
};

// ── Comments ──
window.toggleComments = (postId) => {
  const el = document.getElementById(`comments-${postId}`);
  el.style.display = el.style.display === "none" ? "block" : "none";
  if (el.style.display === "block") {
    document.getElementById(`comment-input-${postId}`)?.focus();
  }
};

window.submitComment = async (postId) => {
  const input = document.getElementById(`comment-input-${postId}`);
  const text = input?.value?.trim();
  if (!text) return;

  const comment = {
    text,
    authorId: currentUser.uid,
    authorName: currentUserData.name || currentUser.email,
    authorPhoto: currentUserData.photoURL || null,
    createdAt: new Date().toISOString()
  };

  await updateDoc(doc(db, "posts", postId), { comments: arrayUnion(comment) });
  if (input) input.value = "";
};

// ── Delete post ──
window.deletePost = async (postId) => {
  if (!confirm("Delete this post? This cannot be undone.")) return;
  try {
    await deleteDoc(doc(db, "posts", postId));
  } catch (e) {
    console.error(e);
    alert("Failed to delete post.");
  }
};

// ── Delete comment ──
window.deleteComment = async (postId, idx) => {
  if (!confirm("Delete this comment?")) return;
  try {
    const post = currentPosts.find(p => p.id === postId);
    if (!post || !post.comments || !post.comments[idx]) return;
    const commentToRemove = post.comments[idx];
    await updateDoc(doc(db, "posts", postId), { comments: arrayRemove(commentToRemove) });
  } catch (e) {
    console.error(e);
    alert("Failed to delete comment.");
  }
};

// ── Active Users sidebar ──
async function loadActiveUsers() {
  const snap = await getDocs(
    query(collection(db, "users"), orderBy("lastSeen", "desc"), limit(8))
  );
  const el = document.getElementById("active-users-list");
  const users = snap.docs.map(d => ({ id: d.id, ...d.data() }))
    .filter(u => u.id !== currentUser.uid);

  if (!users.length) {
    el.innerHTML = `<div class="feed-empty" style="font-size:12px;padding:12px">No other users yet</div>`;
    return;
  }

  el.innerHTML = users.slice(0, 6).map(u => {
    const avHtml = u.photoURL
      ? `<img src="${u.photoURL}" alt="">`
      : `<i class="ti ti-user" style="font-size:14px"></i>`;
    const isOnline = u.online && u.lastSeen?.toDate
      ? (Date.now() - u.lastSeen.toDate().getTime()) < 5 * 60 * 1000
      : false;
    return `
    <div class="active-user-item" onclick="window.location.href='messages.html'">
      <div class="active-user-avatar">${avHtml}${isOnline ? `<span class="online-dot"></span>` : ''}</div>
      <div>
        <div class="active-user-name">${escHtml(u.name || u.email || "User")}</div>
        <div class="active-user-role">${isOnline ? 'Online' : 'Recently active'}</div>
      </div>
    </div>`;
  }).join("");
}

// ── Top Posts sidebar ──
function loadTopPosts(posts) {
  const el = document.getElementById("top-posts-list");
  if (!posts || !posts.length) return;
  const sorted = [...posts].sort((a, b) => (b.likes?.length || 0) - (a.likes?.length || 0)).slice(0, 5);
  el.innerHTML = sorted.map(p => `
    <div class="top-post-item" onclick="document.getElementById('post-${p.id}')?.scrollIntoView({behavior:'smooth'})">
      <div class="top-post-excerpt">${escHtml((p.content || "").slice(0, 60))}${p.content?.length > 60 ? '…' : ''}</div>
      <div class="top-post-likes"><i class="ti ti-heart-filled" style="font-size:10px"></i> ${(p.likes || []).length} likes</div>
    </div>`).join("");
}

// ── Helpers ──
function timeAgo(date) {
  const diff = Date.now() - date.getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "Just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return Math.floor(hrs / 24) + "d ago";
}

function escHtml(str) {
  if (!str) return "";
  return str.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}