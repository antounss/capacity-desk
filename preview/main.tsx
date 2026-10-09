// Entry point of the web preview: the same app, started with the sample week.

import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from '../src/App';
import '../src/index.css';
import './preview.css';
import { sampleForThisWeek } from './seed';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App initialData={sampleForThisWeek()} />
  </StrictMode>,
);
