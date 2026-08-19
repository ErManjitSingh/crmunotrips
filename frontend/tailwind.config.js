/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'sans-serif'],
        display: ['Inter', 'system-ui', 'sans-serif'],
        mono: ['JetBrains Mono', 'ui-monospace', 'monospace'],
      },
      colors: {
        brand: {
          50: '#EFF6FF',
          100: '#DBEAFE',
          500: '#3B82F6',
          600: '#2563EB',
          700: '#1D4ED8',
          900: '#0F172A',
        },
        gold: {
          DEFAULT: '#C9A227',
          soft: '#FDF8E8',
        },
        sidebar: {
          DEFAULT: '#0F172A',
          hover: '#1E293B',
          active: '#1D4ED8',
        },
        wa: {
          panel: 'var(--wa-panel)',
          header: 'var(--wa-header)',
          'chat-bg': 'var(--wa-chat-bg)',
          input: 'var(--wa-input)',
          border: 'var(--wa-border)',
          divider: 'var(--wa-divider)',
          'list-hover': 'var(--wa-list-hover)',
          'list-active': 'var(--wa-list-active)',
          'text-primary': 'var(--wa-text-primary)',
          'text-secondary': 'var(--wa-text-secondary)',
          'text-muted': 'var(--wa-text-muted)',
          'bubble-out': 'var(--wa-bubble-out)',
          'bubble-out-text': 'var(--wa-bubble-out-text)',
          'bubble-in': 'var(--wa-bubble-in)',
          'bubble-in-text': 'var(--wa-bubble-in-text)',
        },
      },
      boxShadow: {
        card: '0 1px 3px rgba(0,0,0,0.06), 0 4px 12px rgba(0,0,0,0.04)',
        'card-hover': '0 8px 24px rgba(0,0,0,0.08)',
        glass: '0 8px 32px rgba(15,23,42,0.08)',
        float: '0 12px 40px rgba(15,23,42,0.12)',
      },
      borderRadius: {
        xl: '12px',
        '2xl': '16px',
      },
      backdropBlur: {
        glass: '20px',
      },
      animation: {
        'pulse-soft': 'pulse-soft 2s ease-in-out infinite',
        'hot-text': 'hot-text 1s ease-in-out infinite',
        'fade-up': 'fade-up 0.3s ease-out',
      },
      keyframes: {
        'pulse-soft': {
          '0%, 100%': { opacity: '1' },
          '50%': { opacity: '0.7' },
        },
        'hot-text': {
          '0%, 100%': { opacity: '1', transform: 'scale(1)' },
          '50%': { opacity: '0.45', transform: 'scale(1.12)' },
        },
        'fade-up': {
          '0%': { opacity: '0', transform: 'translateY(8px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
      },
    },
  },
  plugins: [],
};
