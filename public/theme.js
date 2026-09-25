// Aplica o tema antes do primeiro paint para evitar flash. Externo por causa da CSP (sem inline script).
try {
  var t = localStorage.getItem('gps-theme')
  if (t === 'dark' || (t !== 'light' && matchMedia('(prefers-color-scheme: dark)').matches))
    document.documentElement.dataset.theme = 'dark'
} catch (e) {}
