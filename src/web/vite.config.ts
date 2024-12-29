// vite.config.ts
// @vitejs/plugin-react v4.0.0
// vite v4.4.0

import { defineConfig } from 'vite'; // Type-safe configuration
import react from '@vitejs/plugin-react'; // React plugin with Fast Refresh
import path from 'path'; // Node.js path utilities

export default defineConfig({
  // React plugin configuration with TypeScript and Fast Refresh support
  plugins: [
    react({
      // Enable Fast Refresh for rapid development
      fastRefresh: true,
      // Use automatic JSX runtime
      jsxRuntime: 'automatic',
      // Configure Babel for TypeScript support
      babel: {
        parserOpts: {
          plugins: ['typescript']
        }
      }
    })
  ],

  // Path resolution and aliases configuration
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'src'),
      '@components': path.resolve(__dirname, 'src/components'),
      '@pages': path.resolve(__dirname, 'src/pages'),
      '@hooks': path.resolve(__dirname, 'src/hooks'),
      '@services': path.resolve(__dirname, 'src/services'),
      '@utils': path.resolve(__dirname, 'src/utils'),
      '@assets': path.resolve(__dirname, 'src/assets'),
      '@interfaces': path.resolve(__dirname, 'src/interfaces'),
      '@constants': path.resolve(__dirname, 'src/constants'),
      '@contexts': path.resolve(__dirname, 'src/contexts')
    }
  },

  // Development server configuration
  server: {
    // Set fixed port for consistent development
    port: 3000,
    strictPort: true,
    // API proxy configuration for backend integration
    proxy: {
      '/api': {
        target: 'http://localhost:8000',
        changeOrigin: true,
        secure: false,
        ws: true // WebSocket support
      }
    },
    // Hot Module Replacement settings
    hmr: {
      overlay: true // Show errors as overlay
    }
  },

  // Production build configuration
  build: {
    // Output directory for production build
    outDir: 'dist',
    // Generate source maps for debugging
    sourcemap: true,
    // Use Terser for minification
    minify: 'terser',
    // Target modern browsers for better performance
    target: 'esnext',
    // Increase chunk size warning limit
    chunkSizeWarningLimit: 1000,
    // Terser minification options
    terserOptions: {
      compress: {
        // Remove console.log in production
        drop_console: true,
        pure_funcs: ['console.log']
      }
    },
    // Rollup specific options
    rollupOptions: {
      output: {
        // Configure manual chunk splitting for optimal loading
        manualChunks: {
          // Core React dependencies
          vendor: ['react', 'react-dom', 'react-router-dom'],
          // UI component libraries
          ui: ['@mui/material', '@mui/icons-material'],
          // Utility libraries
          utils: ['lodash', 'axios', 'date-fns']
        }
      }
    }
  },

  // Dependency optimization configuration
  optimizeDeps: {
    // Include dependencies for pre-bundling
    include: [
      'react',
      'react-dom',
      'react-router-dom',
      '@mui/material'
    ],
    // Exclude internal components from pre-bundling
    exclude: ['@fscomponents']
  }
});