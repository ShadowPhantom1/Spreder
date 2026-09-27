/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        spidey: {
          red: '#E30613',
          'red-dark': '#9A0007',
          'red-glow': '#FF2D3B',
          blue: '#0A1628',
          'blue-light': '#162447',
          'blue-mid': '#1B3A5C',
          cyan: '#00D9FF',
          yellow: '#FFD23F',
          web: '#E8EEF6',
          'web-dim': '#CBD5E1',
        },
      },
      fontFamily: {
        display: ['Bebas Neue', 'Anton', 'sans-serif'],
        body: ['Space Grotesk', 'Inter', 'system-ui', 'sans-serif'],
        mono: ['JetBrains Mono', 'monospace'],
      },
      boxShadow: {
        'spidey': '0 0 40px rgba(227,6,19,0.4), 0 0 80px rgba(227,6,19,0.15)',
        'spidey-blue': '0 0 40px rgba(0,217,255,0.3), 0 8px 32px rgba(10,22,40,0.6)',
        'card-3d': '0 20px 60px -12px rgba(10,22,40,0.7), 0 0 0 1px rgba(227,6,19,0.15) inset',
      },
      animation: {
        'web-sway': 'webSway 6s ease-in-out infinite',
        'web-pulse': 'webPulse 2s ease-in-out infinite',
        'spidey-float': 'spideyFloat 4s ease-in-out infinite',
        'halftone-shift': 'halftoneShift 20s linear infinite',
        'swing': 'swing 1.2s ease-out',
      },
      keyframes: {
        webSway: {
          '0%, 100%': { transform: 'translateY(0) rotate(0.5deg)' },
          '50%': { transform: 'translateY(-8px) rotate(-0.5deg)' },
        },
        webPulse: {
          '0%,100%': { opacity: '0.4', transform: 'scale(1)' },
          '50%': { opacity: '1', transform: 'scale(1.05)' },
        },
        spideyFloat: {
          '0%,100%': { transform: 'translateY(0px) rotate(-1deg)' },
          '50%': { transform: 'translateY(-12px) rotate(1deg)' },
        },
        halftoneShift: {
          '0%': { backgroundPosition: '0 0' },
          '100%': { backgroundPosition: '40px 40px' },
        },
        swing: {
          '0%': { transform: 'translateY(-100vh) rotate(-15deg)', opacity: '0' },
          '60%': { transform: 'translateY(20px) rotate(5deg)', opacity: '1' },
          '80%': { transform: 'translateY(-10px) rotate(-2deg)' },
          '100%': { transform: 'translateY(0) rotate(0)', opacity: '1' },
        },
      },
      backgroundImage: {
        'spidey-gradient': 'linear-gradient(135deg, #E30613 0%, #9A0007 50%, #0A1628 100%)',
        'web-gradient': 'radial-gradient(ellipse at top, rgba(227,6,19,0.15) 0%, transparent 60%), radial-gradient(ellipse at bottom right, rgba(0,217,255,0.1) 0%, transparent 50%)',
      },
    },
  },
  plugins: [],
}
