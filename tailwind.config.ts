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
        'nagoya-gold': '#FFD700',
        'nagoya-red': '#DC143C',
        'nagoya-purple': '#8B008B',
        'miso-brown': '#8B4513',
      },
      backgroundImage: {
        'tiger-pattern': "repeating-linear-gradient(45deg, #FFD700 0px, #FFD700 10px, #000 10px, #000 20px)",
      },
    },
  },
  plugins: [],
}
export default config
