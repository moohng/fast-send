/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        blue: {
          50: '#f0f8ff',
          100: '#e0f0fe',
          200: '#bae2fd',
          300: '#7ccbf9',
          400: '#3ab0e8',
          500: '#3498db',
          600: '#2980b9',
          700: '#1f6593',
          800: '#1a547a',
          900: '#164565',
        }
      }
    },
  },
  plugins: [],
}
