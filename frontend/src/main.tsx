import { StrictMode, useState } from 'react'
import { createRoot } from 'react-dom/client'
import { ThemeProvider } from './lib/theme'
import App from './App.tsx'
import SplashScreen from './components/SplashScreen'
import './index.css'

function Root() {
  const [showSplash, setShowSplash] = useState(() => {
    // Skip splash if user already visited this session
    return !sessionStorage.getItem('shade_splash_seen');
  });

  const handleSplashComplete = () => {
    sessionStorage.setItem('shade_splash_seen', '1');
    setShowSplash(false);
  };

  return (
    <StrictMode>
      <ThemeProvider>
        {showSplash && <SplashScreen onComplete={handleSplashComplete} />}
        <App />
      </ThemeProvider>
    </StrictMode>
  );
}

createRoot(document.getElementById('root')!).render(<Root />)
