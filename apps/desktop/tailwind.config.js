/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: 'class',
  content: ['./src/renderer/**/*.{ts,tsx,html}'],
  theme: {
    extend: {
      colors: {
        background: {
          DEFAULT: 'hsl(var(--background))',
          surface: 'hsl(var(--background-surface))',
          deep: 'hsl(var(--background-deep))',
        },
        foreground: {
          DEFAULT: 'hsl(var(--foreground))',
          muted: 'hsl(var(--foreground-muted))',
          dim: 'hsl(var(--foreground-dim))',
        },
        border: 'hsl(var(--border))',
        'border-accent': 'hsl(var(--border-accent))',
        accent: {
          DEFAULT: 'hsl(var(--accent))',
          bg: 'hsl(var(--accent-bg))',
        },
        popover: {
          DEFAULT: 'hsl(var(--background-surface))',
          foreground: 'hsl(var(--foreground))',
        },
        destructive: 'hsl(var(--destructive))',
        success: 'hsl(var(--success))',
        warning: 'hsl(var(--warning))',
      },
    },
  },
  plugins: [require('tailwindcss-animate')],
};
