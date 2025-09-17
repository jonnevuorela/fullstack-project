// AI generoitu vite config
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

function copyJoltFiles() {
   return {
      name: 'copy-jolt-files',
      writeBundle() {
         const targetDir = path.resolve(__dirname, '../ui/static/game/assets');
         if (!existsSync(targetDir)) {
            mkdirSync(targetDir, { recursive: true });
         }

         const filesToCopy = [
            'jolt-physics.wasm.wasm',
            'jolt-physics.wasm.js',
         ];

         filesToCopy.forEach(file => {
            const source = path.resolve(__dirname, `node_modules/jolt-physics/dist/${file}`);
            const dest = path.resolve(targetDir, file);
            if (existsSync(source)) {
               console.log(`Copying ${file} to assets directory`);
               copyFileSync(source, dest);
            } else {
               console.warn(`Warning: Could not find ${file}`);
            }
         });
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
            assetFileNames: 'assets/[name][extname]',
            chunkFileNames: 'chunks/[name]-[hash].js',
         },
      },
      assetsInlineLimit: 0,
   },
   resolve: {
      alias: {
         '@': path.resolve(__dirname, 'src'),
         'jolt-physics': path.resolve(__dirname, 'node_modules/jolt-physics')
      },
   },
   optimizeDeps: {
      exclude: ['jolt-physics'],
   },
   plugins: [wasmPlugin(), copyJoltFiles()],
   publicDir: 'public',
});
