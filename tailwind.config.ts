import type { Config } from 'tailwindcss'

const config: Config = {
  content: [
    './pages/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        'gravida-green': '#1F2E23',
        'gravida-sage': '#5E7763',
        'gravida-light-sage': '#ACB6AE',
        'gravida-cream': '#e8e4de',
        'gravida-off-white': '#FCFBF8',
      },
      fontFamily: {
        sans: ['Inter Tight', 'sans-serif'],
      },
    },
  },
  plugins: [],
}
export default config
