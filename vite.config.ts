import path from "path"
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  base: '/',
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  build: {
    // Performance optimizations
    target: 'esnext',
    minify: 'esbuild', // Use esbuild instead of terser for better compatibility
    sourcemap: false,
    rollupOptions: {
      output: {
        // Manual chunk splitting for better caching
        manualChunks: {
          // Vendor libraries
          'react-vendor': ['react', 'react-dom', 'react-router-dom'],
          'ui-vendor': ['lucide-react', '@radix-ui/react-dialog', '@radix-ui/react-progress', '@radix-ui/react-switch'],
          'supabase-vendor': ['@supabase/supabase-js'],
          'utils-vendor': ['clsx', 'tailwind-merge', 'sonner'],
          
          // App chunks
          'auth': ['./src/hooks/useAuth.ts', './src/components/auth/AuthForm.tsx'],
          'services': ['./src/services/badgeService.ts', './src/services/sessionService.ts', './src/services/calendarService.ts'],
        },
        // Optimize chunk file names
        chunkFileNames: 'assets/[name]-[hash].js',
        entryFileNames: 'assets/[name]-[hash].js',
        assetFileNames: 'assets/[name]-[hash].[ext]'
      }
    },
    // Chunk size warnings
    chunkSizeWarningLimit: 1000
  },
  // Development optimizations
  server: {
    hmr: {
      overlay: false
    },
    fs: {
      // Allow serving files from one level up to the project root
      allow: ['..']
    }
  },
  // Optimize dependencies
  optimizeDeps: {
    include: ['react', 'react-dom', 'react-router-dom', '@supabase/supabase-js'],
    exclude: ['@vite/client']
  },
  // Enable gzip compression in preview
  preview: {
    headers: {
      'Cache-Control': 'public, max-age=31536000'
    }
  }
})