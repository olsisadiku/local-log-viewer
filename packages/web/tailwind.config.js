/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        mono: ['JetBrains Mono', 'Fira Code', 'Monaco', 'Consolas', 'monospace'],
      },
      colors: {
        log: {
          debug: '#6b7280',
          info: '#3b82f6',
          warn: '#f59e0b',
          error: '#ef4444',
          fatal: '#dc2626',
          trace: '#8b5cf6',
        },
      },
    },
  },
  plugins: [],
};
