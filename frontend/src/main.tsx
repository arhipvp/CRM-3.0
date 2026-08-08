import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import './index.css';
import { observeWebVitals } from './performance';

const container = document.getElementById('root');

if (!container) {
  throw new Error('Не найден элемент #root для монтирования приложения');
}

const root = createRoot(container);
observeWebVitals();
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
