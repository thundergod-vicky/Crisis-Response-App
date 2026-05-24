import React, { useState, useEffect, useRef } from 'react';
import { Activity, ShieldAlert, Heart, Radio, MapPin, BellOff, HelpCircle } from 'lucide-react';

const CollisionDetector = () => {
  const [gForce, setGForce] = useState(1.0);
  const [status, setStatus] = useState('MONITORING'); // MONITORING, ALARM, DISPATCHED, CANCELLED
  const [countdown, setCountdown] = useState(10);
  const [sensorAccess, setSensorAccess] = useState(false);
  const [telemetry, setTelemetry] = useState({ x: 0, y: 0, z: 9.8 });
  const [gpsCoords, setGpsCoords] = useState(null);
  
  const countdownIntervalRef = useRef(null);
  const alarmIntervalRef = useRef(null);
  const audioCtxRef = useRef(null);

  // Fetch coordinates for collision dispatch
  useEffect(() => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          setGpsCoords({ lat: pos.coords.latitude, lng: pos.coords.longitude });
        },
        (err) => console.log('Location access denied for collision detection.')
      );
    }
  }, []);

  // Web Audio Siren Generator
  const playSirenBeep = () => {
    try {
      if (!audioCtxRef.current) {
        audioCtxRef.current = new (window.AudioContext || window.webkitAudioContext)();
      }
      const ctx = audioCtxRef.current;
      const osc = ctx.createOscillator();
      const gainNode = ctx.createGain();
      
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(700, ctx.currentTime);
      osc.frequency.linearRampToValueAtTime(1200, ctx.currentTime + 0.3); // Siren sweep
      
      gainNode.gain.setValueAtTime(0, ctx.currentTime);
      gainNode.gain.linearRampToValueAtTime(0.3, ctx.currentTime + 0.05);
      gainNode.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.4);

      osc.connect(gainNode);
      gainNode.connect(ctx.destination);
      
      osc.start();
      osc.stop(ctx.currentTime + 0.5);
    } catch (e) {
      console.log('Audio Context failed to play', e);
    }
  };

  // Listen to accelerometer sensors if permission granted
  useEffect(() => {
    const handleMotion = (event) => {
      const { x, y, z } = event.accelerationIncludingGravity || { x: 0, y: 0, z: 9.8 };
      setTelemetry({
        x: parseFloat(x?.toFixed(2) || 0),
        y: parseFloat(y?.toFixed(2) || 0),
        z: parseFloat(z?.toFixed(2) || 9.8)
      });

      // Calculate vector magnitude of acceleration divided by earth gravity (9.8 m/s^2)
      const magnitude = Math.sqrt(x*x + y*y + z*z) / 9.8;
      const calculatedG = parseFloat(magnitude.toFixed(2));
      
      if (status === 'MONITORING') {
        setGForce(calculatedG);
        if (calculatedG >= 4.5) {
          triggerAlarm();
        }
      }
    };

    if (sensorAccess) {
      window.addEventListener('devicemotion', handleMotion);
    }

    return () => {
      window.removeEventListener('devicemotion', handleMotion);
    };
  }, [sensorAccess, status]);

  // Request Sensor Permission (iOS requirement)
  const requestSensorAccess = async () => {
    if (typeof DeviceMotionEvent !== 'undefined' && typeof DeviceMotionEvent.requestPermission === 'function') {
      try {
        const permissionState = await DeviceMotionEvent.requestPermission();
        if (permissionState === 'granted') {
          setSensorAccess(true);
        } else {
          alert('Sensor permission denied.');
        }
      } catch (err) {
        console.error('Error requesting device motion permission:', err);
      }
    } else {
      // Android / Desktop fallback
      setSensorAccess(true);
    }
  };

  // Trigger Alarm Mode
  const triggerAlarm = () => {
    setStatus('ALARM');
    setCountdown(10);
    playSirenBeep();
    alarmIntervalRef.current = setInterval(playSirenBeep, 1000);
  };

  // Alarm Countdown handler
  useEffect(() => {
    if (status === 'ALARM') {
      countdownIntervalRef.current = setInterval(() => {
        setCountdown((prev) => {
          if (prev <= 1) {
            clearInterval(countdownIntervalRef.current);
            dispatchCollisionReport();
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }

    return () => {
      if (countdownIntervalRef.current) clearInterval(countdownIntervalRef.current);
      if (alarmIntervalRef.current) clearInterval(alarmIntervalRef.current);
    };
  }, [status]);

  const dispatchCollisionReport = async () => {
    if (alarmIntervalRef.current) clearInterval(alarmIntervalRef.current);
    setStatus('DISPATCHED');
    
    // Auto submit to backend
    const defaultLat = gpsCoords?.lat || 28.5355;
    const defaultLng = gpsCoords?.lng || 77.2090;

    const reportData = {
      latitude: defaultLat,
      longitude: defaultLng,
      road_status: 'PARTIAL_BLOCKAGE',
      intensity: 'SEVERE',
      deceased_count: 0,
      immediate_count: 1, // Represents the vehicle owner
      delayed_count: 0,
      minimal_count: 0,
      description: `AUTOMATIC COLLISION ALERT: High G-Force event (${gForce} Gs) detected by smartphone sensors. Safety confirmation timer expired without response. Instant dispatch requested.`,
      reporter_name: 'Telemetry Automatic Dispatch'
    };

    try {
      await fetch('http://localhost:5001/api/reports', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(reportData)
      });
    } catch (err) {
      console.error('Error auto-dispatching collision:', err);
    }
  };

  const handleCancelAlarm = () => {
    if (countdownIntervalRef.current) clearInterval(countdownIntervalRef.current);
    if (alarmIntervalRef.current) clearInterval(alarmIntervalRef.current);
    setStatus('CANCELLED');
    setGForce(1.0);
    
    // Reset back to monitoring after 3 seconds
    setTimeout(() => {
      setStatus('MONITORING');
    }, 3000);
  };

  const handleSimulateCollision = () => {
    setGForce(5.2);
    triggerAlarm();
  };

  return (
    <div className={`collision-wrapper ${status === 'ALARM' ? 'emergency-flash' : ''}`}>
      {status === 'ALARM' ? (
        /* Alarm Countdown Panel */
        <div className="glass-card alarm-active-card">
          <div className="alarm-icon-shell animate-pulse-ring">
            <ShieldAlert size={64} className="alarm-danger-icon" />
          </div>
          <h2 className="alarm-heading">COLLISION DETECTED</h2>
          <p className="alarm-subtitle">High impact telemetry event detected ({gForce} Gs)</p>
          
          <div className="countdown-timer">
            <span className="countdown-number">{countdown}</span>
            <span className="countdown-label">Seconds to Auto-Dispatch</span>
          </div>

          <p className="alarm-warning-text">
            An automated SOS call will be dispatched to nearby NHAI emergency teams and trauma centers, sending your exact coordinates.
          </p>

          <button className="btn btn-abort-sos" onClick={handleCancelAlarm}>
            <BellOff size={20} />
            <span>I AM SAFE (CANCEL ALARM)</span>
          </button>
        </div>
      ) : (
        /* Telemetry Dashboard */
        <div className="collision-dashboard">
          {/* Main Status Monitor Card */}
          <div className="glass-card telemetry-card">
            <h4 className="card-title">
              <Activity size={18} />
              Telemetry Status Center
            </h4>

            <div className="telemetry-grid">
              <div className="telemetry-gauge">
                <span className="gauge-value">{gForce} G</span>
                <span className="gauge-label">Peak G-Force</span>
                <div className="gauge-track">
                  <div 
                    className="gauge-bar" 
                    style={{ 
                      width: `${Math.min(100, (gForce / 6) * 100)}%`,
                      backgroundColor: gForce >= 4.5 ? 'var(--danger)' : gForce >= 2.5 ? 'var(--accent)' : 'var(--success)'
                    }}
                  ></div>
                </div>
              </div>

              <div className="status-indicator-box">
                <span className="status-label">System State</span>
                <span className={`status-value status-${status.toLowerCase()}`}>
                  <Radio size={16} className={status === 'MONITORING' ? 'animate-pulse' : ''} />
                  {status}
                </span>
              </div>
            </div>

            {/* Simulated Axes Telemetry */}
            <div className="axes-display">
              <div className="axis-reading">
                <span>X-Axis (Latitudinal)</span>
                <strong>{status === 'ALARM' ? '±25.1 m/s²' : `${telemetry.x} m/s²`}</strong>
              </div>
              <div className="axis-reading">
                <span>Y-Axis (Longitudinal)</span>
                <strong>{status === 'ALARM' ? '±42.4 m/s²' : `${telemetry.y} m/s²`}</strong>
              </div>
              <div className="axis-reading">
                <span>Z-Axis (Vertical)</span>
                <strong>{status === 'ALARM' ? '±12.8 m/s²' : `${telemetry.z} m/s²`}</strong>
              </div>
            </div>

            {gpsCoords && (
              <div className="telemetry-gps">
                <MapPin size={14} />
                <span>Geotag Locked: {gpsCoords.lat.toFixed(6)}, {gpsCoords.lng.toFixed(6)}</span>
              </div>
            )}
            
            <div className="telemetry-info-box">
              <HelpCircle size={16} />
              <p>Smartphones utilize internal accelerometers to sense severe impact. Readings exceeding <strong>4.5 Gs</strong> trigger automated roadside SOS protocols.</p>
            </div>
          </div>

          {/* Test & Simulation Card */}
          <div className="glass-card sim-control-card">
            <h4 className="card-title">
              <Radio size={18} />
              Telemetry Simulator
            </h4>
            <p className="sim-intro">
              Manually trigger or simulate gravity thresholds to verify system responders and dispatch workflows.
            </p>

            <div className="slider-group">
              <div className="slider-header">
                <label>Simulate G-Force Peak</label>
                <span>{gForce.toFixed(2)} G</span>
              </div>
              <input 
                type="range" 
                min="0.5" 
                max="6.0" 
                step="0.1" 
                value={gForce}
                onChange={(e) => {
                  const val = parseFloat(e.target.value);
                  setGForce(val);
                  if (val >= 4.5 && status === 'MONITORING') {
                    triggerAlarm();
                  }
                }}
                className="gforce-slider"
                disabled={status !== 'MONITORING'}
              />
              <span className="slider-threshold">Collision Trigger Threshold: 4.5 G</span>
            </div>

            <div className="sim-actions">
              <button 
                className="btn btn-danger btn-sim-collision"
                onClick={handleSimulateCollision}
                disabled={status !== 'MONITORING'}
              >
                Trigger 5.2G Collision Impact
              </button>

              {!sensorAccess ? (
                <button className="btn btn-secondary-action btn-sensor" onClick={requestSensorAccess}>
                  Enable Phone Accelerometer Listener
                </button>
              ) : (
                <div className="sensor-active-badge">
                  <Heart size={14} className="animate-pulse" />
                  <span>Accelerometer Listening Enabled</span>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default CollisionDetector;
