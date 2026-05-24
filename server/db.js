import sqlite3 from 'sqlite3';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const dbPath = path.join(__dirname, 'crisis_response.sqlite');

const db = new sqlite3.Database(dbPath, (err) => {
  if (err) {
    console.error('Error opening database:', err.message);
  } else {
    console.log('Connected to the SQLite database.');
    initializeDatabase();
  }
});

function initializeDatabase() {
  db.serialize(() => {
    // 1. Create reports table
    db.run(`
      CREATE TABLE IF NOT EXISTS reports (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        latitude REAL NOT NULL,
        longitude REAL NOT NULL,
        timestamp TEXT NOT NULL,
        image_url TEXT,
        road_status TEXT NOT NULL, /* TOTAL_BLOCKAGE, PARTIAL_BLOCKAGE, NO_BLOCKAGE */
        intensity TEXT NOT NULL,   /* CATASTROPHIC, SEVERE, MODERATE, MINOR, HAZARD */
        deceased_count INTEGER DEFAULT 0,
        immediate_count INTEGER DEFAULT 0, /* Triage Red */
        delayed_count INTEGER DEFAULT 0,   /* Triage Yellow */
        minimal_count INTEGER DEFAULT 0,   /* Triage Green */
        description TEXT,
        reporter_name TEXT
      )
    `);

    // 2. Create crash_feed table
    db.run(`
      CREATE TABLE IF NOT EXISTS crash_feed (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_name TEXT NOT NULL,
        description TEXT NOT NULL,
        media_url TEXT,
        media_type TEXT, /* 'image' | 'video' | 'none' */
        latitude REAL,
        longitude REAL,
        timestamp TEXT NOT NULL
      )
    `);

    // 3. Create emergency_facilities table for nearby help calculations
    db.run(`
      CREATE TABLE IF NOT EXISTS emergency_facilities (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        type TEXT NOT NULL, /* 'hospital' | 'police' | 'crane' | 'fire' */
        latitude REAL NOT NULL,
        longitude REAL NOT NULL,
        address TEXT,
        phone TEXT NOT NULL
      )
    `, () => {
      seedInitialData();
    });
  });
}

function seedInitialData() {
  // Check if reports are already seeded
  db.get("SELECT COUNT(*) as count FROM reports", (err, row) => {
    if (err) return;
    if (row.count === 0) {
      console.log('Seeding initial reports...');
      
      const sampleReports = [
        {
          latitude: 28.4595,
          longitude: 77.0266,
          timestamp: new Date(Date.now() - 30 * 60 * 1000).toISOString(), // 30 mins ago
          image_url: null,
          road_status: 'PARTIAL_BLOCKAGE',
          intensity: 'SEVERE',
          deceased_count: 0,
          immediate_count: 2,
          delayed_count: 1,
          minimal_count: 1,
          description: 'Multi-vehicle collision on NH-48 near IFFCO Chowk, Gurugram. Heavy traffic pileup. Emergency crane requested.',
          reporter_name: 'Amit Sharma'
        },
        {
          latitude: 19.1136,
          longitude: 72.8696,
          timestamp: new Date(Date.now() - 120 * 60 * 1000).toISOString(), // 2 hours ago
          image_url: null,
          road_status: 'TOTAL_BLOCKAGE',
          intensity: 'CATASTROPHIC',
          deceased_count: 1,
          immediate_count: 3,
          delayed_count: 4,
          minimal_count: 2,
          description: 'Major oil tanker leakage and collision on Western Express Highway, Mumbai. Road fully closed by traffic police. Avoid route.',
          reporter_name: 'Rajesh Patil'
        },
        {
          latitude: 12.9845,
          longitude: 77.7490,
          timestamp: new Date(Date.now() - 10 * 60 * 1000).toISOString(), // 10 mins ago
          image_url: null,
          road_status: 'NO_BLOCKAGE',
          intensity: 'HAZARD',
          deceased_count: 0,
          immediate_count: 0,
          delayed_count: 0,
          minimal_count: 0,
          description: 'Large cargo box fell from truck on ITPL Main Rd near Whitefield, Bengaluru. Obstructing left lane. Drive with caution.',
          reporter_name: 'Suresh Kumar'
        }
      ];

      const stmt = db.prepare(`
        INSERT INTO reports (latitude, longitude, timestamp, image_url, road_status, intensity, deceased_count, immediate_count, delayed_count, minimal_count, description, reporter_name)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);

      sampleReports.forEach(r => {
        stmt.run(r.latitude, r.longitude, r.timestamp, r.image_url, r.road_status, r.intensity, r.deceased_count, r.immediate_count, r.delayed_count, r.minimal_count, r.description, r.reporter_name);
      });
      stmt.finalize();
    }
  });

  // Check if crash_feed is already seeded
  db.get("SELECT COUNT(*) as count FROM crash_feed", (err, row) => {
    if (err) return;
    if (row.count === 0) {
      console.log('Seeding initial crash feed...');
      
      const sampleFeed = [
        {
          user_name: 'Rahul K.',
          description: 'Just passed the Gurugram toll gate, traffic is moving extremely slowly. Saw two tow trucks heading towards IFFCO chowk. Hope everyone is safe!',
          media_url: null,
          media_type: 'none',
          latitude: 28.5020,
          longitude: 77.0884,
          timestamp: new Date(Date.now() - 15 * 60 * 1000).toISOString()
        },
        {
          user_name: 'Neha Sen',
          description: 'Huge oil spill on Western Express Highway. Bike riders please be very careful near Jogeshwari flyover! Extremely slippery.',
          media_url: null,
          media_type: 'none',
          latitude: 19.1351,
          longitude: 72.8596,
          timestamp: new Date(Date.now() - 45 * 60 * 1000).toISOString()
        }
      ];

      const stmt = db.prepare(`
        INSERT INTO crash_feed (user_name, description, media_url, media_type, latitude, longitude, timestamp)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `);

      sampleFeed.forEach(f => {
        stmt.run(f.user_name, f.description, f.media_url, f.media_type, f.latitude, f.longitude, f.timestamp);
      });
      stmt.finalize();
    }
  });

  // Check if emergency_facilities are already seeded
  db.get("SELECT COUNT(*) as count FROM emergency_facilities", (err, row) => {
    if (err) return;
    if (row.count === 0) {
      console.log('Seeding initial emergency facilities...');
      
      const sampleFacilities = [
        // Delhi / Gurugram
        { name: 'Medanta - The Medicity', type: 'hospital', latitude: 28.4312, longitude: 77.0421, address: 'CH Baktawar Singh Road, Sector 38, Gurugram, Haryana', phone: '+91-124-4141414' },
        { name: 'Max Super Speciality Hospital', type: 'hospital', latitude: 28.5284, longitude: 77.2115, address: 'Saket, New Delhi', phone: '+91-11-26515050' },
        { name: 'Sadar Police Station Gurugram', type: 'police', latitude: 28.4332, longitude: 77.0401, address: 'Sadar, Gurugram, Haryana', phone: '+91-124-2320100' },
        { name: 'Vasant Kunj Police Station', type: 'police', latitude: 28.5385, longitude: 77.1610, address: 'Vasant Kunj, New Delhi', phone: '+91-11-26891000' },
        { name: 'Gurugram NH-48 Heavy Tow & Recovery Service', type: 'crane', latitude: 28.4550, longitude: 77.0310, address: 'Sector 31, Gurugram', phone: '+91-9871100223' },
        
        // Mumbai
        { name: 'Kokilaben Dhirubhai Ambani Hospital', type: 'hospital', latitude: 19.1311, longitude: 72.8252, address: 'Rao Saheb Achutrao Patwardhan Marg, Four Bungalows, Andheri West, Mumbai', phone: '+91-22-30999999' },
        { name: 'Nanavati Super Speciality Hospital', type: 'hospital', latitude: 19.0967, longitude: 72.8407, address: 'S.V. Road, Vile Parle West, Mumbai', phone: '+91-22-26267500' },
        { name: 'Jogeshwari Police Station', type: 'police', latitude: 19.1355, longitude: 72.8530, address: 'Jogeshwari East, Mumbai', phone: '+91-22-28224555' },
        { name: 'Western Express Towing Services', type: 'crane', latitude: 19.1105, longitude: 72.8680, address: 'Andheri East, Mumbai', phone: '+91-9820011223' },

        // Bengaluru
        { name: 'Manipal Hospital Whitefield', type: 'hospital', latitude: 12.9880, longitude: 77.7289, address: 'ITPL Main Rd, Whitefield, Bengaluru', phone: '+91-80-40476000' },
        { name: 'Whitefield Police Station', type: 'police', latitude: 12.9710, longitude: 77.7475, address: 'Whitefield Main Rd, Bengaluru', phone: '+91-80-22942634' },
        { name: 'Whitefield Towing and Crane Depot', type: 'crane', latitude: 12.9810, longitude: 77.7550, address: 'ITPL Area, Bengaluru', phone: '+91-9988223344' }
      ];

      const stmt = db.prepare(`
        INSERT INTO emergency_facilities (name, type, latitude, longitude, address, phone)
        VALUES (?, ?, ?, ?, ?, ?)
      `);

      sampleFacilities.forEach(f => {
        stmt.run(f.name, f.type, f.latitude, f.longitude, f.address, f.phone);
      });
      stmt.finalize();
    }
  });
}

export default db;
export { db };
