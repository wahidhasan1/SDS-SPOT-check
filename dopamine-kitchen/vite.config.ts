import { defineConfig, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

/**
 * `vite build --mode single` emits one self-contained index.html (JS + CSS inlined, no chunk files).
 * Use it for hosts that may serve the entry script under a different URL than the chunks resolve
 * (e.g. a signed or versioned URL): split chunks would then load a second copy of the app and crash.
 */
function inlineIntoHtml(): Plugin {
  return {
    name: 'inline-into-html',
    apply: 'build',
    enforce: 'post',
    generateBundle(_, bundle) {
      const html = Object.values(bundle).find((f) => f.type === 'asset' && f.fileName === 'index.html')
      if (!html || html.type !== 'asset') return
      let src = String(html.source)
      for (const [name, file] of Object.entries(bundle)) {
        if (file.type === 'chunk' && file.isEntry) {
          // With inlined dynamic imports there is nothing to preload, but Vite can leave its deps placeholder behind.
          const code = file.code.replaceAll('__VITE_PRELOAD__', 'void 0').replace(/<\/script/gi, '<\\/script')
          src = src.replace(new RegExp(`<script type="module" crossorigin src="\\./${name}"></script>`), () => `<script type="module">${code}</script>`)
          delete bundle[name]
        } else if (file.type === 'asset' && name.endsWith('.css')) {
          src = src.replace(new RegExp(`<link rel="stylesheet" crossorigin href="\\./${name}">`), () => `<style>${String(file.source)}</style>`)
          delete bundle[name]
        }
      }
      if (/src="\.\/assets\/|href="\.\/assets\//.test(src)) this.error('single build: unresolved asset reference left in index.html')
      html.source = src
    },
  }
}

// base './' + HashRouter lets the built app run from any static host or sub-path.
export default defineConfig(({ mode }) => ({
  base: './',
  plugins: [react(), tailwindcss(), mode === 'single' && inlineIntoHtml()],
  build: mode === 'single'
    ? { outDir: 'dist-single', cssCodeSplit: false, rollupOptions: { output: { inlineDynamicImports: true } } }
    : undefined,
}))
