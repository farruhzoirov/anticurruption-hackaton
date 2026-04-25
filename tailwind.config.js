/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        navy: {
          900: '#0f1b2d',
          800: '#142339',
          700: '#1b2d49',
          600: '#243b5e',
        },
        gold: {
          400: '#ffc24d',
          500: '#f5a623',
          600: '#d18b18',
        },
      },
      fontFamily: {
        sans: ['Inter', 'ui-sans-serif', 'system-ui', 'sans-serif'],
      },
      keyframes: {
        'fade-in': {
          '0%': { opacity: '0', transform: 'translateY(8px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        'scale-in': {
          '0%': { opacity: '0', transform: 'scale(0.9)' },
          '100%': { opacity: '1', transform: 'scale(1)' },
        },
        'shake': {
          '0%, 100%': { transform: 'translateX(0)' },
          '20%, 60%': { transform: 'translateX(-6px)' },
          '40%, 80%': { transform: 'translateX(6px)' },
        },
        'pulse-gold': {
          '0%, 100%': { boxShadow: '0 0 0 0 rgba(245, 166, 35, 0.5)' },
          '50%': { boxShadow: '0 0 0 14px rgba(245, 166, 35, 0)' },
        },
        'siren': {
          '0%, 100%': { backgroundColor: 'rgba(220, 38, 38, 0.15)' },
          '50%': { backgroundColor: 'rgba(220, 38, 38, 0.35)' },
        },
        'cursor-blink': {
          '0%, 49%': { opacity: '1' },
          '50%, 100%': { opacity: '0' },
        },
      },
      animation: {
        'fade-in': 'fade-in 0.4s ease-out',
        'scale-in': 'scale-in 0.3s ease-out',
        'shake': 'shake 0.6s ease-in-out',
        'pulse-gold': 'pulse-gold 2s ease-in-out infinite',
        'siren': 'siren 1s ease-in-out infinite',
        'cursor-blink': 'cursor-blink 1s steps(2) infinite',
      },
    },
  },
  plugins: [],
};
