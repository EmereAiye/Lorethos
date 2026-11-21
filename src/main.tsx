import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import './index.css';
import { triggerSafeChunkReload } from './utils/lazyWithRetry';

if (typeof window !== 'undefined') {
  window.addEventListener('vite:preloadError', (event) => {
    event.preventDefault();
    triggerSafeChunkReload();
  });
}

createRoot(document.getElementById('root')!).render(<App />);

