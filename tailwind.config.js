/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: { brand: { DEFAULT: '#FFC861', dark: '#E5A93A', light: '#FFF4DE' } },
      fontFamily: { sans: ['Inter', 'Helvetica Neue', 'Arial', 'sans-serif'] },
    },
  },
  plugins: [],
}
