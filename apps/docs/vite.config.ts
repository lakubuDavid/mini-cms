import react from '@vitejs/plugin-react';
import { TanStackRouterVite } from '@tanstack/router-plugin/vite';
import { tanstackStart } from '@tanstack/react-start/plugin/vite';
import { defineConfig } from 'vite';
import tailwindcss from '@tailwindcss/vite';
import mdx from 'fumadocs-mdx/vite';
import { nitro } from 'nitro/vite';

export default defineConfig({
  plugins: [
    TanStackRouterVite(),
    mdx(await import('./source.config')),
    tailwindcss(),
    tanstackStart(),
    nitro({
      preset: 'vercel',
      vercel: {
        functions: {
          runtime: 'nodejs20.x'
        }
      }
    }),
    react(),
  ],
  resolve: {
    tsconfigPaths: true,
    alias: {
      tslib: 'tslib/tslib.es6.js',
    },
  },
});
