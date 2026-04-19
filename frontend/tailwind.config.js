/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx,ts,tsx}'],
  theme: {
    extend: {
      colors: {
        navy: {
          950: '#0a0e56',
          900: '#0d1265',
          800: '#131b7a',
          700: '#1a2278',
          600: '#232e98',
          500: '#2d3dbf',
          400: '#3d50d8',
          300: '#5468e8',
        },
      },
    },
  },
  plugins: [],
}
