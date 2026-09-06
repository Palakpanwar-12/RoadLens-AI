from fastapi import FastAPI, UploadFile, File, HTTPException, Depends
from pydantic import BaseModel
from typing import Optional, List
import shutil
import os
from datetime import datetime

from database import get_db
from services import process_road_image

app = FastAPI(
    title="RoadLens AI Complete Backend",
    description="APIs for Prabhneet's Frontend (Auth, AI Inspection, Dashboard, GIS, Drafts, Reports)",
    version="1.0.0"
)

os.makedirs("uploaded_images", exist_ok=True)

# In-Memory Storage for Demo Data
inspection_history = []
drafts_db = []
changes_db = []

# --- Pydantic Schemas for Request Validation ---
class LoginRequest(BaseModel):
    username: str
    password: str

class DraftRequest(BaseModel):
    road_id: str
    segment_id: str
    entered_details: str
    status: str = "Draft"

# --- 1. Authentication APIs ---
@app.post("/api/v1/auth/login", tags=["1. Authentication"])
def login(data: LoginRequest):
    if data.username and data.password:
        return {
            "status": "success",
            "access_token": "mock-jwt-token-12345",
            "user_name": data.username,
            "user_role": "Inspector / Admin",
            "message": "Login successful"
        }
    raise HTTPException(status_code=400, detail="Invalid credentials")

# --- 2. Image Upload & AI Detection ---
@app.post("/api/v1/inspect", tags=["2. Image Upload & AI"])
async def inspect_road(file: UploadFile = File(...), road_id: str = "ROAD_001", segment_id: str = "SEG_10"):
    file_location = f"uploaded_images/{file.filename}"
    with open(file_location, "wb") as buffer:
        shutil.copyfileobj(file.file, buffer)
        
    ai_result = process_road_image(file_location)
    
    record = {
        "inspection_id": len(inspection_history) + 1,
        "road_id": road_id,
        "segment_id": segment_id,
        "image_name": file.filename,
        "image_url": f"/uploaded_images/{file.filename}",
        "date_time": datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
        "ai_detection": ai_result
    }
    inspection_history.append(record)
    
    return {
        "status": "success",
        "data": record
    }

# --- 3. Road & Segment Data ---
@app.get("/api/v1/roads", tags=["3. Road & Segment Data"])
def get_roads_and_segments():
    return {
        "status": "success",
        "roads": [
            {
                "road_id": "ROAD_001",
                "road_name": "NH-48 Sector 12",
                "start_location": "Km 10",
                "end_location": "Km 25",
                "segment_id": "SEG_10",
                "chainage": "12+500",
                "gps_coordinates": {"latitude": 26.3481, "longitude": 74.6295},
                "current_condition": "Damaged",
                "health_score": 62.5
            }
        ]
    }

# --- 4. Dashboard Data ---
@app.get("/api/v1/dashboard/stats", tags=["4. Dashboard Data"])
def get_dashboard_stats():
    return {
        "status": "success",
        "stats": {
            "total_roads": 12,
            "total_segments": 48,
            "total_defects": len(inspection_history) * 3,
            "defect_type_count": {"Pothole": 14, "Crack": 22, "Rutting": 5},
            "severity_wise_count": {"High": 8, "Medium": 18, "Low": 15},
            "healthy_segments": 30,
            "damaged_segments": 18,
            "overall_health_score": 74.2
        }
    }

# --- 5. Inspection History ---
@app.get("/api/v1/history", tags=["5. Inspection History"])
def get_inspection_history():
    return {
        "status": "success",
        "total_inspections": len(inspection_history),
        "history": inspection_history
    }

# --- 6. Drafts APIs ---
@app.post("/api/v1/drafts", tags=["6. Drafts"])
def save_draft(draft: DraftRequest):
    draft_entry = {
        "draft_id": len(drafts_db) + 1,
        "road_id": draft.road_id,
        "segment_id": draft.segment_id,
        "entered_details": draft.entered_details,
        "status": draft.status,
        "created_date": datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    }
    drafts_db.append(draft_entry)
    return {"status": "success", "draft": draft_entry}

@app.get("/api/v1/drafts", tags=["6. Drafts"])
def get_drafts():
    return {"status": "success", "drafts": drafts_db}

# --- 7. Version History / Changes ---
@app.get("/api/v1/history/changes", tags=["7. Changes / Version History"])
def get_version_history():
    return {
        "status": "success",
        "changes": [
            {
                "version_id": "V_101",
                "record_changed": "ROAD_001_SEG_10",
                "old_value": "Health Score: 80",
                "new_value": "Health Score: 62.5",
                "changed_by": "Inspector_Palak",
                "date_time": datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
                "reason": "New pothole detected after AI inspection"
            }
        ]
    }

# --- 8. Map / GIS Data ---
@app.get("/api/v1/map/defects", tags=["8. Map/GIS Data"])
def get_map_gis_data():
    return {
        "status": "success",
        "gis_data": [
            {
                "road_id": "ROAD_001",
                "segment_id": "SEG_10",
                "latitude": 26.3481,
                "longitude": 74.6295,
                "defect_location": "LHS Lane 1",
                "severity": "High",
                "marker_status": "Critical",
                "chainage": "12+500"
            }
        ]
    }

# --- 9. Reports APIs ---
@app.post("/api/v1/reports/generate", tags=["9. Reports"])
def generate_report(road_id: str = "ROAD_001"):
    return {
        "status": "success",
        "message": "Report generated successfully",
        "download_link": f"/reports/download/{road_id}.pdf",
        "generated_at": datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    }