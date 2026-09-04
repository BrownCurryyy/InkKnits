module.exports = {
  darkMode: 'class',
  content: [
    './index.html',
    './src/**/*.{js,jsx,ts,tsx}'
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ['DM Sans', 'sans-serif'],
        display: ['Space Grotesk', 'sans-serif'],
        mono: ['IBM Plex Mono', 'monospace'],
      },
      colors: {
        background: '#F5F3EE',
        backgroundDark: '#0D0D0D',
        surface: '#151515',
        surfaceDeep: '#101010',
        border: '#D9D6CF',
        borderDark: '#292929',
        text: '#0D0D0D',
        textDark: '#F5F3EE',
        accent: '#E53935',
        accentSoft: '#FCE9E8',
        muted: '#77736D',
        statusPending: '#77736D',
        statusSuccess: '#77736D',
        statusError: '#E53935',
        statusEscalated: '#77736D'
      },
      boxShadow: {
        cozy: '0 18px 36px rgba(13, 13, 13, 0.10)',
        panel: '0 18px 36px rgba(13, 13, 13, 0.08)'
      },
      borderRadius: {
        cozy: '8px',
        panel: '12px'
      }
    }
  },
  plugins: []
}
