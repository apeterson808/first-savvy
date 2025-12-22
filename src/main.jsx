import React from 'react'
import ReactDOM from 'react-dom/client'
import App from '@/App.jsx'
import '@/index.css'
import '@/api/firstsavvyClient.js'

console.log('[main.jsx] Starting React app...');
console.log('[main.jsx] Root element:', document.getElementById('root'));

const root = document.getElementById('root');

if (!root) {
  console.error('[main.jsx] ERROR: Root element not found!');
} else {
  console.log('[main.jsx] Root element found, rendering React app...');
  ReactDOM.createRoot(root).render(<App />);
  console.log('[main.jsx] React app render called');
} 