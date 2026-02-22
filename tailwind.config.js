/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        navy: {
          DEFAULT: '#0F2041',
          50: '#E8ECF4',
          100: '#C5CFDF',
          900: '#0F2041',
        },
        mint: {
          DEFAULT: '#00C9A7',
          light: '#E0FAF6',
          dark: '#00836D',
        },
      },
      fontFamily: {
        sans: ['DM Sans', 'sans-serif'],
        heading: ['Bricolage Grotesque', 'sans-serif'],
      },
      borderRadius: {
        xl: '16px',
        '2xl': '24px',
      },
    },
  },
  plugins: [],
}
