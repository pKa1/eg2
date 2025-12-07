/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        primary: {
          50: '#fff2f2',
          100: '#ffe1e1',
          200: '#ffc7c7',
          300: '#ff9f9f',
          400: '#f47474',
          500: '#c72627', // базовый красный
          600: '#b02021',
          700: '#9c1b1d',
          800: '#7f1618',
          900: '#661214',
        },
      },
    },
  },
  plugins: [],
}

