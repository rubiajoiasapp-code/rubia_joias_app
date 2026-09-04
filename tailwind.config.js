/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        // Ouro da marca, amostrado direto do logotipo em brand/logo-lockup.jpg.
        // Não use os `yellow-*` do Tailwind aqui: eles são amarelo-limão saturado
        // (yellow-400 = #FACC15) e brigam com o dourado antigo e acinzentado da arte.
        ouro: {
          50: '#FBF5E8',
          100: '#F8E6C2',  // reflexo mais claro do logotipo
          200: '#ECDCAB',
          300: '#DFC894',
          400: '#D0B070',
          500: '#C0A060',  // tom central da marca
          600: '#A88434',
          700: '#907030',  // dourado escuro dominante na arte
          800: '#6B521C',
          900: '#4A3813',
          950: '#2A1F0A',
        },
      },
    },
  },
  plugins: [],
}
