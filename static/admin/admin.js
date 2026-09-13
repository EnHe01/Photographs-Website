(function () {
  "use strict";

  const API_BASE = "/.netlify/functions";
  const LANGS = ["zh", "en", "ja"];

  const el = (id) => document.getElementById(id);
  const authLoading = el("authLoading");
  const appScreen = el("appScreen");
  const logoutBtn = el("logoutBtn");
  const statusMsg = el("statusMsg");
  const newPostBtn = el("newPostBtn");
  const searchBox = el("searchBox");
  const postList = el("postList");
  const editorEmpty = el("editorEmpty");
  const editorForm = el("editorForm");
  const langTabs = el("langTabs");
  const langMissingNote = el("langMissingNote");
  const translateFromZhBtn = el("translateFromZhBtn");
  const fieldTitle = el("fieldTitle");
  const fieldDate = el("fieldDate");
  const fieldLocation = el("fieldLocation");
  const fieldCover = el("fieldCover");
  const coverUploadBtn = el("coverUploadBtn");
  const coverUploadInput = el("coverUploadInput");
  const coverPreview = el("coverPreview");
  const fieldExcerpt = el("fieldExcerpt");
  const fieldDraft = el("fieldDraft");
  const bodyImageBtn = el("bodyImageBtn");
  const bodyImageInput = el("bodyImageInput");
  const fieldBody = el("fieldBody");
  const saveDraftBtn = el("saveDraftBtn");
  const publishBtn = el("publishBtn");
  const deleteLangBtn = el("deleteLangBtn");

  const state = {
    posts: [],
    activeSlug: null,
    activeLang: "zh",
    langData: null, // { zh: {frontmatter, body, sha, exists}, en: {...}, ja: {...} }
  };

  function setStatus(msg) {
    statusMsg.textContent = msg || "";
  }

  function escapeHtml(str) {
    return String(str).replace(/[&<>"']/g, (c) => ({
      "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
    }[c]));
  }

  async function api(path, opts) {
    const res = await fetch(API_BASE + path, Object.assign(
      { credentials: "same-origin", headers: { "Content-Type": "application/json" } },
      opts || {}
    ));
    if (res.status === 401) {
      goToLogin();
      const err = new Error("請重新登入");
      err.status = 401;
      throw err;
    }
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      const err = new Error(data.error || `請求失敗 (${res.status})`);
      err.status = res.status;
      throw err;
    }
    return data;
  }

  function goToLogin() {
    window.location.href = "/admin/index.html";
  }

  function showApp() {
    authLoading.hidden = true;
    appScreen.hidden = false;
    state.langData = null;
    renderForm();
    refreshPostList().catch((err) => setStatus("載入文章列表失敗：" + err.message));
  }

  // ---- date helpers ----
  function toDatetimeLocal(iso) {
    const d = iso ? new Date(iso) : null;
    if (!d || isNaN(d.getTime())) return "";
    const pad = (n) => String(n).padStart(2, "0");
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
  }
  function fromDatetimeLocal(value) {
    const d = value ? new Date(value) : new Date();
    return isNaN(d.getTime()) ? new Date().toISOString() : d.toISOString();
  }
  function slugify(title, dateIso) {
    const d = dateIso ? new Date(dateIso) : new Date();
    const pad = (n) => String(n).padStart(2, "0");
    const datePart = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
    const titlePart = (title || "untitled").trim().replace(/[\/\\?#]+/g, "").replace(/\s+/g, "-");
    return `${datePart}-${titlePart}`;
  }

  function emptyLangData(lang) {
    return {
      frontmatter: { title: "", date: new Date().toISOString(), location: "", cover: "", excerpt: "", draft: false, source_lang: lang },
      body: "",
      sha: null,
      exists: false,
    };
  }

  // ---- post list ----
  async function refreshPostList() {
    const res = await api("/posts");
    state.posts = res.posts;
    renderPostList();
  }

  function renderPostList() {
    const q = searchBox.value.trim().toLowerCase();
    postList.innerHTML = "";
    state.posts
      .filter((p) => !q || LANGS.some((l) => (p.langs[l] && p.langs[l].title || "").toLowerCase().includes(q)))
      .forEach((p) => {
        const title = (p.langs.zh && p.langs.zh.title) || (p.langs.en && p.langs.en.title) || (p.langs.ja && p.langs.ja.title) || p.slug;
        const anyDraft = LANGS.some((l) => p.langs[l] && p.langs[l].draft);
        const item = document.createElement("div");
        item.className = "post-item" + (p.slug === state.activeSlug ? " active" : "");
        item.innerHTML = `
          <div class="post-item-title">${escapeHtml(title)}</div>
          <div class="post-item-meta">
            <span class="lang-dot">
              <span class="${p.langs.zh ? "exists" : ""}">中</span>
              <span class="${p.langs.en ? "exists" : ""}">EN</span>
              <span class="${p.langs.ja ? "exists" : ""}">日</span>
            </span>
            ${anyDraft ? '<span class="draft-badge">草稿</span>' : ""}
          </div>`;
        item.addEventListener("click", () => selectPost(p.slug));
        postList.appendChild(item);
      });
  }

  // ---- editor ----
  async function selectPost(slug) {
    setStatus("載入中...");
    try {
      const langData = {};
      await Promise.all(
        LANGS.map(async (lang) => {
          try {
            const res = await api(`/posts?lang=${lang}&slug=${encodeURIComponent(slug)}`);
            langData[lang] = { frontmatter: res.frontmatter, body: res.body, sha: res.sha, exists: true };
          } catch (err) {
            if (err.status === 404) langData[lang] = emptyLangData(lang);
            else throw err;
          }
        })
      );
      state.activeSlug = slug;
      state.langData = langData;
      state.activeLang = langData.zh.exists ? "zh" : langData.en.exists ? "en" : langData.ja.exists ? "ja" : "zh";
      setStatus("");
      renderPostList();
      renderForm();
    } catch (err) {
      setStatus("");
      alert("載入文章失敗：" + err.message);
    }
  }

  function startNewPost() {
    state.activeSlug = null;
    state.langData = { zh: emptyLangData("zh"), en: emptyLangData("en"), ja: emptyLangData("ja") };
    state.activeLang = "zh";
    setStatus("新增文章 — 尚未儲存");
    renderPostList();
    renderForm();
  }

  function renderForm() {
    if (!state.langData) {
      editorForm.hidden = true;
      editorEmpty.hidden = false;
      return;
    }
    editorEmpty.hidden = true;
    editorForm.hidden = false;

    langTabs.querySelectorAll(".lang-tab").forEach((btn) => {
      const lang = btn.dataset.lang;
      btn.classList.toggle("active", lang === state.activeLang);
      btn.classList.toggle("has-content", !!(state.langData[lang] && state.langData[lang].exists));
    });

    const data = state.langData[state.activeLang];
    langMissingNote.hidden = data.exists;
    translateFromZhBtn.hidden = state.activeLang === "zh";

    fieldTitle.value = data.frontmatter.title || "";
    fieldDate.value = toDatetimeLocal(data.frontmatter.date);
    fieldLocation.value = data.frontmatter.location || "";
    fieldCover.value = data.frontmatter.cover || "";
    fieldExcerpt.value = data.frontmatter.excerpt || "";
    fieldDraft.checked = !!data.frontmatter.draft;
    fieldBody.value = data.body || "";

    if (data.frontmatter.cover) {
      coverPreview.src = data.frontmatter.cover;
      coverPreview.hidden = false;
    } else {
      coverPreview.hidden = true;
    }

    deleteLangBtn.disabled = !data.exists;
  }

  function setField(key, value) {
    state.langData[state.activeLang].frontmatter[key] = value;
  }

  langTabs.querySelectorAll(".lang-tab").forEach((btn) => {
    btn.addEventListener("click", () => {
      if (!state.langData) return;
      state.activeLang = btn.dataset.lang;
      renderForm();
    });
  });

  fieldTitle.addEventListener("input", () => setField("title", fieldTitle.value));
  fieldLocation.addEventListener("input", () => setField("location", fieldLocation.value));
  fieldExcerpt.addEventListener("input", () => setField("excerpt", fieldExcerpt.value));
  fieldDraft.addEventListener("change", () => setField("draft", fieldDraft.checked));
  fieldDate.addEventListener("change", () => setField("date", fromDatetimeLocal(fieldDate.value)));
  fieldBody.addEventListener("input", () => { state.langData[state.activeLang].body = fieldBody.value; });
  fieldCover.addEventListener("input", () => {
    setField("cover", fieldCover.value);
    if (fieldCover.value) { coverPreview.src = fieldCover.value; coverPreview.hidden = false; }
    else coverPreview.hidden = true;
  });

  // ---- image upload ----
  function fileToBase64(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result).split(",")[1]);
      reader.onerror = () => reject(new Error("讀取檔案失敗"));
      reader.readAsDataURL(file);
    });
  }

  async function uploadImage(file) {
    if (file.size > 15 * 1024 * 1024) throw new Error("圖片過大（上限 15MB）");
    const dataBase64 = await fileToBase64(file);
    setStatus("上傳圖片中...");
    const res = await api("/upload", {
      method: "POST",
      body: JSON.stringify({ filename: file.name, dataBase64, watermark: true }),
    });
    setStatus("");
    return res.url;
  }

  function insertAtCursor(textarea, text) {
    const start = textarea.selectionStart || 0;
    const end = textarea.selectionEnd || 0;
    textarea.value = textarea.value.slice(0, start) + text + textarea.value.slice(end);
    const pos = start + text.length;
    textarea.selectionStart = textarea.selectionEnd = pos;
    textarea.focus();
  }

  coverUploadBtn.addEventListener("click", () => coverUploadInput.click());
  coverUploadInput.addEventListener("change", async (e) => {
    const file = e.target.files[0];
    coverUploadInput.value = "";
    if (!file) return;
    try {
      const url = await uploadImage(file);
      fieldCover.value = url;
      setField("cover", url);
      coverPreview.src = url;
      coverPreview.hidden = false;
    } catch (err) {
      setStatus("");
      alert("上傳失敗：" + err.message);
    }
  });

  bodyImageBtn.addEventListener("click", () => bodyImageInput.click());
  bodyImageInput.addEventListener("change", async (e) => {
    const file = e.target.files[0];
    bodyImageInput.value = "";
    if (!file) return;
    try {
      const url = await uploadImage(file);
      insertAtCursor(fieldBody, `\n\n![](${url})\n\n`);
      state.langData[state.activeLang].body = fieldBody.value;
    } catch (err) {
      setStatus("");
      alert("上傳失敗：" + err.message);
    }
  });

  // ---- translate ----
  // Calls /translate and returns the translated { title, excerpt, body }.
  async function translateFields(sourceLang, targetLang, source) {
    const res = await api("/translate", {
      method: "POST",
      body: JSON.stringify({
        sourceLang,
        targetLang,
        fields: { title: source.frontmatter.title, excerpt: source.frontmatter.excerpt || "", body: source.body || "" },
      }),
    });
    return res.fields;
  }

  translateFromZhBtn.addEventListener("click", async () => {
    const zh = state.langData.zh;
    if (!zh || !zh.frontmatter.title) { alert("請先建立中文版本內容"); return; }
    const targetLang = state.activeLang;
    if (targetLang === "zh") return;
    setStatus("翻譯中...");
    try {
      const fields = await translateFields("zh", targetLang, zh);
      const data = state.langData[targetLang];
      data.frontmatter.title = fields.title;
      data.frontmatter.excerpt = fields.excerpt;
      data.body = fields.body;
      if (!data.frontmatter.location) data.frontmatter.location = zh.frontmatter.location;
      if (!data.frontmatter.cover) data.frontmatter.cover = zh.frontmatter.cover;
      if (!toDatetimeLocal(data.frontmatter.date)) data.frontmatter.date = zh.frontmatter.date;
      renderForm();
      setStatus("翻譯建議已填入，請確認後儲存");
    } catch (err) {
      setStatus("");
      alert("翻譯失敗：" + err.message);
    }
  });

  // Publishing a post always publishes all three languages together. Any
  // language that has no file yet is auto-translated (via DeepL) using the
  // just-published language as the source; if that translation call fails
  // for any reason, we fall back to copying the source text over untouched
  // so the language still goes live (rather than silently staying missing)
  // — you can go translate it by hand afterwards. A language that already
  // exists (auto-translated before, or hand-written) is never touched again
  // automatically, so this costs at most one DeepL call per missing
  // language per post.
  async function autoTranslateMissing(sourceLang) {
    const source = state.langData[sourceLang];
    const targets = LANGS.filter((l) => l !== sourceLang && !state.langData[l].exists);
    for (const targetLang of targets) {
      setStatus(`自動翻譯 ${targetLang} 中...`);
      let fields;
      let translated = true;
      try {
        fields = await translateFields(sourceLang, targetLang, source);
      } catch (err) {
        translated = false;
        fields = { title: source.frontmatter.title, excerpt: source.frontmatter.excerpt || "", body: source.body || "" };
      }

      try {
        const data = state.langData[targetLang];
        data.frontmatter = Object.assign({}, source.frontmatter, {
          title: fields.title,
          excerpt: fields.excerpt,
          draft: false,
          source_lang: sourceLang,
        });
        data.body = fields.body;
        const res = await api("/posts", {
          method: "POST",
          body: JSON.stringify({ lang: targetLang, slug: state.activeSlug, frontmatter: data.frontmatter, body: data.body }),
        });
        data.sha = res.sha;
        data.exists = true;
        if (!translated) {
          setStatus(`${targetLang} 翻譯失敗，已用中文原文發布，請之後手動翻譯`);
        }
      } catch (err) {
        alert(`發布 ${targetLang} 失敗：${err.message}`);
      }
    }
  }

  // ---- save / delete ----
  async function saveCurrent(publish) {
    const lang = state.activeLang;
    const data = state.langData[lang];
    if (!data.frontmatter.title || !data.frontmatter.title.trim()) { alert("請輸入標題"); return; }

    const slug = state.activeSlug || slugify(data.frontmatter.title, data.frontmatter.date);
    const fm = Object.assign({}, data.frontmatter);
    fm.source_lang = fm.source_lang || lang;
    if (publish) fm.draft = false;

    setStatus("儲存中...");
    try {
      const res = await api("/posts", {
        method: data.exists ? "PUT" : "POST",
        body: JSON.stringify({ lang, slug, frontmatter: fm, body: data.body, sha: data.sha }),
      });
      data.sha = res.sha;
      data.exists = true;
      data.frontmatter = fm;
      state.activeSlug = slug;

      if (publish) {
        await autoTranslateMissing(lang);
        setStatus("發布中...");
        await api("/publish", { method: "POST" });
      }
      setStatus(publish ? "已儲存並觸發發布" : "已儲存草稿");
      await refreshPostList();
      renderForm();
    } catch (err) {
      setStatus("");
      alert("儲存失敗：" + err.message);
    }
  }

  async function deleteCurrentLang() {
    const lang = state.activeLang;
    const data = state.langData[lang];
    if (!data.exists) return;
    if (!confirm(`確定刪除「${lang}」語言版本嗎？此動作無法復原。`)) return;
    setStatus("刪除中...");
    try {
      await api(`/posts?lang=${lang}&slug=${encodeURIComponent(state.activeSlug)}`, { method: "DELETE" });
      state.langData[lang] = emptyLangData(lang);
      setStatus("已刪除");
      await refreshPostList();
      renderForm();
    } catch (err) {
      setStatus("");
      alert("刪除失敗：" + err.message);
    }
  }

  saveDraftBtn.addEventListener("click", () => saveCurrent(false));
  publishBtn.addEventListener("click", () => saveCurrent(true));
  deleteLangBtn.addEventListener("click", deleteCurrentLang);
  newPostBtn.addEventListener("click", startNewPost);
  searchBox.addEventListener("input", renderPostList);

  logoutBtn.addEventListener("click", async () => {
    await api("/logout", { method: "POST" }).catch(() => {});
    goToLogin();
  });

  // ---- init ----
  api("/me").then(showApp).catch(goToLogin);
})();
