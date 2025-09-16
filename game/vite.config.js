import { defineConfig } from 'vite';
import path from 'path';
import { copyFileSync, existsSync, mkdirSync } from 'fs';

function wasmPlugin() {
   return {
      name: 'vite-plugin-wasm',
      config() {
         return {
            build: {
               rollupOptions: {
                  external: [/.*\.wasm$/],
               },
            },
            assetsInclude: ['**/*.wasm'],
         };
      },
   };
}

function copyWasmFiles() {
   return {
      name: 'copy-wasm-files',
      writeBundle() {
         const targetDir = path.resolve(__dirname, '../ui/static/game/assets');
         console.log('Target directory:', targetDir);
         if (!existsSync(targetDir)) {
            console.log('Creating target directory:', targetDir);
            mkdirSync(targetDir, { recursive: true });
         }
         const wasmFiles = [
            'jolt-physics.wasm.wasm',
            'jolt-physics.multithread.wasm.wasm'
         ];
         wasmFiles.forEach(file => {
            const source = path.resolve(__dirname, `node_modules/jolt-physics/dist/${file}`);
            const dest = path.resolve(targetDir, file);
            console.log(`Checking source: ${source}`);
            if (existsSync(source)) {
               console.log(`Copying ${source} to ${dest}`);
               copyFileSync(source, dest);
            } else {
               console.warn(`Warning: Could not find ${source}`);
            }
         });
         console.log('WASM files copied to static directory');
      }
   };
}

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
      exclude: ['jolt-physics'],
   },
   plugins: [wasmPlugin(), copyWasmFiles()],
   publicDir: 'public',
});
