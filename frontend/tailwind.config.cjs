module.exports = {
  darkMode: 'class',
  content: [
    './index.html',
    './src/**/*.{js,jsx,ts,tsx}'
  ],
  theme: {
    extend: {
      colors: {
        background: '#FFF2C2',
        backgroundDark: '#423838',
        text: '#423838',
        textDark: '#FFF2C2',
        accent: '#B497E7',
        statusPending: '#F7C98B',
        statusSuccess: '#B9D7B0',
        statusError: '#E9B6B0',
        statusEscalated: '#D99A6C'
      },
      boxShadow: {
        cozy: '0 12px 30px rgba(66, 56, 56, 0.12)'
      },
      borderRadius: {
        cozy: '16px'
      }
    }
  },
  plugins: []
}
