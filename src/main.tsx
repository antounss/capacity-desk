import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { trackKeyboard } from './app/keyboard';
import App from './App';
import './index.css';

trackKeyboard();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
