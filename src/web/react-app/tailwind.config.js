/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      fontFamily: {
        cinzel: ['"Cinzel"', 'serif'],
        cormorant: ['"Cormorant Garamond"', 'Georgia', 'serif'],
      },
      colors: {
        gold: {
          DEFAULT: '#c9a45c',
          bright: '#f6efd2',
          dim: '#8a6f3a',
          deep: '#5a4622',
        },
        obsidian: '#06060c',
        ink: {
          DEFAULT: '#e8e2cf',
          soft: '#c9c2ad',
          mute: '#7a7461',
          faint: '#4a4636',
        },
      },
    },
  },
  plugins: [],
};
