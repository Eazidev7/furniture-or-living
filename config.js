/* Furniture or Living — API endpoint (Supabase edge function).
   No keys here: public actions are open, admin actions are
   verified server-side via the admin passkey. */
const FOL_API = "https://wbajjtcrclzpfertzyes.supabase.co/functions/v1/admin-api";

/* ---------- theme: apply saved / system choice before paint ---------- */
document.documentElement.dataset.theme =
  localStorage.getItem("fol_theme") ||
  (matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light");

function toggleTheme() {
  const next = document.documentElement.dataset.theme === "dark" ? "light" : "dark";
  document.documentElement.dataset.theme = next;
  localStorage.setItem("fol_theme", next);
  document.querySelectorAll("[data-theme-btn]").forEach((b) => {
    b.textContent = (next === "dark" ? "☀" : "☾") + (b.dataset.label || "");
  });
}
function wireThemeButtons() {
  document.querySelectorAll("[data-theme-btn]").forEach((b) => {
    b.textContent =
      (document.documentElement.dataset.theme === "dark" ? "☀" : "☾") +
      (b.dataset.label || "");
    b.addEventListener("click", toggleTheme);
  });
}
wireThemeButtons();

