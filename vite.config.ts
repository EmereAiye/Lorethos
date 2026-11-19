import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import { defineConfig } from 'vite';

export default defineConfig(() => {
  const hmrDisabled =
    process.env.DISABLE_HMR === 'true' ||
    Boolean(process.env.K_SERVICE && process.env.APPLET_ID);

  return {
    plugins: [react(), tailwindcss()],
    resolve: {
      alias: {
        '@': path.resolve(import.meta.dirname, '.'),
      },
    },
    build: {
      chunkSizeWarningLimit: 650,
      rolldownOptions: {
        output: {
          codeSplitting: {
            groups: [
              {
                name: 'charts',
                test: /node_modules[\\/](recharts|d3-|victory-vendor)/,
              },
              {
                name: 'vendor',
                test: /node_modules[\\/](react|react-dom|lucide-react)/,
              },
            ],
          },
        },
      },
    },
    server: {
      // HMR is disabled in AI Studio via DISABLE_HMR or container env vars.
      // Do not modify—file watching is disabled to prevent flickering during agent edits.
      hmr: !hmrDisabled,
      // Disable file watching when HMR is disabled to save CPU during agent edits.
      watch: hmrDisabled ? null : {},
    },
  };
});
