import { defineConfig } from 'vite';
import { resolve } from 'path';
import { copyFileSync, mkdirSync, existsSync, readdirSync, renameSync, rmSync, readFileSync, writeFileSync } from 'fs';

export default defineConfig({
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    minify: false,
    rollupOptions: {
      input: {
        background: resolve(__dirname, 'src/background/main.ts'),
        content: resolve(__dirname, 'src/content/main.ts'),
        options: resolve(__dirname, 'src/options/main.ts'),
        katexBridge: resolve(__dirname, 'src/content/katexBridge.ts')
      },
      output: {
        entryFileNames: '[name].js',
        chunkFileNames: 'chunks/[name]-[hash].js',
        assetFileNames: (assetInfo) => {
          const name = assetInfo.name || '';
          if (name.endsWith('.css')) {
            return '[name][extname]';
          }
          return 'assets/[name][extname]';
        },
        format: 'es'
      }
    }
  },
  resolve: {
    alias: {
      '@': resolve(__dirname, 'src')
    }
  },
  plugins: [
    {
      name: 'copy-manifest-and-assets',
      closeBundle() {
        // Ensure dist directory exists
        if (!existsSync('dist')) {
          mkdirSync('dist', { recursive: true });
        }

        // Copy manifest.json without modifications
        copyFileSync('manifest.json', 'dist/manifest.json');

        // Copy options.html
        copyFileSync('src/options/index.html', 'dist/options.html');

        // Copy KaTeX files
        const katexDir = 'node_modules/katex/dist';
        const distKatexDir = 'dist/katex';

        if (existsSync(katexDir)) {
          if (!existsSync(distKatexDir)) {
            mkdirSync(distKatexDir, { recursive: true });
          }

          // Copy KaTeX JS files
          copyFileSync(`${katexDir}/katex.min.js`, `${distKatexDir}/katex.min.js`);
          copyFileSync(`${katexDir}/contrib/auto-render.min.js`, `${distKatexDir}/auto-render.min.js`);
          copyFileSync(`${katexDir}/katex.min.css`, `${distKatexDir}/katex.min.css`);

          // Copy fonts directory
          const fontsDir = `${katexDir}/fonts`;
          const distFontsDir = `${distKatexDir}/fonts`;
          if (existsSync(fontsDir)) {
            if (!existsSync(distFontsDir)) {
              mkdirSync(distFontsDir, { recursive: true });
            }
            const fontFiles = readdirSync(fontsDir);
            fontFiles.forEach(file => {
              copyFileSync(`${fontsDir}/${file}`, `${distFontsDir}/${file}`);
            });
          }
        }

        // Copy assets
        const assetsDir = 'src/assets';
        const distAssetsDir = 'dist/assets';

        if (!existsSync(distAssetsDir)) {
          mkdirSync(distAssetsDir, { recursive: true });
        }

        if (existsSync(assetsDir)) {
          const files = readdirSync(assetsDir);
          files.forEach(file => {
            if (file.endsWith('.png') || file.endsWith('.jpg') || file.endsWith('.svg')) {
              copyFileSync(`${assetsDir}/${file}`, `${distAssetsDir}/${file}`);
            }
          });
        }
      }
    }
  ]
});
