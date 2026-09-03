import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        brand: {
          50: '#eef6ff',
          100: '#d9ebff',
          200: '#bcdcff',
          300: '#8ec5ff',
          400: '#59a4ff',
          500: '#3182f6',
          600: '#1c63e0',
          700: '#194fb5',
          800: '#1b4392',
          900: '#1c3a74',
          950: '#152447',
        },
      },
    },
  },
  plugins: [],
};

export default config;
