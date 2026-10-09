import React from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.jsx';
import './styles.css';
import './production-ui.css';
import './visual-system.css';
createRoot(document.getElementById('root')).render(<React.StrictMode><App/></React.StrictMode>);
