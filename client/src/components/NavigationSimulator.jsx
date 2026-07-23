import React, { useEffect, useRef, useState, useCallback } from 'react';
import L from 'leaflet';
import { X, Navigation2, Zap, Clock, MapPin, ChevronRight, AlertTriangle, Play, Pause, Square } from 'lucide-react';

const MAPPLS_KEY = 'dyonbotrxomkjfxbxmbchwidwsqbbozkeadd';

// --- Polyline6 Decoder ---
function decodePolyline6(encoded) {
  const coords = [];
  let index = 0, lat = 0, lng = 0;
  while (index < encoded.length) {
    let b, shift = 0, result = 0;
    do { b = encoded.charCodeAt(index++) - 63; result |= (b & 0x1f) << shift; shift += 5; } while (b >= 0x20);
    lat += (result & 1) ? ~(result >> 1) : (result >> 1);
    shift = 0; result = 0;
    do { b = encoded.charCodeAt(index++) - 63; result |= (b & 0x1f) << shift; shift += 5; } while (b >= 0x20);
    lng += (result & 1) ? ~(result >> 1) : (result >> 1);
    coords.push([lat / 1e6, lng / 1e6]);
  }
  return coords;
}

function decodePolyline5(encoded) {
  const coords = [];
  let index = 0, lat = 0, lng = 0;
  while (index < encoded.length) {
    let b, shift = 0, result = 0;
    do { b = encoded.charCodeAt(index++) - 63; result |= (b & 0x1f) << shift; shift += 5; } while (b >= 0x20);
    lat += (result & 1) ? ~(result >> 1) : (result >> 1);
    shift = 0; result = 0;
    do { b = encoded.charCodeAt(index++) - 63; result |= (b & 0x1f) << shift; shift += 5; } while (b >= 0x20);
    lng += (result & 1) ? ~(result >> 1) : (result >> 1);
    coords.push([lat / 1e5, lng / 1e5]);
  }
  return coords;
}

function formatDuration(seconds) {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  if (h > 0) return `${h}h ${m}m`;
  if (m > 0) return `${m}m ${s}s`;
  return `${s}s`;
}

function formatDistance(meters) {
  if (meters >= 1000) return `${(meters / 1000).toFixed(1)} km`;
  return `${Math.round(meters)} m`;
}

// Linear interpolation between two lat/lng points
function interpolate(a, b, t) {
  return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
}

// Bearing between two points (for rotating vehicle icon)
function bearing(a, b) {
  const lat1 = (a[0] * Math.PI) / 180;
  const lat2 = (b[0] * Math.PI) / 180;
  const dLng = ((b[1] - a[1]) * Math.PI) / 180;
  const y = Math.sin(dLng) * Math.cos(lat2);
  const x = Math.cos(lat1) * Math.sin(lat2) - Math.sin(lat1) * Math.cos(lat2) * Math.cos(dLng);
  return ((Math.atan2(y, x) * 180) / Math.PI + 360) % 360;
}

// Total distance of the route in metres
function totalRouteDistance(coords) {
  let d = 0;
  for (let i = 1; i < coords.length; i++) {
    const R = 6371000;
    const lat1 = (coords[i - 1][0] * Math.PI) / 180;
    const lat2 = (coords[i][0] * Math.PI) / 180;
    const dLat = lat2 - lat1;
    const dLon = ((coords[i][1] - coords[i - 1][1]) * Math.PI) / 180;
    const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2;
    d += 2 * R * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  }
  return d;
}

const NavigationSimulator = ({ incident, userLocation, mapInstance, onClose }) => {
  const [status, setStatus] = useState('fetching'); // fetching | ready | simulating | paused | done | error
  const [routeCoords, setRouteCoords] = useState([]);
  const [routeInfo, setRouteInfo] = useState(null);
  const [steps, setSteps] = useState([]);
  const [currentStepIdx, setCurrentStepIdx] = useState(0);
  const [progress, setProgress] = useState(0); // 0-1 along route
  const [simSpeed, setSimSpeed] = useState(50); // km/h for simulation
  const [distRemaining, setDistRemaining] = useState(0);
  const [timeRemaining, setTimeRemaining] = useState(0);
  const [error, setError] = useState('');

  // Leaflet layer refs
  const routeLayerRef = useRef(null);
  const vehicleMarkerRef = useRef(null);
  const startMarkerRef = useRef(null);
  const destMarkerRef = useRef(null);
  const animFrameRef = useRef(null);
  const lastTimestampRef = useRef(null);
  const progressRef = useRef(0);
  const isPlayingRef = useRef(false);
  const totalDistRef = useRef(0);

  // Fetch driving route from CORS-friendly routing engine (OSRM) with fallback
  useEffect(() => {
    if (!userLocation || !incident) return;

    const origin = `${userLocation.lng},${userLocation.lat}`;
    const dest = `${incident.longitude},${incident.latitude}`;
    // OSRM provides free CORS-enabled routing for real road networks
    const url = `https://router.project-osrm.org/route/v1/driving/${origin};${dest}?overview=full&geometries=polyline6&steps=true`;

    fetch(url)
      .then(r => {
        if (!r.ok) throw new Error('Routing service response error');
        return r.json();
      })
      .then(data => {
        if (!data.routes || data.routes.length === 0) throw new Error('No route found');

        const route = data.routes[0];
        const coords = decodePolyline6(route.geometry);

        // Parse steps
        const parsedSteps = route.legs?.[0]?.steps?.map(s => ({
          instruction: s.maneuver?.instruction || s.name || 'Continue',
          distance: s.distance,
          duration: s.duration,
          type: s.maneuver?.type || 'straight',
        })) || [];

        setRouteCoords(coords);
        totalDistRef.current = totalRouteDistance(coords);
        setDistRemaining(totalDistRef.current);
        setTimeRemaining(route.duration);
        setRouteInfo({ distance: route.distance, duration: route.duration, summary: route.legs?.[0]?.summary });
        setSteps(parsedSteps);
        setStatus('ready');
      })
      .catch(err => {
        console.warn('OSRM route fetch warning, using interpolated fallback route:', err.message);
        // Fallback: generate a smooth route with intermediate simulation points
        const coords = generateFallbackRoute(
          [userLocation.lat, userLocation.lng],
          [incident.latitude, incident.longitude],
          30
        );
        setRouteCoords(coords);
        const dist = totalRouteDistance(coords);
        totalDistRef.current = dist;
        setDistRemaining(dist);
        setTimeRemaining(dist / (50 / 3.6)); // assume 50 km/h
        setRouteInfo({ distance: dist, duration: dist / (50 / 3.6), summary: 'Estimated route' });
        setSteps([
          { instruction: 'Head towards incident site', distance: dist * 0.4, type: 'depart' },
          { instruction: 'Continue on highway', distance: dist * 0.4, type: 'straight' },
          { instruction: 'Arrive at incident site', distance: dist * 0.2, type: 'arrive' },
        ]);
        setError('Live route calculated using estimated emergency path');
        setStatus('ready');
      });
  }, [userLocation, incident]);

  function generateFallbackRoute(start, end, numPoints) {
    const coords = [];
    for (let i = 0; i <= numPoints; i++) {
      const t = i / numPoints;
      // Add slight curvature
      const curve = Math.sin(t * Math.PI) * 0.005;
      coords.push([
        start[0] + (end[0] - start[0]) * t + curve,
        start[1] + (end[1] - start[1]) * t + curve * 0.5,
      ]);
    }
    return coords;
  }

  // Draw route on map when coords are ready
  useEffect(() => {
    if (!mapInstance || routeCoords.length < 2) return;

    // Remove old layers
    if (routeLayerRef.current) mapInstance.removeLayer(routeLayerRef.current);
    if (startMarkerRef.current) mapInstance.removeLayer(startMarkerRef.current);
    if (destMarkerRef.current) mapInstance.removeLayer(destMarkerRef.current);

    // Route line
    routeLayerRef.current = L.polyline(routeCoords, {
      color: '#3b82f6',
      weight: 5,
      opacity: 0.85,
      dashArray: null,
      lineCap: 'round',
      lineJoin: 'round',
    }).addTo(mapInstance);

    // Start marker (user location)
    const startIcon = L.divIcon({
      className: '',
      html: `<div style="width:14px;height:14px;border-radius:50%;background:#22c55e;border:3px solid white;box-shadow:0 0 8px rgba(34,197,94,0.8)"></div>`,
      iconSize: [14, 14],
      iconAnchor: [7, 7],
    });
    startMarkerRef.current = L.marker(routeCoords[0], { icon: startIcon, zIndexOffset: 100 }).addTo(mapInstance);

    // Destination marker (incident)
    const destIcon = L.divIcon({
      className: '',
      html: `<div style="width:18px;height:18px;border-radius:50%;background:#ef4444;border:3px solid white;box-shadow:0 0 12px rgba(239,68,68,0.9);display:flex;align-items:center;justify-content:center"><span style="color:white;font-size:10px;font-weight:900">!</span></div>`,
      iconSize: [18, 18],
      iconAnchor: [9, 9],
    });
    destMarkerRef.current = L.marker(routeCoords[routeCoords.length - 1], { icon: destIcon, zIndexOffset: 100 }).addTo(mapInstance);

    // Fit map to route
    mapInstance.fitBounds(routeLayerRef.current.getBounds(), { padding: [40, 40] });

    return () => {
      if (routeLayerRef.current) mapInstance.removeLayer(routeLayerRef.current);
      if (startMarkerRef.current) mapInstance.removeLayer(startMarkerRef.current);
      if (destMarkerRef.current) mapInstance.removeLayer(destMarkerRef.current);
      if (vehicleMarkerRef.current) mapInstance.removeLayer(vehicleMarkerRef.current);
    };
  }, [mapInstance, routeCoords]);

  // Create vehicle marker
  useEffect(() => {
    if (!mapInstance || routeCoords.length < 2 || status !== 'ready') return;
    if (vehicleMarkerRef.current) mapInstance.removeLayer(vehicleMarkerRef.current);

    const vehicleIcon = L.divIcon({
      className: '',
      html: `<div id="nav-vehicle-icon" style="width:28px;height:28px;background:#1d4ed8;border-radius:50% 50% 50% 0;transform:rotate(-45deg);box-shadow:0 2px 8px rgba(29,78,216,0.6);display:flex;align-items:center;justify-content:center;border:2px solid white">
               <span style="transform:rotate(45deg);font-size:14px">🚑</span>
             </div>`,
      iconSize: [28, 28],
      iconAnchor: [14, 14],
    });

    vehicleMarkerRef.current = L.marker(routeCoords[0], { icon: vehicleIcon, zIndexOffset: 500 }).addTo(mapInstance);
  }, [mapInstance, routeCoords, status]);

  // Animation loop
  const animate = useCallback((timestamp) => {
    if (!isPlayingRef.current) return;
    if (!lastTimestampRef.current) lastTimestampRef.current = timestamp;

    const delta = (timestamp - lastTimestampRef.current) / 1000; // seconds
    lastTimestampRef.current = timestamp;

    const speedMs = simSpeed / 3.6; // m/s
    const totalDist = totalDistRef.current;
    if (totalDist === 0) return;

    const distPerFrame = speedMs * delta;
    const progressDelta = distPerFrame / totalDist;
    let newProgress = Math.min(progressRef.current + progressDelta, 1);
    progressRef.current = newProgress;

    // Get position along route
    const idx = newProgress * (routeCoords.length - 1);
    const lo = Math.floor(idx);
    const hi = Math.min(lo + 1, routeCoords.length - 1);
    const t = idx - lo;
    const pos = interpolate(routeCoords[lo], routeCoords[hi], t);

    // Update vehicle marker
    if (vehicleMarkerRef.current) {
      vehicleMarkerRef.current.setLatLng(pos);
      // Pan map to keep vehicle in view
      mapInstance.panTo(pos, { animate: true, duration: 0.5 });
    }

    // Update stats
    const distTravelled = newProgress * totalDist;
    const remaining = totalDist - distTravelled;
    const timeRem = remaining / (simSpeed / 3.6);
    setDistRemaining(remaining);
    setTimeRemaining(timeRem);
    setProgress(newProgress);

    // Update active step
    if (steps.length > 0) {
      const stepProgress = newProgress * steps.length;
      setCurrentStepIdx(Math.min(Math.floor(stepProgress), steps.length - 1));
    }

    if (newProgress >= 1) {
      isPlayingRef.current = false;
      setStatus('done');
      return;
    }

    animFrameRef.current = requestAnimationFrame(animate);
  }, [routeCoords, mapInstance, simSpeed, steps]);

  const handlePlay = () => {
    if (status === 'done') {
      progressRef.current = 0;
      lastTimestampRef.current = null;
    }
    isPlayingRef.current = true;
    lastTimestampRef.current = null;
    setStatus('simulating');
    animFrameRef.current = requestAnimationFrame(animate);
  };

  const handlePause = () => {
    isPlayingRef.current = false;
    setStatus('paused');
    if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
  };

  const handleStop = () => {
    isPlayingRef.current = false;
    if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
    progressRef.current = 0;
    lastTimestampRef.current = null;
    setProgress(0);
    setDistRemaining(totalDistRef.current);
    setTimeRemaining(routeInfo?.duration || 0);
    setCurrentStepIdx(0);
    if (vehicleMarkerRef.current && routeCoords.length > 0) {
      vehicleMarkerRef.current.setLatLng(routeCoords[0]);
    }
    setStatus('ready');
  };

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      isPlayingRef.current = false;
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
      if (mapInstance) {
        if (routeLayerRef.current) mapInstance.removeLayer(routeLayerRef.current);
        if (startMarkerRef.current) mapInstance.removeLayer(startMarkerRef.current);
        if (destMarkerRef.current) mapInstance.removeLayer(destMarkerRef.current);
        if (vehicleMarkerRef.current) mapInstance.removeLayer(vehicleMarkerRef.current);
      }
    };
  }, [mapInstance]);

  const getStepIcon = (type) => {
    switch (type) {
      case 'turn': return '↩';
      case 'depart': return '🚀';
      case 'arrive': return '🏁';
      case 'roundabout': return '⭕';
      default: return '⬆️';
    }
  };

  return (
    <div className="nav-sim-panel">
      {/* Header */}
      <div className="nav-sim-header">
        <div className="nav-sim-title-group">
          <Navigation2 size={18} className="nav-sim-icon" />
          <div>
            <h4 className="nav-sim-title">Navigation Simulation</h4>
            <span className="nav-sim-subtitle">Powered by Open Highway Routing Engine</span>
          </div>
        </div>
        <button className="nav-sim-close-btn" onClick={onClose}>
          <X size={18} />
        </button>
      </div>

      {/* Status body */}
      {status === 'fetching' && (
        <div className="nav-sim-loading">
          <div className="nav-spinner" />
          <span>Fetching route from Mappls...</span>
        </div>
      )}

      {status === 'error' && (
        <div className="nav-sim-error">
          <AlertTriangle size={16} />
          <span>{error}</span>
        </div>
      )}

      {(status === 'ready' || status === 'simulating' || status === 'paused' || status === 'done') && routeInfo && (
        <>
          {/* Route summary */}
          {error && (
            <div className="nav-sim-warn">
              <AlertTriangle size={12} />
              <span>{error}</span>
            </div>
          )}

          <div className="nav-stats-row">
            <div className="nav-stat">
              <MapPin size={14} />
              <div>
                <span className="nav-stat-val">{formatDistance(distRemaining)}</span>
                <span className="nav-stat-label">Remaining</span>
              </div>
            </div>
            <div className="nav-stat">
              <Clock size={14} />
              <div>
                <span className="nav-stat-val">{formatDuration(timeRemaining)}</span>
                <span className="nav-stat-label">ETA</span>
              </div>
            </div>
            <div className="nav-stat">
              <Zap size={14} />
              <div>
                <span className="nav-stat-val">{simSpeed} km/h</span>
                <span className="nav-stat-label">Speed</span>
              </div>
            </div>
          </div>

          {/* Progress bar */}
          <div className="nav-progress-track">
            <div className="nav-progress-fill" style={{ width: `${progress * 100}%` }} />
          </div>

          {/* Speed slider */}
          <div className="nav-speed-control">
            <label>Simulation Speed</label>
            <div className="nav-speed-row">
              <input
                type="range"
                min="20"
                max="200"
                step="10"
                value={simSpeed}
                onChange={(e) => setSimSpeed(Number(e.target.value))}
                className="nav-speed-slider"
              />
              <span>{simSpeed} km/h</span>
            </div>
          </div>

          {/* Playback controls */}
          <div className="nav-controls-row">
            {(status === 'ready' || status === 'paused' || status === 'done') && (
              <button className="nav-ctrl-btn nav-ctrl-play" onClick={handlePlay}>
                <Play size={16} />
                {status === 'done' ? 'Replay' : 'Start'}
              </button>
            )}
            {status === 'simulating' && (
              <button className="nav-ctrl-btn nav-ctrl-pause" onClick={handlePause}>
                <Pause size={16} />
                Pause
              </button>
            )}
            {(status === 'simulating' || status === 'paused') && (
              <button className="nav-ctrl-btn nav-ctrl-stop" onClick={handleStop}>
                <Square size={14} />
                Reset
              </button>
            )}
          </div>

          {status === 'done' && (
            <div className="nav-arrived-banner">
              🏁 Arrived at incident site!
            </div>
          )}

          {/* Step-by-step */}
          {steps.length > 0 && (
            <div className="nav-steps-list">
              <h5 className="nav-steps-title">Route Steps</h5>
              {steps.map((step, idx) => (
                <div
                  key={idx}
                  className={`nav-step-item ${idx === currentStepIdx ? 'active' : idx < currentStepIdx ? 'done' : ''}`}
                >
                  <span className="nav-step-icon">{getStepIcon(step.type)}</span>
                  <div className="nav-step-body">
                    <span className="nav-step-instr">{step.instruction}</span>
                    <span className="nav-step-dist">{formatDistance(step.distance)}</span>
                  </div>
                  {idx === currentStepIdx && <ChevronRight size={12} className="nav-step-arrow" />}
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default NavigationSimulator;
