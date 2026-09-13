Vendored from `@toast-ui/editor@3.2.2` (https://www.npmjs.com/package/@toast-ui/editor), MIT licensed.

`toastui-editor.js`'s published npm build externalizes its ProseMirror
dependencies via CommonJS `require(...)`, so it isn't directly usable from
a plain `<script>` tag. `toastui-editor.min.js` here is instead a from-source
bundle (esbuild `--bundle --minify` over an entry file that does
`window.toastui = { Editor: require('@toast-ui/editor') }`), which inlines
ProseMirror and everything else into one self-contained file that exposes
`window.toastui.Editor`.

`toastui-editor.min.css` / `toastui-editor-dark.min.css` are esbuild-minified
copies of the package's `dist/toastui-editor.css` and
`dist/theme/toastui-editor-dark.css`.

Self-hosted instead of loaded from a CDN so the admin doesn't need a
Content-Security-Policy exception for a third-party script host.
