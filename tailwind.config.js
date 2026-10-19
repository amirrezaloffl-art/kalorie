/** @type {import('tailwindcss').Config} */
const v = (name) => `rgb(var(--${name}) / <alpha-value>)`;
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  darkMode: ['selector', '[data-theme="dark"]'],
  theme: {
    extend: {
      colors: {
        bg: v('bg'),
        surface: v('surface'),
        surface2: v('surface-2'),
        line: v('border'),
        ink: v('text'),
        ink2: v('text-2'),
        ink3: v('text-3'),
        accent: v('accent'),
        accentSoft: v('accent-soft'),
        protein: v('protein'),
        carbs: v('carbs'),
        fat: v('fat'),
        fiber: v('fiber'),
        water: v('water'),
        good: v('good'),
        warn: v('warn'),
        bad: v('bad'),
        primary: v('primary'),
        onPrimary: v('on-primary'),
      },
      borderRadius: { lg: '24px', md: '16px', sm: '10px' },
      boxShadow: { card: '0 6px 24px rgba(20, 20, 40, 0.06)' },
      fontFamily: { sans: ['var(--font)', 'system-ui', 'sans-serif'] },
    },
  },
  plugins: [],
};
