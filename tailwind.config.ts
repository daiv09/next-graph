import type { Config } from 'tailwindcss';

const config: Config = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      boxShadow: {
        'glass-glow': '0 0 28px rgba(139, 92, 246, 0.5)',
      },
      dropShadow: {
        'glass-depth': [
          '0 8px 32px rgba(0, 0, 0, 0.45)',
          '0 16px 48px rgba(0, 0, 0, 0.3)'
        ],
        'glass-depth-hover': [
          '0 12px 40px rgba(0, 0, 0, 0.6)',
          '0 20px 64px rgba(0, 0, 0, 0.45)'
        ],
      },
    },
  },
  plugins: [],
};

export default config;
