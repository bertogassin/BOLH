import type { Config } from 'tailwindcss'

const config: Config = {
  content: ['./app/**/*.{js,ts,jsx,tsx}', './components/**/*.{js,ts,jsx,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        guardian: {
          blue: '#0055FF',
          dark: '#0A0C10',
          light: '#F8F9FC',
          success: '#00C48C',
          error: '#FF3B30',
          warning: '#FF9500',
        },
      },
    },
  },
  plugins: [],
}
export default config
