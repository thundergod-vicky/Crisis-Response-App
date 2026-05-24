# Crisis Response App (India)

A high-concurrency, real-time crisis response application designed specifically for roadside and highway accidents in India. Witnessing a disaster can now directly trigger life-saving actions through geo-triage alerts, emergency routing, and automated collision detection.

## Features

1.  **Real-Time Geo-Triage Map**: Pinpoint accident coordinates (latitude/longitude), road blockages (Clear, Partially Blocked, Fully Blocked), severity level, and casualty/injury counts using professional triage terms (Deceased, Immediate, Delayed, Minimal).
2.  **Emergency Hub (India)**: Interactive panel showing click-to-call numbers for key services (NHAI 1033, NDRF 1078, Ambulance 108, National Emergency 112) and a list of nearby hospitals and police stations calculated by distance.
3.  **Crash Feed (Community Social Feed)**: Allow bystanders and motorists to share real-time traffic hazards, road blockages, and survival stories with photos/videos, timestamp, and geotagging.
4.  **Automatic Collision Detector (Simulated)**: Simulates state-of-the-art crash detection. Accelerometer tracking combined with a manual G-force throttle allows testing a 10-second emergency trigger. If not canceled, it automatically submits a critical triage report.
5.  **Light/Dark Themes**: Fully responsive, curated, and styled with premium glassmorphism layouts, defaults to Light theme.

## Tech Stack

*   **Frontend**: React (Vite), Leaflet.js / Mappls (MapmyIndia) Integration, Lucide Icons, Custom Vanilla CSS.
*   **Backend**: Node.js, Express, Multer (Media storage), SQLite3.
*   **Local Database**: SQLite.

## Installation & Running

1.  Ensure you have Node.js (v18+) installed.
2.  Install all dependencies:
    ```bash
    npm run install:all
    ```
3.  Run the application in development mode (spins up Express Server on `http://localhost:5001` and Vite Client on `http://localhost:5173`):
    ```bash
    npm run dev
    ```
