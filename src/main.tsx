import React from 'react';
import ReactDOM from 'react-dom/client';
import { App } from './App';
import { ErrorBoundary } from './components/ErrorBoundary';
import './index.css';

declare global {
  interface Window {
    __chatBooted?: boolean;
  }
}

const rootEl = document.getElementById('root');

if (!rootEl) {
  throw new Error('Missing #root element: index.html is not the Chat Web entry page.');
}

ReactDOM.createRoot(rootEl).render(
  <React.StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </React.StrictMode>
);

// Mark the app as live and drop the boot placeholder so a successful start never
// leaves the fallback message or spinner on screen.
window.__chatBooted = true;
document.getElementById('boot-screen')?.remove();
