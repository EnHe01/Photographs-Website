# Photographs-Website

## 後台管理系統

自訂的部落格後台，取代原本的 Decap CMS。網址：`/admin/`（例如
`https://enhephotographs.netlify.app/admin/`）。

架構：單頁前端（`static/admin/`）+ Netlify Functions（`netlify/functions/`）
後端，內容仍然是 GitHub repo 裡的 Markdown 檔案，後端透過 GitHub Contents API
讀寫。沒有資料庫。

### 功能

- 帳號密碼登入（JWT + httpOnly cookie，密碼以 bcrypt hash 儲存）
- 文章列表 / 建立 / 編輯 / 刪除，三語（中/英/日）分頁管理
- 圖片上傳，Netlify Function 內用 `sharp` 自動加浮水印（取代原本 build 時
  跑的 `scripts/watermark.py`）
- 「從中文翻譯建議」按鈕，呼叫 DeepL API 產生英文/日文草稿，人工確認後再儲存
- 草稿（`draft: true`）與發布（儲存 + 觸發 Netlify Build Hook）

### 需要設定的 Netlify 環境變數

在 Netlify 專案的 Site settings → Environment variables 新增：

| 變數 | 說明 |
| --- | --- |
| `ADMIN_USERNAME` | 登入帳號 |
| `ADMIN_PASSWORD_HASH` | 登入密碼的 bcrypt hash（見下方指令產生，**不要**存明文密碼）|
| `JWT_SECRET` | 隨機長字串，用來簽發登入 session，例如 `openssl rand -hex 32` |
| `GITHUB_TOKEN` | GitHub Personal Access Token，需要對本 repo 有 Contents 讀寫權限（建議用 fine-grained token，只勾 `Contents: Read and write`）|
| `GITHUB_REPO` | `EnHe01/Photographs-Website` |
| `GITHUB_BRANCH` | `main`（可省略，預設 main）|
| `DEEPL_API_KEY` | 沿用現有的 DeepL API key（免費版 API，會打 `api-free.deepl.com`）|
| `NETLIFY_BUILD_HOOK_URL` | Netlify Site settings → Build & deploy → Build hooks 新增一個 hook，把 URL 貼進來 |

產生密碼 hash：

```
node scripts/hash-password.js "你的密碼"
```

把輸出的整串（`$2a$10$...`）貼到 `ADMIN_PASSWORD_HASH`。

### 本機測試

```
npm install
netlify dev
```

`netlify dev` 會啟動 Functions（`/.netlify/functions/*`）並代理靜態站台，
可以在 `http://localhost:8888/admin/` 測試整套後台。本機測試一樣需要上面
那些環境變數（可以放在專案根目錄的 `.env` 檔，`netlify dev` 會自動讀取，
記得 `.env` 不要提交進 git）。

### 檔案結構

```
netlify/functions/
  _lib/auth.js         JWT session / bcrypt 驗證
  _lib/github.js        GitHub Contents API 讀寫封裝
  _lib/frontmatter.js   Markdown frontmatter 解析/序列化
  _lib/response.js       共用的 JSON response / 錯誤處理
  login.js / logout.js / me.js   登入狀態
  posts.js               文章 CRUD（GET 列表、GET 單篇、POST/PUT 儲存、DELETE 刪除）
  upload.js              圖片上傳 + 浮水印，回傳 /uploads/xxx.jpg
  translate.js           DeepL 翻譯建議
  publish.js             觸發 Netlify Build Hook
static/admin/
  index.html / admin.css / admin.js   後台前端（純 HTML/JS，無 build 流程）
```

### 已知取捨 / 之後可以做的事

- `scripts/watermark.py`（build 時跑）不再被 `netlify.toml` 呼叫，因為新上傳
  的圖片在後台上傳當下就已經加好浮水印；舊圖片維持原樣，不會被重複加浮水印。
  這支 script 還留著，之後如果想要批次處理舊圖片可以手動跑。
- `.github/workflows/translate.yml` 原本會在 `content/zh/blog` 有變動時自動
  整篇重新翻譯覆蓋 `content/en`、`content/ja`，這跟後台「人工確認翻譯」的
  流程會互相打架（可能覆蓋掉你在後台手動修過的翻譯），所以已經改成只能手動
  觸發（workflow_dispatch）。如果不需要保留可以直接刪除這個 workflow。
- Markdown 內文是純文字框（無即時預覽），要看效果需要儲存後到前台頁面看。
- 目前圖片上傳沒有做額外壓縮（只有原本 `watermark.py` 就有的「長邊超過
  2400px 才縮小」邏輯），如果要更嚴格的檔案大小控管可以之後再加。
