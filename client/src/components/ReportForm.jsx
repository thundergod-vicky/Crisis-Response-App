import React, { useState, useEffect } from 'react';
import { MapPin, Navigation, Camera, Upload, AlertCircle, RefreshCw } from 'lucide-react';

const ReportForm = ({ prefilledCoords, onSuccess, onCancel }) => {
  const [latitude, setLatitude] = useState('');
  const [longitude, setLongitude] = useState('');
  const [roadStatus, setRoadStatus] = useState('PARTIAL_BLOCKAGE');
  const [intensity, setIntensity] = useState('SEVERE');
  
  // Triage count fields
  const [deceasedCount, setDeceasedCount] = useState(0);
  const [immediateCount, setImmediateCount] = useState(0);
  const [delayedCount, setDelayedCount] = useState(0);
  const [minimalCount, setMinimalCount] = useState(0);
  
  const [description, setDescription] = useState('');
  const [reporterName, setReporterName] = useState('');
  const [mediaFile, setMediaFile] = useState(null);
  const [mediaPreview, setMediaPreview] = useState(null);
  
  const [isLocating, setIsLocating] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  // Handle coordinates from map click
  useEffect(() => {
    if (prefilledCoords) {
      setLatitude(prefilledCoords.lat.toFixed(6));
      setLongitude(prefilledCoords.lng.toFixed(6));
    } else {
      detectLocation();
    }
  }, [prefilledCoords]);

  const detectLocation = () => {
    if (!navigator.geolocation) {
      setErrorMsg('Geolocation is not supported by your browser.');
      return;
    }

    setIsLocating(true);
    setErrorMsg('');
    
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setLatitude(position.coords.latitude.toFixed(6));
        setLongitude(position.coords.longitude.toFixed(6));
        setIsLocating(false);
      },
      (err) => {
        console.error(err);
        setErrorMsg('Unable to retrieve GPS location. You can enter coordinates manually.');
        setIsLocating(false);
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  };

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    setMediaFile(file);
    const reader = new FileReader();
    reader.onloadend = () => {
      setMediaPreview(reader.result);
    };
    reader.readAsDataURL(file);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!latitude || !longitude) {
      setErrorMsg('Latitude and Longitude coordinates are required.');
      return;
    }

    setIsSubmitting(true);
    setErrorMsg('');

    const formData = new FormData();
    formData.append('latitude', latitude);
    formData.append('longitude', longitude);
    formData.append('road_status', roadStatus);
    formData.append('intensity', intensity);
    formData.append('deceased_count', deceasedCount);
    formData.append('immediate_count', immediateCount);
    formData.append('delayed_count', delayedCount);
    formData.append('minimal_count', minimalCount);
    formData.append('description', description);
    formData.append('reporter_name', reporterName);
    
    if (mediaFile) {
      formData.append('media', mediaFile);
    }

    try {
      const res = await fetch('http://localhost:5001/api/reports', {
        method: 'POST',
        body: formData
      });

      if (!res.ok) {
        throw new Error('Failed to submit incident report');
      }

      onSuccess();
    } catch (err) {
      console.error(err);
      setErrorMsg(err.message || 'Error submitting report. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <form className="report-form" onSubmit={handleSubmit}>
      {errorMsg && (
        <div className="form-error-banner">
          <AlertCircle size={16} />
          <span>{errorMsg}</span>
        </div>
      )}

      {/* Geolocation Section */}
      <div className="form-section">
        <label className="section-label">Incident Geotag (India Grid)</label>
        <div className="gps-input-row">
          <div className="input-field">
            <label htmlFor="latitude">Latitude</label>
            <input 
              type="number" 
              step="any" 
              id="latitude"
              value={latitude} 
              onChange={(e) => setLatitude(e.target.value)} 
              placeholder="e.g. 28.5355" 
              required
            />
          </div>
          <div className="input-field">
            <label htmlFor="longitude">Longitude</label>
            <input 
              type="number" 
              step="any" 
              id="longitude"
              value={longitude} 
              onChange={(e) => setLongitude(e.target.value)} 
              placeholder="e.g. 77.2090" 
              required
            />
          </div>
          <button 
            type="button" 
            className="gps-fetch-btn" 
            onClick={detectLocation}
            disabled={isLocating}
          >
            {isLocating ? <RefreshCw className="animate-spin" size={16} /> : <Navigation size={16} />}
            <span>GPS</span>
          </button>
        </div>
      </div>

      {/* Road Blockage & Intensity */}
      <div className="form-section grid-2">
        <div className="input-field">
          <label htmlFor="roadStatus">Road Blockage Level</label>
          <select 
            id="roadStatus"
            value={roadStatus} 
            onChange={(e) => setRoadStatus(e.target.value)}
          >
            <option value="NO_BLOCKAGE">Clear / Free Flowing</option>
            <option value="PARTIAL_BLOCKAGE">Partially Blocked (One Lane Open)</option>
            <option value="TOTAL_BLOCKAGE">Total Blockage (Road Closed)</option>
          </select>
        </div>
        <div className="input-field">
          <label htmlFor="intensity">Incident Scale</label>
          <select 
            id="intensity"
            value={intensity} 
            onChange={(e) => setIntensity(e.target.value)}
          >
            <option value="HAZARD">Hazard Only (Debris / Slip)</option>
            <option value="MINOR">Minor Collision (Level 2)</option>
            <option value="MODERATE">Moderate Collision (Level 3)</option>
            <option value="SEVERE">Severe Crash (Level 4)</option>
            <option value="CATASTROPHIC">Catastrophic Crash (Level 5)</option>
          </select>
        </div>
      </div>

      {/* Professional Triage Counts */}
      <div className="form-section">
        <label className="section-label">Victim Triage Classification (Counts)</label>
        <div className="triage-input-grid">
          <div className="triage-input-card triage-card-black">
            <label htmlFor="deceasedCount">Deceased (Black)</label>
            <input 
              type="number" 
              id="deceasedCount"
              min="0" 
              value={deceasedCount} 
              onChange={(e) => setDeceasedCount(Math.max(0, parseInt(e.target.value) || 0))}
            />
          </div>
          <div className="triage-input-card triage-card-red">
            <label htmlFor="immediateCount">Immediate (Red)</label>
            <input 
              type="number" 
              id="immediateCount"
              min="0" 
              value={immediateCount} 
              onChange={(e) => setImmediateCount(Math.max(0, parseInt(e.target.value) || 0))}
            />
          </div>
          <div className="triage-input-card triage-card-yellow">
            <label htmlFor="delayedCount">Delayed (Yellow)</label>
            <input 
              type="number" 
              id="delayedCount"
              min="0" 
              value={delayedCount} 
              onChange={(e) => setDelayedCount(Math.max(0, parseInt(e.target.value) || 0))}
            />
          </div>
          <div className="triage-input-card triage-card-green">
            <label htmlFor="minimalCount">Minimal (Green)</label>
            <input 
              type="number" 
              id="minimalCount"
              min="0" 
              value={minimalCount} 
              onChange={(e) => setMinimalCount(Math.max(0, parseInt(e.target.value) || 0))}
            />
          </div>
        </div>
      </div>

      {/* Media Upload */}
      <div className="form-section">
        <label className="section-label">Attach Accident Scene Media (Photo / Video)</label>
        <div className="media-upload-area">
          <input 
            type="file" 
            accept="image/*,video/*" 
            id="file-upload" 
            onChange={handleFileChange}
            style={{ display: 'none' }}
          />
          <label htmlFor="file-upload" className="media-upload-label">
            {mediaPreview ? (
              <div className="file-preview-wrapper">
                {mediaFile?.type.startsWith('video') ? (
                  <video src={mediaPreview} className="upload-preview" muted />
                ) : (
                  <img src={mediaPreview} alt="Preview" className="upload-preview" />
                )}
                <div className="change-media-overlay">
                  <Camera size={20} />
                  <span>Change Attachment</span>
                </div>
              </div>
            ) : (
              <div className="upload-instructions">
                <Upload size={32} />
                <span>Upload Incident Photo/Video (Max 50MB)</span>
              </div>
            )}
          </label>
        </div>
      </div>

      {/* Description & Reporter Name */}
      <div className="form-section">
        <div className="input-field">
          <label htmlFor="description">Accident Scene Description</label>
          <textarea 
            id="description"
            rows="3"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Describe vehicles involved, specific highway landmarks, trapped passenger details..."
            required
          />
        </div>
        <div className="input-field">
          <label htmlFor="reporterName">Your Name (Optional)</label>
          <input 
            type="text" 
            id="reporterName"
            value={reporterName} 
            onChange={(e) => setReporterName(e.target.value)}
            placeholder="e.g. Bystander, NH-48 Motorist" 
          />
        </div>
      </div>

      <div className="form-actions">
        {onCancel && (
          <button type="button" className="btn btn-cancel" onClick={onCancel}>
            Cancel
          </button>
        )}
        <button type="submit" className="btn btn-submit" disabled={isSubmitting}>
          {isSubmitting ? 'Submitting Triage Dispatch...' : 'Dispatch Emergency Net'}
        </button>
      </div>
    </form>
  );
};

export default ReportForm;
