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
        appbg: 'var(--color-appbg)',
        panel: 'var(--color-panel)',
        gameborder: 'var(--color-gameborder)',
        ink: 'var(--color-ink)',
        inkinverse: 'var(--color-inkinverse)',
        buttontext: 'var(--color-buttontext)',
        muted: 'var(--color-muted)',
        oshipink: 'var(--color-oshipink)',
        toska: 'var(--color-toska)',
        softpink: 'var(--color-softpink)',
        softtoska: 'var(--color-softtoska)',
      },
      fontFamily: {
        zen: ['"Zen Maru Gothic"', 'sans-serif'],
        inter: ['Inter', 'sans-serif'],
        mono: ['"JetBrains Mono"', 'monospace'],
      },
      boxShadow: {
        'game-thick': '0 8px 0 0 var(--color-gameshadow)',
        'game-thin': '0 4px 0 0 var(--color-gameshadow)',
        'vn-dialogue': '8px 8px 0 0 rgba(0,0,0,0.2)',
      }
    },
  },
  plugins: [],
}
