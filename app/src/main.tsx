import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import './styles.css';

try {
  const t = localStorage.getItem('abet-theme');
  const dark = t ? t === 'dark' : window.matchMedia('(prefers-color-scheme: dark)').matches;
  document.documentElement.dataset.theme = dark ? 'dark' : 'light';
  document.documentElement.classList.toggle('is-dark', dark);
} catch { /* storage blocked: use light */ }

createRoot(document.getElementById('root')!).render(<StrictMode><App /></StrictMode>);
