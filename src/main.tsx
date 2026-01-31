import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './styles/index.css';

// Native-like behavior overrides
document.addEventListener('contextmenu', (event) => event.preventDefault());

document.addEventListener('keydown', (event) => {
    // Prevent Refresh (F5, Ctrl+R)
    if (event.key === 'F5' || (event.ctrlKey && event.key === 'r')) {
        event.preventDefault();
    }
});

// Inject global styles for user-select: none
const style = document.createElement('style');
style.innerHTML = `
  * {
    user-select: none;
    -webkit-user-select: none;
    cursor: default;
  }
  input, textarea {
    user-select: text;
    -webkit-user-select: text;
    cursor: text;
  }
`;
document.head.appendChild(style);

ReactDOM.createRoot(document.getElementById('root')!).render(
    <React.StrictMode>
        <App />
    </React.StrictMode>
);
