import React from 'react';
import { useTheme } from '../context/ThemeContext';
import { Sun, Moon, AlertTriangle, Map, Image, Radio, ShieldAlert } from 'lucide-react';

const Navbar = ({ activeTab, setActiveTab }) => {
  const { theme, toggleTheme } = useTheme();

  const tabs = [
    { id: 'dashboard', label: 'Dashboard Map', shortLabel: 'Map', icon: Map },
    { id: 'feed', label: 'Crash Feed', shortLabel: 'Feed', icon: Image },
    { id: 'collision', label: 'Collision Detector', shortLabel: 'Telemetry', icon: Radio },
    { id: 'emergency', label: 'Emergency Hub', shortLabel: 'Emergency', icon: ShieldAlert },
  ];

  return (
    <>
      <nav className="navbar">
        <div className="nav-brand">
          <img src="/logo.png" alt="Crisis Respond India Logo" className="nav-logo-img" />
          <div className="nav-title-group">
            <span className="nav-title">Crisis Respond India</span>
            <span className="nav-subtitle">Highway Emergency Net</span>
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
      </div>
    </>
  );
};

export default Navbar;
