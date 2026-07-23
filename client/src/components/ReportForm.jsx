import React, { useState, useEffect } from 'react';
import { MapPin, Navigation, Camera, Upload, AlertCircle, RefreshCw } from 'lucide-react';
import { supabase } from '../supabase';

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

    try {
      let imageUrl = null;
      if (mediaFile) {
        const fileExt = mediaFile.name.split('.').pop();
        const filePath = `reports/${Date.now()}-${Math.random().toString(36).substring(2, 7)}.${fileExt}`;
        const { data: uploadData, error: uploadError } = await supabase.storage
          .from('crisis-media')
          .upload(filePath, mediaFile);

        if (uploadError) {
          console.warn('Storage upload error (verify crisis-media public bucket exists):', uploadError.message);
        } else if (uploadData) {
          const { data: urlData } = supabase.storage.from('crisis-media').getPublicUrl(uploadData.path);
          imageUrl = urlData?.publicUrl || null;
        }
      }

      const { error: dbError } = await supabase.from('reports').insert([
        {
          latitude: parseFloat(latitude),
          longitude: parseFloat(longitude),
          timestamp: new Date().toISOString(),
          image_url: imageUrl,
          road_status: roadStatus,
          intensity: intensity,
          deceased_count: parseInt(deceasedCount || 0, 10),
          immediate_count: parseInt(immediateCount || 0, 10),
          delayed_count: parseInt(delayedCount || 0, 10),
          minimal_count: parseInt(minimalCount || 0, 10),
          description: description || '',
          reporter_name: reporterName || 'Anonymous bystander'
        }
      ]);

      if (dbError) {
        throw new Error(dbError.message);
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
