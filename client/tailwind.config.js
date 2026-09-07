/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        // Deep-ocean blue — the institutional brand (buttons, links, active
        // nav). Kept stable so it stays in step with the PDFs and emails.
        brand: {
          50: '#eff4ff',
          100: '#dce8ff',
          200: '#b9d0fe',
          500: '#3b63d4',
          600: '#1e40af',
          700: '#1730a0',
          900: '#0f1e6b',
        },
        // Lagoon / Indian-Ocean teal — the lively coastal accent.
        sea: {
          50: '#ecfeff',
          100: '#cffafe',
          200: '#a5f3fc',
          300: '#67e8f9',
          400: '#22d3ee',
          500: '#06b6d4',
          600: '#0891b2',
          700: '#0e7490',
          900: '#164e63',
        },
        // Coral sunset over the dhow harbour — warm highlight for energy.
        coral: {
          50: '#fff1ed',
          100: '#ffe0d6',
          200: '#ffc1ad',
          400: '#ff7a52',
          500: '#f8572b',
          600: '#e23e16',
        },
        // Brass of Swahili carved doors — premium / award accent.
        gold: {
          100: '#fbf0d3',
          300: '#e9c766',
          400: '#dcae3f',
          500: '#c79a2b',
          600: '#a87c1c',
        },
        // Coral-stone & beach sand — warm neutral wash.
        sand: {
          50: '#fbf7f0',
          100: '#f3ead9',
          200: '#e6d6ba',
        },
        // Theme-aware semantic tokens (see index.css)
        canvas: 'var(--color-canvas)',
        card: 'var(--color-card)',
        line: 'var(--color-line)',
        ink: 'var(--color-ink)',
        subtle: 'var(--color-subtle)',
        hover: 'var(--color-hover)',
        accentSoft: 'var(--color-accent-soft)',
      },
      fontFamily: {
          // 'Plus Jakarta Sans' for headings — friendly, modern geometric feel
        display: ['"Plus Jakarta Sans"', 'sans-serif'],
         // Inter for body text — high readability at small sizes
        sans: ['Inter', 'sans-serif'],
      },
      backgroundImage: {
        // Reusable coastal gradients.
        'ocean-deep': 'linear-gradient(160deg, #0f1e6b 0%, #1e40af 45%, #0e7490 100%)',
        'ocean-dawn': 'linear-gradient(135deg, #1e40af 0%, #0891b2 55%, #f8572b 140%)',
        lagoon: 'linear-gradient(120deg, #06b6d4 0%, #1e40af 100%)',
        'sun-brass': 'linear-gradient(135deg, #e9c766 0%, #c79a2b 100%)',
      },
      boxShadow: {
        glow: '0 0 0 1px rgba(255,255,255,0.12), 0 20px 60px -15px rgba(6,182,212,0.45)',
      },
    },
  },
  plugins: [],
};
