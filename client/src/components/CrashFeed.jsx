import React, { useState, useEffect } from 'react';
import { Image, Video, MapPin, Send, MessageSquare, Heart, Clock, Navigation } from 'lucide-react';

const CrashFeed = () => {
  const [feedItems, setFeedItems] = useState([]);
  const [userName, setUserName] = useState('');
  const [description, setDescription] = useState('');
  const [mediaFile, setMediaFile] = useState(null);
  const [mediaPreview, setMediaPreview] = useState(null);
  const [attachGPS, setAttachGPS] = useState(true);
  const [coords, setCoords] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  const fetchFeed = async () => {
    try {
      setIsLoading(true);
      const res = await fetch('http://localhost:5001/api/crash-feed');
      const data = await res.json();
      setFeedItems(data);
    } catch (err) {
      console.error('Error loading feed:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchFeed();
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          setCoords({ lat: pos.coords.latitude, lng: pos.coords.longitude });
        },
        (err) => console.log('Location access denied for feed geotagging.')
      );
    }
  }, []);

  const handleMediaChange = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    setMediaFile(file);
    const reader = new FileReader();
    reader.onloadend = () => {
      setMediaPreview(reader.result);
    };
    reader.readAsDataURL(file);
  };

  const handlePostSubmit = async (e) => {
    e.preventDefault();
    if (!userName.trim() || !description.trim()) return;

    setIsSubmitting(true);
    const formData = new FormData();
    formData.append('user_name', userName);
    formData.append('description', description);
    
    if (attachGPS && coords) {
      formData.append('latitude', coords.lat);
      formData.append('longitude', coords.lng);
    }

    if (mediaFile) {
      formData.append('media', mediaFile);
    }

    try {
      const res = await fetch('http://localhost:5001/api/crash-feed', {
        method: 'POST',
        body: formData
      });

      if (!res.ok) throw new Error('Failed to post update');

      // Reset form
      setDescription('');
      setMediaFile(null);
      setMediaPreview(null);
      fetchFeed();
    } catch (err) {
      console.error('Error posting update:', err);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="feed-container">
      {/* Compose Update Card */}
      <div className="glass-card compose-card">
        <h4 className="card-title">
          <MessageSquare size={18} />
          Share Highway Status / Feed Update
        </h4>
        <form onSubmit={handlePostSubmit}>
          <div className="compose-fields">
            <input 
              type="text" 
              placeholder="Your name or vehicle number..." 
              value={userName}
              onChange={(e) => setUserName(e.target.value)}
              className="compose-name-input"
              required
            />
            <textarea 
              placeholder="What did you witness? Mention road blockage, lane details, collision impact..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="compose-desc-input"
              rows="3"
              required
            />
          </div>

          {mediaPreview && (
            <div className="compose-preview-container">
              {mediaFile?.type.startsWith('video') ? (
                <video src={mediaPreview} className="compose-preview" controls />
              ) : (
                <img src={mediaPreview} alt="Compose attachment preview" className="compose-preview" />
              )}
              <button 
                type="button" 
                className="remove-preview-btn"
                onClick={() => {
                  setMediaFile(null);
                  setMediaPreview(null);
                }}
              >
                Remove Media
              </button>
            </div>
          )}

          <div className="compose-toolbar">
            <div className="toolbar-options">
              <input 
                type="file" 
                id="feed-media-file" 
                accept="image/*,video/*"
                onChange={handleMediaChange}
                style={{ display: 'none' }}
              />
              <label htmlFor="feed-media-file" className="toolbar-btn">
                <Image size={16} />
                <span>Add Photo/Video</span>
              </label>

              {coords && (
                <label className="gps-attach-checkbox">
                  <input 
                    type="checkbox" 
                    checked={attachGPS} 
                    onChange={(e) => setAttachGPS(e.target.checked)}
                  />
                  <MapPin size={14} />
                  <span>Attach Location ({coords.lat.toFixed(4)}, {coords.lng.toFixed(4)})</span>
                </label>
              )}
            </div>

            <button type="submit" className="btn btn-primary btn-submit-feed" disabled={isSubmitting}>
              {isSubmitting ? 'Posting...' : 'Share Update'}
              <Send size={14} />
            </button>
          </div>
        </form>
      </div>

      {/* Feed List */}
      <div className="feed-list">
        {isLoading ? (
          <div className="feed-empty-state">Loading social dispatch feed...</div>
        ) : feedItems.length === 0 ? (
          <div className="feed-empty-state">No highway dispatches yet. Be the first to share!</div>
        ) : (
          feedItems.map(item => (
            <div key={item.id} className="glass-card feed-card">
              <div className="feed-card-header">
                <div className="user-avatar-group">
                  <div className="user-avatar">{(item.user_name || 'A').charAt(0).toUpperCase()}</div>
                  <div className="user-meta">
                    <span className="user-name">{item.user_name}</span>
                    <span className="post-time">
                      <Clock size={12} />
                      {new Date(item.timestamp).toLocaleString('en-IN')}
                    </span>
                  </div>
                </div>
                {item.latitude && item.longitude && (
                  <a 
                    href={`https://www.google.com/maps/search/?api=1&query=${item.latitude},${item.longitude}`}
                    target="_blank"
                    rel="noreferrer"
                    className="feed-geo-tag"
                  >
                    <Navigation size={12} />
                    <span>{item.latitude.toFixed(4)}, {item.longitude.toFixed(4)}</span>
                  </a>
                )}
              </div>

              <p className="feed-description">{item.description}</p>

              {item.media_url && (
                <div className="feed-media-container">
                  {item.media_type === 'video' ? (
                    <video 
                      src={`http://localhost:5001${item.media_url}`} 
                      className="feed-media" 
                      controls 
                      muted 
                    />
                  ) : (
                    <img 
                      src={`http://localhost:5001${item.media_url}`} 
                      alt="Crash social media upload" 
                      className="feed-media" 
                    />
                  )}
                </div>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
};

export default CrashFeed;
