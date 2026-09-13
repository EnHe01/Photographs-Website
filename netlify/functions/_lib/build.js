const { requireEnv } = require("./auth");

// Triggers a Netlify site rebuild. Uploaded images and saved posts only
// live in the GitHub repo until the next Hugo build/deploy, so anything
// that needs to become visible on the live site (or servable at all, for
// files under /uploads/) has to call this.
function triggerBuild() {
  const hookUrl = requireEnv("NETLIFY_BUILD_HOOK_URL");
  return fetch(hookUrl, { method: "POST" });
}

module.exports = { triggerBuild };
