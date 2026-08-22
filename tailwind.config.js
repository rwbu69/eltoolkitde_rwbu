/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        appbg: '#FFFBF5',
        panel: '#FFFFFF',
        ink: '#4A3E54',
        muted: '#A597B0',
        oshipink: '#FF6FA0',
        toska: '#2FD9C0',
        softpink: '#FFEBF1',
        softtoska: '#E5FAF7',
      },
      fontFamily: {
        zen: ['"Zen Maru Gothic"', 'sans-serif'],
        inter: ['Inter', 'sans-serif'],
        mono: ['"JetBrains Mono"', 'monospace'],
      },
      boxShadow: {
        'game-thick': '0 8px 0 0 #4A3E54',
        'game-thin': '0 4px 0 0 #4A3E54',
        'vn-dialogue': '8px 8px 0 0 rgba(58,46,66,0.05)',
      }
    },
  },
  plugins: [],
}
