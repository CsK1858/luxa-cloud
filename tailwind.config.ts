import type { Config } from 'tailwindcss';

const config: Config = {
  content: [
    './app/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        luxa: {
          gold: '#c9963b',
          'gold-light': '#e8c068',
          bg: '#0e0e0e',
          'bg-card': '#161614',
          'bg-hover': '#1e1c18',
          border: '#2a2520',
          text: '#e8e0d4',
          muted: '#8b7355',
          error: '#ef4444',
          success: '#4caf50',
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [],
};

export default config;
