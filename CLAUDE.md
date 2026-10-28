# 工作规则

这是 He En 的摄影博客（Hugo + Netlify），线上网址 https://enhephotographs.netlify.app 。
推送到 `main` 会触发 Netlify 部署，每次部署都消耗 Netlify 额度，所以：

## 改完先本地预览，确认后再部署

1. 改完代码后，先在本地构建确认没有报错：

   ```
   hugo
   ```

2. 启动本地预览，告诉用户打开 http://localhost:1313/zh/ 查看效果：

   ```
   hugo server
   ```

   `hugo server` 会自动刷新，改完文件浏览器里马上能看到。

3. **用户确认没问题之前，只做本地 commit，不要 `git push`。**
   用户说可以部署了，再推送到 `main`，并尽量把多次修改合在一次推送里，一次推送 = 一次部署。

4. 只改文档、注释这类不影响网站的内容时，在 commit message 末尾加 `[skip netlify]`，推送时就不会部署。

## 注意

- 本地预览只能看网站页面。`/admin/` 后台依赖 Netlify Functions，在 `hugo server` 下不能用。
- 后台（`netlify/functions/_lib/github.js`）的提交会自动带 `[skip netlify]`，只有后台的「發布」按钮会通过 build hook 部署一次。不要去掉这个机制。
- 线上用的 Hugo 版本写在 `netlify.toml`（`HUGO_VERSION`）。
