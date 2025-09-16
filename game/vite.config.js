import { defineConfig } from 'vite';
import path from 'path';
import { copyFileSync, existsSync, mkdirSync } from 'fs';


export default defineConfig({
   build: {
      outDir: '../ui/static/game',
      emptyOutDir: true,
      rollupOptions: {
         input: 'src/main.js',
         output: {
            entryFileNames: 'game.bundle.js',
            format: 'es',
            assetFileNames: 'assets/[name]-[hash][extname]',
            chunkFileNames: 'chunks/[name]-[hash].js',
         },
      },
      assetsInlineLimit: 0,
   },
   resolve: {
      alias: {
         '@': path.resolve(__dirname, 'src'),
      },
   },
   optimizeDeps: {
      exclude: ['three'],
   },
   publicDir: 'public',
});
