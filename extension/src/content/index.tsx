import { createRoot } from 'react-dom/client';
import { App } from '../ui/App';
import styles from '../ui/styles.css?inline';

if (document.getElementById('lc-visualizer-root')) throw new Error('LeetCode Visualizer is already mounted on this page.');
const host=document.createElement('div'); host.id='lc-visualizer-root'; document.documentElement.append(host);
const shadow=host.attachShadow({mode:'open'});
const style=document.createElement('style'); style.textContent=styles; shadow.append(style);
const mount=document.createElement('div'); shadow.append(mount); createRoot(mount).render(<App />);
