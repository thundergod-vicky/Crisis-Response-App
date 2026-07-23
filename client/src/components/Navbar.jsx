import React, { useState, useEffect } from 'react';
import { useTheme } from '../context/ThemeContext';
import { Sun, Moon, Map, Image, Radio, ShieldAlert, Download } from 'lucide-react';
import InstallModal from './InstallModal';

const Navbar = ({ activeTab, setActiveTab }) => {
  const { theme, toggleTheme } = useTheme();
  const [isInstallModalOpen, setIsInstallModalOpen] = useState(false);
  const [deferredPrompt, setDeferredPrompt] = useState(null);
  const [showInstallBtn, setShowInstallBtn] = useState(true); // Always show the button

  const tabs = [
    { id: 'dashboard', label: 'Dashboard Map', shortLabel: 'Map', icon: Map },
    { id: 'feed', label: 'Crash Feed', shortLabel: 'Feed', icon: Image },
    { id: 'collision', label: 'Collision Detector', shortLabel: 'Telemetry', icon: Radio },
    { id: 'emergency', label: 'Emergency Hub', shortLabel: 'Emergency', icon: ShieldAlert },
  ];

  // Capture the native browser install prompt for Android/Desktop Chrome
  useEffect(() => {
    const handler = (e) => {
      e.preventDefault();
      setDeferredPrompt(e);
    };
    window.addEventListener('beforeinstallprompt', handler);

    // Hide button if app is already installed (standalone mode)
    if (window.matchMedia('(display-mode: standalone)').matches) {
      setShowInstallBtn(false);
    }

    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  return (
    <>
      <nav className="navbar">
        <div className="nav-brand">
          <img src="/logo.png" alt="Mahamarg Logo" className="nav-logo-img" />
          <div className="nav-title-group">
            <span className="nav-title">Mahamarg</span>
            <span className="nav-subtitle">india's own crisis response app</span>
          </div>
        </div>

        <div className="nav-controls">
          <div className="nav-tabs desktop-only">
            {tabs.map((tab) => {
              const Icon = tab.icon;
              return (
                <button
                  key={tab.id}
                  className={`nav-tab-btn ${activeTab === tab.id ? 'active' : ''}`}
                  onClick={() => setActiveTab(tab.id)}
                >
                  <Icon size={16} />
                  <span>{tab.label}</span>
                </button>
              );
            })}
          </div>

          {/* Install App Button */}
          {showInstallBtn && (
            <button
              className="install-app-btn"
              onClick={() => setIsInstallModalOpen(true)}
              title="Install Mahamarg App"
              aria-label="Install App"
            >
              <Download size={16} />
              <span className="install-app-btn-label">Install App</span>
            </button>
          )}

          <button
            onClick={toggleTheme}
            className="theme-toggle-btn"
            title={`Switch to ${theme === 'light' ? 'Dark' : 'Light'} Theme`}
            aria-label="Toggle Theme"
          >
            {theme === 'light' ? <Moon size={18} /> : <Sun size={18} />}
          </button>
        </div>
      </nav>

      {/* Mobile Bottom Navigation Bar */}
      <div className="mobile-bottom-nav">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          return (
            <button
              key={tab.id}
              className={`mobile-nav-btn ${activeTab === tab.id ? 'active' : ''}`}
              onClick={() => setActiveTab(tab.id)}
            >
              <Icon size={20} />
              <span className="mobile-nav-label">{tab.shortLabel}</span>
            </button>
          );
        })}

        {/* Mobile Install Button in bottom nav */}
        {showInstallBtn && (
          <button
            className={`mobile-nav-btn mobile-install-nav-btn`}
            onClick={() => setIsInstallModalOpen(true)}
            aria-label="Install App"
          >
            <Download size={20} />
            <span className="mobile-nav-label">Install</span>
          </button>
        )}
      </div>

      {/* Install Instructions Modal */}
      {isInstallModalOpen && (
        <InstallModal
          onClose={() => setIsInstallModalOpen(false)}
          deferredPrompt={deferredPrompt}
          onInstallClick={() => setIsInstallModalOpen(false)}
        />
      )}
    </>
  );
};

export default Navbar;
