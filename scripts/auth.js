import { auth, db } from "../scripts/firebase.js";
import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  sendPasswordResetEmail,
  setPersistence,
  browserLocalPersistence,
  browserSessionPersistence,
  onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";
import {
  doc,
  setDoc,
  getDoc,
  serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

// ── Helper: check role then redirect ──
async function redirectByRole(user) {
  console.log("redirectByRole called");
  try {
    const snap = await getDoc(doc(db, "users", user.uid));
    console.log("UID:", user.uid);
    console.log("Doc exists:", snap.exists());
    console.log("Data:", snap.data());
    if (snap.exists() && snap.data().role === "admin") {
      window.location.replace("../admin/dashboard.html");
    } else {
      window.location.replace("dashboard.html");
    }
  } catch(e) {
    console.log("Error:", e);
    window.location.replace("dashboard.html");
  }
}

// ── Kung naka-login na, diretso sa tamang dashboard ──
onAuthStateChanged(auth, async (user) => {
  if (!user) return;
  if (window.location.pathname.includes("auth.html")) {
    await redirectByRole(user);
  }
});

// ── Show/hide panels ──
window.show = (v) => {
  ['login', 'register', 'forgot'].forEach(x => {
    document.getElementById('v-' + x).style.display = 'none';
  });
  document.getElementById('v-' + v).style.display = 'flex';
  ['li-msg', 'rg-msg', 'fp-msg'].forEach(id => {
    const e = document.getElementById(id);
    if (e) { e.textContent = ''; e.className = 'msg'; }
  });
};

const setMsg = (id, text, type) => {
  const e = document.getElementById(id);
  e.textContent = text;
  e.className = 'msg ' + type;
};

// ── LOGIN ──
window.doLogin = async () => {
  const email = document.getElementById('li-email').value.trim();
  const pass  = document.getElementById('li-pass').value;
  const rem   = document.getElementById('li-rem').checked;

  if (!email || !pass) return setMsg('li-msg', 'Fill in all fields.', 'err');

  try {
    await setPersistence(auth, rem ? browserLocalPersistence : browserSessionPersistence);
    const cred = await signInWithEmailAndPassword(auth, email, pass);
    await redirectByRole(cred.user);
  } catch (e) {
    const errors = {
      'auth/invalid-credential': 'Invalid email or password.',
      'auth/user-not-found':     'No account with that email.',
      'auth/wrong-password':     'Incorrect password.',
      'auth/too-many-requests':  'Too many attempts. Try again later.'
    };
    setMsg('li-msg', errors[e.code] || e.message, 'err');
  }
};

// ── REGISTER ──
window.doRegister = async () => {
  const name  = document.getElementById('rg-name').value.trim();
  const email = document.getElementById('rg-email').value.trim();
  const pass  = document.getElementById('rg-pass').value;
  const pass2 = document.getElementById('rg-pass2').value;

  if (!name || !email || !pass || !pass2) return setMsg('rg-msg', 'Fill in all fields.', 'err');
  if (pass !== pass2) return setMsg('rg-msg', 'Passwords do not match.', 'err');
  if (pass.length < 6) return setMsg('rg-msg', 'Password must be 6+ characters.', 'err');

  try {
    const cred = await createUserWithEmailAndPassword(auth, email, pass);
    await setDoc(doc(db, "users", cred.user.uid), {
      name:      name,
      email:     email,
      role:      "user",
      createdAt: serverTimestamp()
    });
    window.location.replace("dashboard.html");
  } catch (e) {
    const errors = {
      'auth/email-already-in-use': 'Email already registered.',
      'auth/invalid-email':        'Invalid email address.',
      'auth/weak-password':        'Password is too weak.'
    };
    setMsg('rg-msg', errors[e.code] || e.message, 'err');
  }
};

// ── FORGOT PASSWORD ──
window.doForgot = async () => {
  const email = document.getElementById('fp-email').value.trim();
  if (!email) return setMsg('fp-msg', 'Enter your email.', 'err');

  try {
    await sendPasswordResetEmail(auth, email);
    setMsg('fp-msg', 'Reset link sent! Check your inbox.', 'ok');
  } catch (e) {
    const errors = {
      'auth/user-not-found': 'No account with that email.',
      'auth/invalid-email':  'Invalid email address.'
    };
    setMsg('fp-msg', errors[e.code] || e.message, 'err');
  }
};