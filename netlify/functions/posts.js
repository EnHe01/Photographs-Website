const { json, handle, HttpError } = require("./_lib/response");
const { requireAuth } = require("./_lib/auth");
const github = require("./_lib/github");
const frontmatter = require("./_lib/frontmatter");

const LANGS = ["zh", "en", "ja"];

function dirFor(lang) {
  if (!LANGS.includes(lang)) throw new HttpError(400, `Invalid lang: ${lang}`);
  return `content/${lang}/blog`;
}

function pathFor(lang, slug) {
  validateSlug(slug);
  return `${dirFor(lang)}/${slug}.md`;
}

// Slugs become filenames inside the repo, so keep them to a safe, flat set
// of characters (existing posts already use Chinese titles verbatim, so we
// only forbid path traversal / separators rather than forcing ASCII).
function validateSlug(slug) {
  if (!slug || typeof slug !== "string" || slug.includes("/") || slug.includes("..") || slug.includes("\\")) {
    throw new HttpError(400, "Invalid slug");
  }
}

async function listPosts() {
  const groups = new Map();

  await Promise.all(
    LANGS.map(async (lang) => {
      const entries = await github.listDir(dirFor(lang));
      const mdFiles = entries.filter((e) => e.type === "file" && e.name.endsWith(".md"));

      await Promise.all(
        mdFiles.map(async (entry) => {
          const slug = entry.name.slice(0, -3);
          const file = await github.getFile(entry.path);
          const { frontmatter: fm } = frontmatter.parse(file.text);

          if (!groups.has(slug)) groups.set(slug, { slug, langs: {} });
          groups.get(slug).langs[lang] = {
            title: fm.title || "",
            date: fm.date || "",
            excerpt: fm.excerpt || "",
            cover: fm.cover || "",
            draft: !!fm.draft,
          };
        })
      );
    })
  );

  const posts = Array.from(groups.values());
  posts.sort((a, b) => {
    const dateOf = (p) => Object.values(p.langs).map((l) => l.date).sort().pop() || "";
    return dateOf(b).localeCompare(dateOf(a));
  });
  return posts;
}

async function getPost(lang, slug) {
  const file = await github.getFile(pathFor(lang, slug));
  if (!file) throw new HttpError(404, "Post not found");
  const { frontmatter: fm, body } = frontmatter.parse(file.text);
  return { lang, slug, frontmatter: fm, body, sha: file.sha };
}

async function savePost({ lang, slug, frontmatter: fm, body, sha }) {
  if (!fm || !fm.title) throw new HttpError(400, "Title is required");
  const path = pathFor(lang, slug);
  const existing = await github.getFile(path);
  if (sha && existing && existing.sha !== sha) {
    throw new HttpError(409, "Post was modified elsewhere, please reload before saving");
  }
  const text = frontmatter.stringify(fm, body || "");
  const message = `${existing ? "Update" : "Add"} ${lang} post "${fm.title}"`;
  const result = await github.putFile(path, text, message, existing ? existing.sha : undefined);
  return { lang, slug, sha: result.sha };
}

async function deletePost(lang, slug) {
  const path = pathFor(lang, slug);
  const existing = await github.getFile(path);
  if (!existing) throw new HttpError(404, "Post not found");
  await github.deleteFile(path, `Delete ${lang} post "${slug}"`, existing.sha);
}

exports.handler = async (event) =>
  handle(async () => {
    requireAuth(event);
    const q = event.queryStringParameters || {};

    if (event.httpMethod === "GET") {
      if (q.lang && q.slug) return json(200, await getPost(q.lang, q.slug));
      return json(200, { posts: await listPosts() });
    }

    if (event.httpMethod === "POST" || event.httpMethod === "PUT") {
      let body;
      try {
        body = JSON.parse(event.body || "{}");
      } catch {
        throw new HttpError(400, "Invalid JSON body");
      }
      if (!body.lang || !body.slug) throw new HttpError(400, "lang and slug are required");
      return json(200, await savePost(body));
    }

    if (event.httpMethod === "DELETE") {
      if (!q.lang || !q.slug) throw new HttpError(400, "lang and slug are required");
      await deletePost(q.lang, q.slug);
      return json(200, { ok: true });
    }

    throw new HttpError(405, "Method not allowed");
  });
