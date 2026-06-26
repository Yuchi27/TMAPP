// Register Service Worker
if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("/sw.js").catch(() => {});
  });
}

// Install prompt
let deferredPrompt;
window.addEventListener("beforeinstallprompt", (e) => {
  deferredPrompt = e;  // ← TANGTANGA ang e.preventDefault()
});

window.installApp = async () => {
  if (!deferredPrompt) return;
  deferredPrompt.prompt();
  const { outcome } = await deferredPrompt.userChoice;
  deferredPrompt = null;
};

window.addEventListener("appinstalled", () => {
  console.log("TMAPP installed!");
});