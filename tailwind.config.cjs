// Slate-Töne als CSS-Variablen: Im Hell-Modus wird die Skala umgedreht
// (src/tailwind-input.css, [data-theme="light"]), die Klassen bleiben gleich.
const v = (n) => `rgb(var(--slate-${n}) / <alpha-value>)`;

module.exports = {
  content: ['src/**/*.{js,jsx}', 'public/index.html'],
  theme: {
    extend: {
      colors: {
        slate: Object.fromEntries([50, 100, 200, 300, 400, 500, 600, 700, 800, 900, 950].map((n) => [n, v(n)])),
      },
    },
  },
};
