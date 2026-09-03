module.exports = {
  darkMode: 'class',
  content: [
    './index.html',
    './src/**/*.{js,jsx,ts,tsx}'
  ],
  theme: {
    extend: {
      colors: {
        background: '#FAFAF5',
        backgroundDark: '#2D2A4A',
        text: '#2D2A4A',
        textDark: '#FAFAF5',
        accent: '#D4E257',
        accentSecondary: '#B2B9EE',
        statusPending: '#F7C98B',
        statusSuccess: '#A8D5A2',
        statusError: '#E9A8A8',
        statusEscalated: '#D99A6C'
      },
      fontFamily: {
        display: ['Fredoka', 'Nunito', 'sans-serif'],
        sans: ['DM Sans', 'Segoe UI', 'sans-serif'],
      },
      boxShadow: {
        cozy: '0 12px 30px rgba(45, 42, 74, 0.1)',
        bold: '0 8px 0 rgba(45, 42, 74, 0.15)'
      },
      borderRadius: {
        cozy: '16px',
        blob: '24px'
      }
    }
  },
  plugins: []
}
