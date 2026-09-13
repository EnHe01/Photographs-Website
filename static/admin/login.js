(function () {
  "use strict";

  const API_BASE = "/.netlify/functions";
  const el = (id) => document.getElementById(id);
  const loginForm = el("loginForm");
  const loginUsername = el("loginUsername");
  const loginPassword = el("loginPassword");
  const loginError = el("loginError");

  async function api(path, opts) {
    const res = await fetch(API_BASE + path, Object.assign(
      { credentials: "same-origin", headers: { "Content-Type": "application/json" } },
      opts || {}
    ));
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      const err = new Error(data.error || `請求失敗 (${res.status})`);
      err.status = res.status;
      throw err;
    }
    return data;
  }

  loginForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    loginError.hidden = true;
    try {
      await api("/login", {
        method: "POST",
        body: JSON.stringify({ username: loginUsername.value, password: loginPassword.value }),
      });
      window.location.href = "/admin/edit.html";
    } catch (err) {
      loginError.textContent = err.message || "登入失敗";
      loginError.hidden = false;
    }
  });

  // Already have a valid session (e.g. came back to /admin/ while still
  // logged in)? Skip the login form and go straight to the editor.
  api("/me").then(() => {
    window.location.href = "/admin/edit.html";
  }).catch(() => {});
})();
