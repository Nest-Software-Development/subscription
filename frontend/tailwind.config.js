/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class',
  content: ['./index.html', './src/**/*.{vue,js,ts}'],
  theme: {
    extend: {
      fontFamily: {
        sans: [
          '-apple-system',
          'BlinkMacSystemFont',
          '"SF Pro Text"',
          '"SF Pro Display"',
          '"Segoe UI Variable Text"',
          '"Segoe UI"',
          'Roboto',
          'system-ui',
          'sans-serif',
        ],
        rounded: [
          'ui-rounded',
          '"SF Pro Rounded"',
          '-apple-system',
          'system-ui',
          'sans-serif',
        ],
      },
      colors: {
        ink: {
          DEFAULT: 'rgb(var(--ink) / <alpha-value>)',
          soft: 'rgb(var(--ink-soft) / <alpha-value>)',
          mute: 'rgb(var(--ink-mute) / <alpha-value>)',
        },
        surface: {
          DEFAULT: 'rgb(var(--surface) / <alpha-value>)',
          page: 'rgb(var(--page) / <alpha-value>)',
          sunk: 'rgb(var(--sunk) / <alpha-value>)',
          elevated: 'rgb(var(--elevated) / <alpha-value>)',
        },
        line: 'rgb(var(--line) / <alpha-value>)',
        field: 'rgb(var(--field) / <alpha-value>)',
        coral: {
          50: '#FFF1F1',
          100: '#FFE1E1',
          200: '#FFC7C7',
          400: '#FF6B6B',
          500: '#FF5757',
          600: '#D92D20',
          700: '#B42318',
        },
        obsidian: {
          800: '#121826',
          900: '#0B1220',
          950: '#060A13',
        },
        ok: {
          DEFAULT: 'rgb(var(--ok) / <alpha-value>)',
          solid: '#0E7A56',
        },
        warn: {
          DEFAULT: 'rgb(var(--warn) / <alpha-value>)',
          solid: '#B25900',
        },
        bad: {
          DEFAULT: 'rgb(var(--bad) / <alpha-value>)',
          solid: '#C92A2A',
        },
      },
      borderRadius: {
        card: '1.25rem',
        sheet: '1.75rem',
        field: '0.875rem',
      },
      boxShadow: {
        card: '0 1px 2px rgba(11, 18, 32, 0.04), 0 8px 24px -12px rgba(11, 18, 32, 0.07)',
        nav: '0 12px 36px -8px rgba(11, 18, 32, 0.22), 0 2px 8px rgba(11, 18, 32, 0.08)',
      },
    },
  },
  plugins: [],
}

