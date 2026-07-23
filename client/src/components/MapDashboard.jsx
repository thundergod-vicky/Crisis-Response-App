import React, { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { AlertCircle, Clock, Navigation, MapPin, Eye, Filter, Plus, ChevronRight, X } from 'lucide-react';
import ReportForm from './ReportForm';
import NavigationSimulator from './NavigationSimulator';
import { supabase } from '../supabase';

const getReportImageSrc = (url) => {
  if (!url) return '';
  if (url.startsWith('http://') || url.startsWith('https://') || url.startsWith('data:')) {
    return url;
  }
  return `http://localhost:5001${url}`;
};

// Helper to get triage colors
const getTriageColor = (status) => {
  switch (status?.toUpperCase()) {
    case 'BLACK': return 'var(--triage-black)';
    case 'RED': return 'var(--triage-red)';
    case 'YELLOW': return 'var(--triage-yellow)';
    case 'GREEN': return 'var(--triage-green)';
    default: return 'var(--accent)';
  }
};

// Helper for human-readable road status
const getRoadStatusText = (status) => {
  switch (status) {
    case 'TOTAL_BLOCKAGE': return 'Road Blocked';
    case 'PARTIAL_BLOCKAGE': return 'Partially Blocked';
    case 'NO_BLOCKAGE': return 'Clear / Normal';
    default: return status;
  }
};

const MapDashboard = () => {
  const [reports, setReports] = useState([]);
  const [selectedReport, setSelectedReport] = useState(null);
  const [filterBlockage, setFilterBlockage] = useState('ALL');
  const [filterTriage, setFilterTriage] = useState('ALL');
  const [isReportDrawerOpen, setIsReportDrawerOpen] = useState(false);
  const [clickedCoords, setClickedCoords] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [userLocation, setUserLocation] = useState(null);
  const [isNavOpen, setIsNavOpen] = useState(false);

  const mapRef = useRef(null);
  const mapInstanceRef = useRef(null);
  const markersRef = useRef([]);

  const fetchReports = async () => {
    try {
      setIsLoading(true);
      const { data, error } = await supabase
        .from('reports')
        .select('*')
        .order('timestamp', { ascending: false });

      if (error) {
        console.error('Error fetching reports from Supabase:', error.message);
      } else {
        setReports(data || []);
      }
    } catch (err) {
      console.error('Error fetching reports:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchReports();

    // Subscribe to realtime changes on reports table
    const reportsChannel = supabase
      .channel('public:reports')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'reports' },
        () => {
          fetchReports();
        }
      )
      .subscribe();

    // Query user geolocation on mount
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          setUserLocation({
            lat: position.coords.latitude,
            lng: position.coords.longitude
          });
        },
        (error) => {
          console.warn('Geolocation denied or unavailable. Falling back to simulated nearby responder starting point.', error);
        },
        { enableHighAccuracy: true, timeout: 8000 }
      );
    }

    return () => {
      supabase.removeChannel(reportsChannel);
    };
  }, []);

  // Helper to calculate distance in km between two coords
  const getDistanceKm = (lat1, lon1, lat2, lon2) => {
    const R = 6371; // Earth's radius in km
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = 
      Math.sin(dLat/2) * Math.sin(dLat/2) +
      Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * 
      Math.sin(dLon/2) * Math.sin(dLon/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    return R * c;
  };

  // Resolve starting location for simulation
  const getSimulationStartLocation = () => {
    if (!selectedReport) return null;
    
    // Check if we have userLocation and if it is within 100km of the incident
    if (userLocation) {
      const dist = getDistanceKm(
        userLocation.lat, userLocation.lng, 
        selectedReport.latitude, selectedReport.longitude
      );
      if (dist <= 100) {
        return userLocation;
      }
    }
    
    // Fallback: Generate a mock emergency responder vehicle location near the incident (5-8 km away)
    // to simulate a realistic highway dispatch route and prevent 1000+ km route lines
    return {
      lat: selectedReport.latitude - 0.04 - (Math.random() * 0.02),
      lng: selectedReport.longitude - 0.04 - (Math.random() * 0.02)
    };
  };

  // Initialize Map
  useEffect(() => {
    if (!mapRef.current) return;

    // Center on India by default
    const defaultCenter = [20.5937, 78.9629];
    const defaultZoom = 5;

    mapInstanceRef.current = L.map(mapRef.current, {
      center: defaultCenter,
      zoom: defaultZoom,
      zoomControl: false
    });

    // Add zoom control to top-right
    L.control.zoom({ position: 'topright' }).addTo(mapInstanceRef.current);

    // Standard OpenStreetMap tiles
    L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png', {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>',
      subdomains: 'abcd',
      maxZoom: 20
    }).addTo(mapInstanceRef.current);

    // Map click handler to trigger new report
    mapInstanceRef.current.on('click', (e) => {
      const { lat, lng } = e.latlng;
      setClickedCoords({ lat, lng });
      setIsReportDrawerOpen(true);
    });

    return () => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
    };
  }, []);

  // Sync Markers when reports or filters change
  useEffect(() => {
    if (!mapInstanceRef.current) return;

    // Clear existing markers
    markersRef.current.forEach(m => mapInstanceRef.current.removeLayer(m));
    markersRef.current = [];

    const filtered = reports.filter(report => {
      const matchesBlockage = filterBlockage === 'ALL' || report.road_status === filterBlockage;
      const matchesTriage = filterTriage === 'ALL' || 
        (filterTriage === 'BLACK' && report.deceased_count > 0) ||
        (filterTriage === 'RED' && report.immediate_count > 0 && report.deceased_count === 0) ||
        (filterTriage === 'YELLOW' && report.delayed_count > 0 && report.immediate_count === 0 && report.deceased_count === 0) ||
        (filterTriage === 'GREEN' && report.minimal_count > 0 && report.delayed_count === 0 && report.immediate_count === 0 && report.deceased_count === 0);
      
      return matchesBlockage && matchesTriage;
    });

    filtered.forEach(report => {
      // Determine primary triage color
      let primaryTriage = 'GREEN';
      if (report.deceased_count > 0) primaryTriage = 'BLACK';
      else if (report.immediate_count > 0) primaryTriage = 'RED';
      else if (report.delayed_count > 0) primaryTriage = 'YELLOW';

      const triageColor = getTriageColor(primaryTriage);
      const isBlocked = report.road_status === 'TOTAL_BLOCKAGE';

      // Create Custom Pulsing Marker
      const customIcon = L.divIcon({
        className: 'custom-gps-marker',
        html: `
          <div class="marker-pulse-wrapper">
            <div class="marker-pulse" style="background-color: ${triageColor}; animation-duration: ${isBlocked ? '1s' : '2.5s'}"></div>
            <div class="marker-dot" style="background-color: ${triageColor}">
              ${isBlocked ? '<div class="blockage-x">!</div>' : ''}
            </div>
          </div>
        `,
        iconSize: [30, 30],
        iconAnchor: [15, 15]
      });

      const marker = L.marker([report.latitude, report.longitude], { icon: customIcon })
        .addTo(mapInstanceRef.current)
        .on('click', () => {
          setSelectedReport(report);
          mapInstanceRef.current.setView([report.latitude, report.longitude], 12, { animate: true });
        });

      markersRef.current.push(marker);
    });

    // If there is a filtered item, center the map slightly to average or leave as is.
    if (filtered.length > 0 && !selectedReport) {
      // Don't auto center immediately unless user triggers it
    }

  }, [reports, filterBlockage, filterTriage]);

  const handleSelectReport = (report) => {
    setSelectedReport(report);
    if (mapInstanceRef.current) {
      mapInstanceRef.current.setView([report.latitude, report.longitude], 14, { animate: true });
    }
  };

  const handleCloseDetail = () => {
    setSelectedReport(null);
    setIsNavOpen(false);
  };

  const handleReportSuccess = () => {
    setIsReportDrawerOpen(false);
    setClickedCoords(null);
    fetchReports();
  };

  return (
    <div className="dashboard-grid">
      {/* Left: Map Area */}
      <div className="map-outer-container">
        <div ref={mapRef} style={{ width: '100%', height: '100%' }}></div>
        
        {/* Map Overlays (Quick instructions) */}
        <div className="map-instructions-overlay">
          <MapPin size={14} />
          <span>Click anywhere on the map to log an accident at that location</span>
        </div>

        {/* Floating Quick Action Button */}
        <button 
          className="map-floating-action-btn"
          onClick={() => {
            setClickedCoords(null);
            setIsReportDrawerOpen(true);
          }}
        >
          <Plus size={20} />
          <span>Report Highway Accident</span>
        </button>

        {/* Navigation Simulator Panel overlay */}
        {isNavOpen && selectedReport && (
          <NavigationSimulator
            incident={selectedReport}
            userLocation={getSimulationStartLocation()}
            mapInstance={mapInstanceRef.current}
            onClose={() => setIsNavOpen(false)}
          />
        )}
      </div>

      {/* Right: Info Panel & List */}
      <div className="dashboard-sidebar-container">
        {/* Filters Card */}
        <div className="glass-card filters-card">
          <div className="filter-header">
            <Filter size={16} />
            <h4>Active Incident Filters</h4>
          </div>
          <div className="filter-groups">
            <div className="filter-group">
              <label>Road Status</label>
              <select value={filterBlockage} onChange={(e) => setFilterBlockage(e.target.value)}>
                <option value="ALL">All States</option>
                <option value="TOTAL_BLOCKAGE">Total Blockage</option>
                <option value="PARTIAL_BLOCKAGE">Partial Blockage</option>
                <option value="NO_BLOCKAGE">Clear Road</option>
              </select>
            </div>
            <div className="filter-group">
              <label>Triage Priority</label>
              <select value={filterTriage} onChange={(e) => setFilterTriage(e.target.value)}>
                <option value="ALL">All Levels</option>
                <option value="BLACK">Black (Fatalities)</option>
                <option value="RED">Red (Critical Injuries)</option>
                <option value="YELLOW">Yellow (Serious Injuries)</option>
                <option value="GREEN">Green (Minor Injuries)</option>
              </select>
            </div>
          </div>
        </div>

        {/* Selected Incident Details Drawer / Card */}
        {selectedReport ? (
          <div className="glass-card active-detail-card emergency-flash-subtle">
            <div className="detail-header">
              <span className={`badge badge-blockage-${selectedReport.road_status.replace('_', '-').toLowerCase()}`}>
                {getRoadStatusText(selectedReport.road_status)}
              </span>
              <button className="close-detail-btn" onClick={handleCloseDetail}>
                <X size={18} />
              </button>
            </div>

            <h3 className="detail-title">NH Highway Incident</h3>
            <p className="detail-reporter">Reported by: <strong>{selectedReport.reporter_name}</strong></p>

            <div className="detail-stats-grid">
              <div className="stat-card" style={{ borderColor: 'var(--triage-black)' }}>
                <span className="stat-num">{selectedReport.deceased_count}</span>
                <span className="stat-label">Deceased (Black)</span>
              </div>
              <div className="stat-card" style={{ borderColor: 'var(--triage-red)' }}>
                <span className="stat-num">{selectedReport.immediate_count}</span>
                <span className="stat-label">Immediate (Red)</span>
              </div>
              <div className="stat-card" style={{ borderColor: 'var(--triage-yellow)' }}>
                <span className="stat-num">{selectedReport.delayed_count}</span>
                <span className="stat-label">Delayed (Yellow)</span>
              </div>
              <div className="stat-card" style={{ borderColor: 'var(--triage-green)' }}>
                <span className="stat-num">{selectedReport.minimal_count}</span>
                <span className="stat-label">Minimal (Green)</span>
              </div>
            </div>

            <div className="detail-meta">
              <div className="meta-item">
                <Clock size={14} />
                <span>{new Date(selectedReport.timestamp).toLocaleString('en-IN')}</span>
              </div>
              <div className="meta-item">
                <Navigation size={14} />
                <span>GPS: {selectedReport.latitude.toFixed(5)}, {selectedReport.longitude.toFixed(5)}</span>
              </div>
              <div className="meta-item">
                <AlertCircle size={14} />
                <span>Intensity: <strong>{selectedReport.intensity}</strong></span>
              </div>
            </div>

            <p className="detail-description">{selectedReport.description}</p>

            {selectedReport.image_url && (
              <div className="detail-image-container">
                <img 
                  src={getReportImageSrc(selectedReport.image_url)} 
                  alt="Accident scene report" 
                  className="detail-image"
                />
              </div>
            )}
            
            <div className="detail-actions">
              <button 
                onClick={() => setIsNavOpen(true)}
                className="btn btn-primary-action btn-navigate-sim"
              >
                ⚡ Simulate Route
              </button>
              <a 
                href={`https://www.google.com/maps/search/?api=1&query=${selectedReport.latitude},${selectedReport.longitude}`}
                target="_blank"
                rel="noreferrer"
                className="btn btn-secondary-action"
              >
                Google Maps
              </a>
            </div>
          </div>
        ) : (
          /* List of Incidents Card */
          <div className="glass-card list-card">
            <h4 className="sidebar-title">Active Highway Accidents ({reports.length})</h4>
            <div className="incident-list">
              {isLoading ? (
                <div className="list-empty-state">Loading active incidents...</div>
              ) : reports.length === 0 ? (
                <div className="list-empty-state">No incidents active on NH network.</div>
              ) : (
                reports.map(report => {
                  let topTriage = 'GREEN';
                  if (report.deceased_count > 0) topTriage = 'BLACK';
                  else if (report.immediate_count > 0) topTriage = 'RED';
                  else if (report.delayed_count > 0) topTriage = 'YELLOW';

                  return (
                    <div 
                      key={report.id} 
                      className="incident-item-card"
                      onClick={() => handleSelectReport(report)}
                      style={{ borderLeftColor: getTriageColor(topTriage) }}
                    >
                      <div className="incident-item-body">
                        <div className="item-header">
                          <span className="item-time">{new Date(report.timestamp).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}</span>
                          <span className={`badge badge-blockage-${report.road_status.replace('_', '-').toLowerCase()}`}>
                            {report.road_status === 'TOTAL_BLOCKAGE' ? 'Blocked' : report.road_status === 'PARTIAL_BLOCKAGE' ? 'Partial' : 'Clear'}
                          </span>
                        </div>
                        <p className="item-desc">{report.description.substring(0, 75)}...</p>
                        <div className="item-footer">
                          <span>GPS: {report.latitude.toFixed(4)}, {report.longitude.toFixed(4)}</span>
                          <ChevronRight size={14} />
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        )}
      </div>

      {/* Floating sliding drawer for Reporting Accidents */}
      {isReportDrawerOpen && (
        <div className="report-drawer-backdrop" onClick={() => setIsReportDrawerOpen(false)}>
          <div className="report-drawer-content" onClick={(e) => e.stopPropagation()}>
            <div className="drawer-header">
              <h3>Report Road Incident</h3>
              <button className="close-drawer-btn" onClick={() => setIsReportDrawerOpen(false)}>
                <X size={20} />
              </button>
            </div>
            <div className="drawer-body">
              <ReportForm 
                prefilledCoords={clickedCoords} 
                onSuccess={handleReportSuccess} 
                onCancel={() => setIsReportDrawerOpen(false)}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default MapDashboard;
