# AI-Based Disaster Risk Analyzer

A professional, research-oriented web application developed to analyze disaster risks (Flood, Earthquake, Rainfall) for any given location globally. The system integrates real-time datasets to provide site-specific engineering recommendations and detailed analytical reports.

## Developed By
**Moawia Husnain**  
*moawiahussnain4@gmail.com*
*Civil Engineer, UET Taxila*

---

## Key Features
- **Interactive Risk Map**: Powered by Leaflet.js for precise location selection.
- **Multidimensional Analysis**:
  - **Earthquake Risk**: Historical seismic data from USGS (20-year lookback).
  - **Flood Risk**: Global river discharge archives from Open-Meteo.
  - **Rainfall Impact**: Precipitation intensity monitoring via Open-Meteo.
- **Engineering Logic**: Smart recommendations based on civil engineering standards (foundation types, drainage design, structural resilience).
- **Premium Reporting**: Professional PDF report generation with AI-enhanced layout and site-specific insights.

## Technology Stack
- **Backend**: FastAPI (Python)
- **Frontend**: Vanilla JavaScript, Leaflet.js, Chart.js, html2pdf.js
- **APIs**: USGS Earthquake Catalog, Open-Meteo Weather/Flood API

## Installation & Setup
1. **Backend**:
   ```bash
   cd backend
   pip install -r requirements.txt
   python main.py
   ```
2. **Frontend**:
   - Open `frontend/index.html` in any modern web browser.

---
*Created as part of a Civil Engineering AI research initiative.*
