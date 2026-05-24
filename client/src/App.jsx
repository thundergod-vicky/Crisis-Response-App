import React, { useState } from 'react';
import { ThemeProvider } from './context/ThemeContext';
import Navbar from './components/Navbar';
import MapDashboard from './components/MapDashboard';
import CrashFeed from './components/CrashFeed';
import CollisionDetector from './components/CollisionDetector';
import EmergencyHub from './components/EmergencyHub';
import './styles/global.css';

function AppContent() {
  const [activeTab, setActiveTab] = useState('dashboard');

  const renderContent = () => {
    switch (activeTab) {
      case 'dashboard':
        return <MapDashboard />;
      case 'feed':
        return <CrashFeed />;
      case 'collision':
        return <CollisionDetector />;
      case 'emergency':
        return <EmergencyHub />;
      default:
        return <MapDashboard />;
    }
  };

  return (
    <div className="app-container">
      <Navbar activeTab={activeTab} setActiveTab={setActiveTab} />
      <main className="main-content">
        {renderContent()}
      </main>
    </div>
  );
}

function App() {
  return (
    <ThemeProvider>
      <AppContent />
    </ThemeProvider>
  );
}

export default App;
