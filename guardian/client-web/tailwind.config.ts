import type { Config } from 'tailwindcss'

const config: Config = {
  content: [
    './app/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        'guardian-blue': '#0055FF',
        'guardian-bg': '#F8F9FC',
      },
    },
  },
  plugins: [],
}
export default config
