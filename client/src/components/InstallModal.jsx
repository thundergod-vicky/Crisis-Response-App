import React, { useState, useEffect } from 'react';
import { X, Download, Smartphone, Monitor, ChevronRight, CheckCircle, Share, MoreVertical } from 'lucide-react';

const InstallModal = ({ onClose, deferredPrompt, onInstallClick }) => {
  const [activeTab, setActiveTab] = useState('android');
  const [installed, setInstalled] = useState(false);

  // Detect iOS
  const isIOS = /iphone|ipad|ipod/i.test(navigator.userAgent);
  const isAndroid = /android/i.test(navigator.userAgent);

  // Auto-select OS tab based on device
  useEffect(() => {
    if (isIOS) setActiveTab('ios');
    else setActiveTab('android');
  }, []);

  const handleNativeInstall = async () => {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === 'accepted') {
      setInstalled(true);
      setTimeout(() => onClose(), 1800);
    }
  };

  const androidSteps = [
    {
      icon: '🌐',
      title: 'Open in Chrome',
      desc: 'Make sure you are visiting this app in Google Chrome on your Android device.',
    },
    {
      icon: '⋮',
      title: 'Tap the Menu',
      desc: 'Tap the three-dot (⋮) menu in the top-right corner of Chrome.',
    },
    {
      icon: '📲',
      title: 'Add to Home Screen',
      desc: 'Select "Add to Home screen" from the dropdown and tap "Add".',
    },
    {
      icon: '✅',
      title: 'Launch from Home',
      desc: 'The Crisis Respond India app icon will appear on your home screen. Open it like any native app!',
    },
  ];

  const iosSteps = [
    {
      icon: '🧭',
      title: 'Open in Safari',
      desc: 'This PWA can only be installed from Safari browser on iPhone or iPad.',
    },
    {
      icon: '⬆️',
      title: 'Tap Share',
      desc: 'Tap the Share icon (⬆) at the bottom of your Safari screen.',
    },
    {
      icon: '➕',
      title: 'Add to Home Screen',
      desc: 'Scroll down and tap "Add to Home Screen" from the share sheet.',
    },
    {
      icon: '✅',
      title: 'Confirm & Launch',
      desc: 'Tap "Add" in the top-right corner. The app icon will appear on your Home Screen!',
    },
  ];

  const desktopSteps = [
    {
      icon: '🖥️',
      title: 'Open in Chrome or Edge',
      desc: 'Open this app in Google Chrome or Microsoft Edge on your computer.',
    },
    {
      icon: '⬇️',
      title: 'Click Install Button',
      desc: 'Look for the Install icon (⊕) in the browser address bar on the right side.',
    },
    {
      icon: '✅',
      title: 'Confirm Install',
      desc: 'Click "Install" in the confirmation dialog. The app will open as a standalone window.',
    },
  ];

  const currentSteps = activeTab === 'android' ? androidSteps : activeTab === 'ios' ? iosSteps : desktopSteps;

  return (
    <div className="install-modal-backdrop" onClick={onClose} role="dialog" aria-modal="true" aria-label="Install App">
      <div className="install-modal" onClick={(e) => e.stopPropagation()}>

        {/* Header */}
        <div className="install-modal-header">
          <div className="install-modal-brand">
            <img src="/logo.png" alt="App Logo" className="install-modal-logo" />
            <div>
              <h2 className="install-modal-title">Install Crisis Respond India</h2>
              <p className="install-modal-tagline">Add to your home screen for offline access & instant emergency dispatch</p>
            </div>
          </div>
          <button className="install-modal-close" onClick={onClose} aria-label="Close">
            <X size={20} />
          </button>
        </div>

        {/* OS Tabs */}
        <div className="install-os-tabs">
          <button
            className={`install-os-tab ${activeTab === 'android' ? 'active' : ''}`}
            onClick={() => setActiveTab('android')}
          >
            <span className="install-os-icon">🤖</span>
            Android
          </button>
          <button
            className={`install-os-tab ${activeTab === 'ios' ? 'active' : ''}`}
            onClick={() => setActiveTab('ios')}
          >
            <span className="install-os-icon"></span>
            iPhone / iPad
          </button>
          <button
            className={`install-os-tab ${activeTab === 'desktop' ? 'active' : ''}`}
            onClick={() => setActiveTab('desktop')}
          >
            <span className="install-os-icon">💻</span>
            Desktop
          </button>
        </div>

        {/* Steps */}
        <div className="install-steps-list">
          {currentSteps.map((step, idx) => (
            <div key={idx} className="install-step">
              <div className="install-step-num">{idx + 1}</div>
              <div className="install-step-icon">{step.icon}</div>
              <div className="install-step-body">
                <span className="install-step-title">{step.title}</span>
                <span className="install-step-desc">{step.desc}</span>
              </div>
            </div>
          ))}
        </div>

        {/* CTA Button */}
        <div className="install-modal-footer">
          {installed ? (
            <div className="install-success-banner">
              <CheckCircle size={18} />
              App installed successfully! Launching…
            </div>
          ) : (
            <>
              {deferredPrompt && activeTab === 'android' ? (
                <button className="install-cta-btn" onClick={handleNativeInstall}>
                  <Download size={18} />
                  Install Now (One-Tap)
                </button>
              ) : (
                <div className="install-manual-note">
                  {activeTab === 'ios'
                    ? '📌 On iOS, follow the Safari steps above — Apple does not allow direct install prompts from web.'
                    : '📌 Follow the steps above to add the app to your home screen or desktop.'}
                </div>
              )}
              <button className="install-close-link" onClick={onClose}>
                Maybe later
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default InstallModal;
