import { createRoot } from 'react-dom/client';
import 'animate.css';
import App from './App.tsx';
import { StudioErrorBoundary } from './components/StudioErrorBoundary';
import './index.css';

window.addEventListener('unhandledrejection', (event) => {
  event.preventDefault();
});

createRoot(document.getElementById('root')!).render(
  <StudioErrorBoundary>
    <App />
  </StudioErrorBoundary>
);
