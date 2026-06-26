// Register Service Worker
if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("/TMA/root/sw.js").catch(() => {});
  });
}

// Install prompt
let deferredPrompt;
window.addEventListener("beforeinstallprompt", (e) => {
  e.preventDefault();  // ← mao ni ang nagcause sa warning
  deferredPrompt = e;
  const btn = document.getElementById("install-btn");
  if (btn) btn.style.display = "flex";
});

window.installApp = async () => {
  if (!deferredPrompt) return;
  deferredPrompt.prompt();
  const { outcome } = await deferredPrompt.userChoice;
  deferredPrompt = null;
  if (outcome === "accepted") {
    const btn = document.getElementById("install-btn");
    if (btn) btn.style.display = "none";
  }
};

window.addEventListener("appinstalled", () => {
  const btn = document.getElementById("install-btn");
  if (btn) btn.style.display = "none";
});