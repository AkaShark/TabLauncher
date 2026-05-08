import type { Config } from 'tailwindcss';

/**
 * Design tokens (M9 — editorial minimalism).
 * Colors are CSS-var driven so light/dark themes share one token surface.
 * Vars are defined in src/styles/index.css.
 */
const config: Config = {
  content: ['./src/**/*.{vue,ts,html}', './index.html'],
  theme: {
    extend: {
      colors: {
        paper: 'rgb(var(--paper) / <alpha-value>)',
        ink: 'rgb(var(--ink) / <alpha-value>)',
        muted: 'rgb(var(--muted) / <alpha-value>)',
        hair: 'rgb(var(--hair) / <alpha-value>)',
        accent: 'rgb(var(--accent) / <alpha-value>)',
        warn: 'rgb(var(--warn) / <alpha-value>)',
        danger: 'rgb(var(--danger) / <alpha-value>)',
      },
      fontFamily: {
        display: ['Fraunces', 'Source Serif 4', 'Newsreader', 'Georgia', 'serif'],
        sans: [
          'Public Sans',
          'ui-sans-serif',
          'system-ui',
          '-apple-system',
          'Segoe UI',
          'sans-serif',
        ],
        mono: [
          'JetBrains Mono',
          'ui-monospace',
          'SFMono-Regular',
          'Menlo',
          'monospace',
        ],
      },
      letterSpacing: {
        tightest: '-0.04em',
        wider2: '0.18em',
      },
      fontSize: {
        '2xs': ['0.6875rem', { lineHeight: '1rem', letterSpacing: '0.04em' }],
      },
      spacing: {
        18: '4.5rem',
        22: '5.5rem',
      },
    },
  },
  plugins: [],
};

export default config;
