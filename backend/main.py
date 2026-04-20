from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
import httpx
from datetime import datetime, timedelta
import asyncio
from typing import List, Dict

app = FastAPI(title="AI-Based Disaster Risk Analyzer API")

# Enable CORS for frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

async def get_earthquake_data(lat: float, lon: float):
    # Query USGS for earthquakes within 100km, magnitude >= 3.0, last 20 years
    start_time = (datetime.now() - timedelta(days=365*20)).strftime("%Y-%m-%d")
    url = f"https://earthquake.usgs.gov/fdsnws/event/1/query?format=geojson&latitude={lat}&longitude={lon}&maxradiuskm=100&starttime={start_time}&minmagnitude=3.0"
    
    async with httpx.AsyncClient() as client:
        try:
            response = await client.get(url, timeout=10.0)
            if response.status_code == 200:
                data = response.json()
                features = data.get("features", [])
                
                # Calculate risk based on count and magnitude
                if not features:
                    return {"score": 10, "data": []}
                
                # Formula: More large quakes = higher risk
                total_impact = sum(pow(f["properties"]["mag"], 2) for f in features)
                risk_score = min(100, (total_impact / 500) * 100) # Arbitrary normalization
                
                return {
                    "score": round(risk_score, 1),
                    "count": len(features),
                    "max_mag": max(f["properties"]["mag"] for f in features)
                }
        except Exception as e:
            print(f"Earthquake API error: {e}")
            return {"score": 0, "error": str(e)}
    return {"score": 0}

async def get_weather_data(lat: float, lon: float):
    # Get historical rainfall from Open-Meteo
    end_date = (datetime.now() - timedelta(days=7)).strftime("%Y-%m-%d")
    start_date = (datetime.now() - timedelta(days=365*5)).strftime("%Y-%m-%d") # 5 years history
    
    url = f"https://archive-api.open-meteo.com/v1/archive?latitude={lat}&longitude={lon}&start_date={start_date}&end_date={end_date}&daily=precipitation_sum&timezone=auto"
    
    async with httpx.AsyncClient() as client:
        try:
            response = await client.get(url, timeout=10.0)
            if response.status_code == 200:
                data = response.json()
                precip = data.get("daily", {}).get("precipitation_sum", [])
                
                if not precip:
                    return {"score": 10}
                
                max_rain = max(precip)
                avg_rain = sum(precip) / len(precip)
                
                # Score based on max daily rainfall (threshold 100mm = very high)
                risk_score = min(100, (max_rain / 100) * 100)
                
                return {
                    "score": round(risk_score, 1),
                    "max_daily_mm": round(max_rain, 1),
                    "avg_daily_mm": round(avg_rain, 2)
                }
        except Exception as e:
            print(f"Weather API error: {e}")
            return {"score": 0, "error": str(e)}
    return {"score": 0}

async def get_flood_data(lat: float, lon: float):
    # Open-Meteo Flood API (River Discharge)
    url = f"https://flood-api.open-meteo.com/v1/flood?latitude={lat}&longitude={lon}&daily=river_discharge&forecast_days=7"
    
    async with httpx.AsyncClient() as client:
        try:
            response = await client.get(url, timeout=10.0)
            if response.status_code == 200:
                data = response.json()
                discharge = data.get("daily", {}).get("river_discharge", [])
                
                if not discharge:
                    # If no river nearby, check elevation as proxy if possible, 
                    # but for now, we'll return a low default if API says no data
                    return {"score": 15}
                
                max_discharge = max(discharge)
                # This is tricky without historical baselines, so we'll use a relative scale
                # Assuming > 50 m3/s for a small-ish area is high without context
                risk_score = min(100, (max_discharge / 50) * 100)
                
                return {
                    "score": round(risk_score, 1),
                    "max_discharge_m3s": round(max_discharge, 2)
                }
        except Exception as e:
            print(f"Flood API error: {e}")
            return {"score": 0, "error": str(e)}
    return {"score": 0}

def get_recommendations(earthquake_score, rainfall_score, flood_score):
    recs = []
    
    if flood_score > 60:
        recs.extend([
            "Elevated foundation (pile foundation) is highly recommended.",
            "Design a robust drainage system to handle overflow.",
            "Avoid construction in low-lying zones or floodplains."
        ])
    elif flood_score > 30:
        recs.append("Ensure proper site grading to prevent water ponding.")
        
    if earthquake_score > 60:
        recs.extend([
            "Implement reinforced concrete structures for seismic resilience.",
            "Include shear walls in the structural design.",
            "Follow a ductile design approach to allow energy dissipation."
        ])
    elif earthquake_score > 30:
        recs.append("Use standard seismic bracing and quality masonry.")

    if rainfall_score > 60:
        recs.extend([
            "Design efficient stormwater drainage with higher capacity.",
            "Apply professional-grade waterproofing systems to foundations and walls.",
            "Use sloped surfaces (min 2%) for quick water runoff."
        ])
    elif rainfall_score > 30:
        recs.append("Ensure gutters and downspouts are properly sized.")

    if not recs:
        recs.append("Standard construction practices are generally sufficient for this location.")
        
    return recs

@app.get("/analyze")
async def analyze_location(lat: float, lon: float):
    # Run API calls in parallel
    eq_task = get_earthquake_data(lat, lon)
    weather_task = get_weather_data(lat, lon)
    flood_task = get_flood_data(lat, lon)
    
    eq_res, weather_res, flood_res = await asyncio.gather(eq_task, weather_task, flood_task)
    
    # Calculate overall risk
    # Weights: EQ (40%), Flood (35%), Rainfall (25%)
    overall_score = (
        (eq_res.get("score", 0) * 0.4) + 
        (flood_res.get("score", 0) * 0.35) + 
        (weather_res.get("score", 0) * 0.25)
    )
    
    risk_level = "Low"
    if overall_score > 70:
        risk_level = "High"
    elif overall_score > 40:
        risk_level = "Medium"
        
    recommendations = get_recommendations(
        eq_res.get("score", 0),
        weather_res.get("score", 0),
        flood_res.get("score", 0)
    )
    
    return {
        "location": {"lat": lat, "lon": lon},
        "overall_score": round(overall_score, 1),
        "risk_level": risk_level,
        "breakdown": {
            "earthquake": eq_res,
            "rainfall": weather_res,
            "flood": flood_res
        },
        "recommendations": recommendations,
        "metadata": {
            "created_by": "Moawia Husnain",
            "timestamp": datetime.now().isoformat()
        }
    }

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
