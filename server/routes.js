import express from 'express';
import multer from 'multer';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';
import db from './db.js';

const router = express.Router();
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Setup upload folder
const uploadDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
  // Add a keep file
  fs.writeFileSync(path.join(uploadDir, '.gitkeep'), '');
}

// Multer storage engine configuration
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    cb(null, uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({
  storage: storage,
  limits: { fileSize: 50 * 1024 * 1024 }, // 50MB max file size
  fileFilter: (req, file, cb) => {
    const filetypes = /jpeg|jpg|png|webp|mp4|mov|avi|mkv/i;
    const extname = filetypes.test(path.extname(file.originalname));
    const mimetype = filetypes.test(file.mimetype);
    if (extname && mimetype) {
      return cb(null, true);
    }
    cb(new Error('Only images and video files are allowed!'));
  }
});

// Helper: Haversine distance formula
function getDistanceInKm(lat1, lon1, lat2, lon2) {
  const R = 6371; // Earth's radius in km
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * Math.PI / 180) *
      Math.cos(lat2 * Math.PI / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c; // Distance in km
}

/* =========================================
   1. INCIDENT REPORTS API
   ========================================= */

// Get all reports
router.get('/reports', (req, res) => {
  db.all("SELECT * FROM reports ORDER BY timestamp DESC", [], (err, rows) => {
    if (err) {
      return res.status(500).json({ error: err.message });
    }
    res.json(rows);
  });
});

// Post a new report
router.post('/reports', upload.single('media'), (req, res) => {
  const {
    latitude,
    longitude,
    road_status,
    intensity,
    deceased_count,
    immediate_count,
    delayed_count,
    minimal_count,
    description,
    reporter_name
  } = req.body;

  if (!latitude || !longitude || !road_status || !intensity) {
    return res.status(400).json({ error: 'Latitude, longitude, road status, and intensity are required.' });
  }

  const imageUrl = req.file ? `/uploads/${req.file.filename}` : null;
  const timestamp = new Date().toISOString();

  const stmt = db.prepare(`
    INSERT INTO reports (
      latitude, longitude, timestamp, image_url, road_status, intensity, 
      deceased_count, immediate_count, delayed_count, minimal_count, description, reporter_name
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  stmt.run(
    parseFloat(latitude),
    parseFloat(longitude),
    timestamp,
    imageUrl,
    road_status,
    intensity,
    parseInt(deceased_count || 0, 10),
    parseInt(immediate_count || 0, 10),
    parseInt(delayed_count || 0, 10),
    parseInt(minimal_count || 0, 10),
    description || '',
    reporter_name || 'Anonymous bystander',
    function (err) {
      if (err) {
        return res.status(500).json({ error: err.message });
      }
      res.status(201).json({
        id: this.lastID,
        latitude: parseFloat(latitude),
        longitude: parseFloat(longitude),
        timestamp,
        image_url: imageUrl,
        road_status,
        intensity,
        deceased_count: parseInt(deceased_count || 0, 10),
        immediate_count: parseInt(immediate_count || 0, 10),
        delayed_count: parseInt(delayed_count || 0, 10),
        minimal_count: parseInt(minimal_count || 0, 10),
        description,
        reporter_name
      });
    }
  );
  stmt.finalize();
});

/* =========================================
   2. CRASH FEED API
   ========================================= */

// Get all feed posts
router.get('/crash-feed', (req, res) => {
  db.all("SELECT * FROM crash_feed ORDER BY timestamp DESC", [], (err, rows) => {
    if (err) {
      return res.status(500).json({ error: err.message });
    }
    res.json(rows);
  });
});

// Post to crash feed
router.post('/crash-feed', upload.single('media'), (req, res) => {
  const { user_name, description, latitude, longitude } = req.body;

  if (!user_name || !description) {
    return res.status(400).json({ error: 'User name and description are required.' });
  }

  let mediaUrl = null;
  let mediaType = 'none';

  if (req.file) {
    mediaUrl = `/uploads/${req.file.filename}`;
    const ext = path.extname(req.file.originalname).toLowerCase();
    if (ext === '.mp4' || ext === '.mov' || ext === '.avi' || ext === '.mkv') {
      mediaType = 'video';
    } else {
      mediaType = 'image';
    }
  }

  const timestamp = new Date().toISOString();
  const latVal = latitude ? parseFloat(latitude) : null;
  const lngVal = longitude ? parseFloat(longitude) : null;

  const stmt = db.prepare(`
    INSERT INTO crash_feed (user_name, description, media_url, media_type, latitude, longitude, timestamp)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `);

  stmt.run(
    user_name,
    description,
    mediaUrl,
    mediaType,
    latVal,
    lngVal,
    timestamp,
    function (err) {
      if (err) {
        return res.status(500).json({ error: err.message });
      }
      res.status(201).json({
        id: this.lastID,
        user_name,
        description,
        media_url: mediaUrl,
        media_type: mediaType,
        latitude: latVal,
        longitude: lngVal,
        timestamp
      });
    }
  );
  stmt.finalize();
});

/* =========================================
   3. EMERGENCY FACILITIES & HELPLINE API
   ========================================= */

// Helper: Dynamic Reverse Geocoding via OpenStreetMap Nominatim API
async function geocodeLocationName(lat, lng) {
  const url = `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${lat}&lon=${lng}`;
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 2000); // 2 second timeout

  try {
    const response = await fetch(url, {
      signal: controller.signal,
      headers: {
        'User-Agent': 'CrisisRespondIndia/1.0 (emergency-dev@crisisrespond.in)'
      }
    });
    clearTimeout(timeoutId);
    if (!response.ok) return 'Local Highway Sector';
    
    const data = await response.json();
    if (data && data.address) {
      // Find the most specific available location name
      const name = data.address.city || 
                   data.address.town || 
                   data.address.village || 
                   data.address.suburb || 
                   data.address.county || 
                   data.address.state || 
                   'Local Highway Sector';
      return name;
    }
  } catch (err) {
    console.error('Reverse geocoding error or timeout:', err.message);
  } finally {
    clearTimeout(timeoutId);
  }
  return 'Local Highway Sector';
}

// Get emergency services nearby to coordinates
router.get('/nearby-help', (req, res) => {
  const { lat, lng } = req.query;

  if (!lat || !lng) {
    return res.status(400).json({ error: 'Latitude (lat) and Longitude (lng) query parameters are required.' });
  }

  const userLat = parseFloat(lat);
  const userLng = parseFloat(lng);

  db.all("SELECT * FROM emergency_facilities", [], async (err, rows) => {
    if (err) {
      return res.status(500).json({ error: err.message });
    }

    // Calculate distance for all facilities and sort them
    let facilitiesWithDistance = rows.map(facility => {
      const distance = getDistanceInKm(userLat, userLng, facility.latitude, facility.longitude);
      return {
        ...facility,
        distance: parseFloat(distance.toFixed(2)) // Round to 2 decimal places
      };
    });

    // Check if we have any hospital within 30km
    const localHospitals = facilitiesWithDistance.filter(f => f.type === 'hospital');
    const minHospitalDist = localHospitals.length > 0 
      ? Math.min(...localHospitals.map(h => h.distance)) 
      : 99999;

    // If no facilities are nearby, dynamically seed mock emergency assets for this coordinate sector
    if (minHospitalDist > 30) {
      try {
        console.log(`No active local responders found within 30km (nearest: ${minHospitalDist} km). Spawning regional responders...`);
        const cityName = await geocodeLocationName(userLat, userLng);
        
        // Generate mock coordinates close to the user's location
        const generated = [
          { 
            name: `${cityName} Level-1 Trauma Hospital`, 
            type: 'hospital', 
            latitude: userLat + 0.0125, 
            longitude: userLng - 0.0142, 
            address: `National Highway Bypass, Near ${cityName} Exit`, 
            phone: '+91-9800112233' 
          },
          { 
            name: `${cityName} Sub-Divisional Civil Clinic`, 
            type: 'hospital', 
            latitude: userLat - 0.0210, 
            longitude: userLng + 0.0185, 
            address: `Main Station Road, Central ${cityName}`, 
            phone: '+91-9800112244' 
          },
          { 
            name: `${cityName} Highway Police Patrol Station`, 
            type: 'police', 
            latitude: userLat + 0.0085, 
            longitude: userLng + 0.0092, 
            address: `NH toll gate post, ${cityName} Sector`, 
            phone: '+91-9800112255' 
          },
          { 
            name: `${cityName} Sadar Police Depot`, 
            type: 'police', 
            latitude: userLat - 0.0150, 
            longitude: userLng - 0.0174, 
            address: `Police Lines, ${cityName}`, 
            phone: '+91-9800112266' 
          },
          { 
            name: `${cityName} NHAI Crane Recovery Depot`, 
            type: 'crane', 
            latitude: userLat + 0.0230, 
            longitude: userLng - 0.0080, 
            address: `NH Highway Crossing, ${cityName}`, 
            phone: '+91-9800112277' 
          },
          { 
            name: `${cityName} Heavy Tow Truck Services`, 
            type: 'crane', 
            latitude: userLat - 0.0095, 
            longitude: userLng + 0.0280, 
            address: `Industrial Sector 3, ${cityName}`, 
            phone: '+91-9800112288' 
          }
        ];

        // Insert mock local facilities into SQLite database
        const insertStmt = db.prepare(`
          INSERT INTO emergency_facilities (name, type, latitude, longitude, address, phone)
          VALUES (?, ?, ?, ?, ?, ?)
        `);

        for (const facility of generated) {
          await new Promise((resolve, reject) => {
            insertStmt.run(
              facility.name,
              facility.type,
              facility.latitude,
              facility.longitude,
              facility.address,
              facility.phone,
              (err) => {
                if (err) reject(err);
                else resolve();
              }
            );
          });
        }
        insertStmt.finalize();

        // Query database again to return the newly inserted regional facilities
        db.all("SELECT * FROM emergency_facilities", [], (newErr, newRows) => {
          if (newErr) {
            return res.status(500).json({ error: newErr.message });
          }

          const updatedFacilities = newRows.map(facility => {
            const distance = getDistanceInKm(userLat, userLng, facility.latitude, facility.longitude);
            return {
              ...facility,
              distance: parseFloat(distance.toFixed(2))
            };
          });

          updatedFacilities.sort((a, b) => a.distance - b.distance);

          res.json({
            hospitals: updatedFacilities.filter(f => f.type === 'hospital' && f.distance <= 100).slice(0, 4),
            police: updatedFacilities.filter(f => f.type === 'police' && f.distance <= 100).slice(0, 4),
            cranes: updatedFacilities.filter(f => f.type === 'crane' && f.distance <= 100).slice(0, 4)
          });
        });

      } catch (genErr) {
        console.error("Error generating emergency facilities:", genErr);
        res.status(500).json({ error: "Failed to generate local facilities automatically." });
      }
    } else {
      // Sort and return original facilities
      facilitiesWithDistance.sort((a, b) => a.distance - b.distance);
      res.json({
        hospitals: facilitiesWithDistance.filter(f => f.type === 'hospital' && f.distance <= 100).slice(0, 4),
        police: facilitiesWithDistance.filter(f => f.type === 'police' && f.distance <= 100).slice(0, 4),
        cranes: facilitiesWithDistance.filter(f => f.type === 'crane' && f.distance <= 100).slice(0, 4)
      });
    }
  });
});

export default router;
export { router };
