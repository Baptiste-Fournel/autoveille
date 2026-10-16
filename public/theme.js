try {
  const chosen = localStorage.getItem('av_theme');
  if (chosen === 'dark' || chosen === 'light') {
    document.documentElement.setAttribute('data-theme', chosen);
    document.querySelector('meta[name=theme-color]').content = chosen === 'dark' ? '#15171A' : '#F5F4F0';
  }
} catch {}
