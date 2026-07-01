// Shared theme handler — include this script (as a regular <script>, not
// module) on EVERY page, before main.css visibly paints if possible.
//
// Handles 3 independent things, all persisted to localStorage:
//   1. data-theme   → "light" | "dark"          (your existing toggle)
//   2. data-preset  → "indigo" | "ocean" | ...   (which color palette)
//   3. --tma-accent → custom hex override        (from the color picker)

(function () {
  const savedTheme  = localStorage.getItem("tma-theme");
  const savedPreset = localStorage.getItem("tma-preset");
  const savedAccent = localStorage.getItem("tma-accent-custom");

  if (savedTheme === "dark") {
    document.documentElement.setAttribute("data-theme", "dark");
  }
  if (savedPreset && savedPreset !== "indigo") {
    document.documentElement.setAttribute("data-preset", savedPreset);
  }
  if (savedAccent) {
    document.documentElement.style.setProperty("--tma-accent", savedAccent);
    // keep the "soft" background tint in sync with the custom accent too
    document.documentElement.style.setProperty("--tma-accent-soft", hexToSoftRgba(savedAccent));
  }
})();

function hexToSoftRgba(hex, alpha = 0.12) {
  const clean = hex.replace("#", "");
  const bigint = parseInt(clean.length === 3
    ? clean.split("").map(c => c + c).join("")
    : clean, 16);
  const r = (bigint >> 16) & 255;
  const g = (bigint >> 8) & 255;
  const b = bigint & 255;
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

// ── Light / dark (unchanged API, existing pages keep working) ──
function applyTheme(theme) {
  if (theme === "dark") {
    document.documentElement.setAttribute("data-theme", "dark");
  } else {
    document.documentElement.removeAttribute("data-theme");
  }
  localStorage.setItem("tma-theme", theme);
}

function toggleTheme() {
  const isDark = document.documentElement.getAttribute("data-theme") === "dark";
  applyTheme(isDark ? "light" : "dark");
  return !isDark; // returns new isDark state
}

function getTheme() {
  return document.documentElement.getAttribute("data-theme") === "dark" ? "dark" : "light";
}

// ── Preset palettes ──
const THEME_PRESETS = ["indigo", "ocean", "forest", "sunset", "grape", "rose"];

function applyPreset(preset) {
  if (!THEME_PRESETS.includes(preset)) preset = "indigo";
  if (preset === "indigo") {
    document.documentElement.removeAttribute("data-preset");
  } else {
    document.documentElement.setAttribute("data-preset", preset);
  }
  localStorage.setItem("tma-preset", preset);
  // Switching preset clears any custom accent override so the preset shows.
  clearCustomAccent();
}

function getPreset() {
  return document.documentElement.getAttribute("data-preset") || "indigo";
}

// ── Custom accent color (overrides whatever preset is active) ──
function setCustomAccent(hex) {
  document.documentElement.style.setProperty("--tma-accent", hex);
  document.documentElement.style.setProperty("--tma-accent-soft", hexToSoftRgba(hex));
  localStorage.setItem("tma-accent-custom", hex);
}

function clearCustomAccent() {
  document.documentElement.style.removeProperty("--tma-accent");
  document.documentElement.style.removeProperty("--tma-accent-soft");
  localStorage.removeItem("tma-accent-custom");
}

function getCustomAccent() {
  return localStorage.getItem("tma-accent-custom") || null;
}

// ── Cross-device sync hook ──
// Call this once after Firebase auth resolves (e.g. from load-profile.js)
// with { theme, preset, accentColor } read from the user's Firestore doc,
// so preferences saved on one device apply on another before any click.
function syncThemeFromProfile(prefs) {
  if (!prefs) return;
  if (prefs.theme) applyTheme(prefs.theme);
  if (prefs.preset) applyPreset(prefs.preset);
  if (prefs.accentColor) setCustomAccent(prefs.accentColor);
}

window.applyTheme = applyTheme;
window.toggleTheme = toggleTheme;
window.getTheme = getTheme;
window.applyPreset = applyPreset;
window.getPreset = getPreset;
window.setCustomAccent = setCustomAccent;
window.clearCustomAccent = clearCustomAccent;
window.getCustomAccent = getCustomAccent;
window.syncThemeFromProfile = syncThemeFromProfile;
window.THEME_PRESETS = THEME_PRESETS;