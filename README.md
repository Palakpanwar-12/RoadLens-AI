# RoadLens-AI 🚗🛣️

Automated Road Defect Detection & Analytics Dashboard System.

## Features
- AI-Powered Road Defect Detection using YOLO (`best.pt`) for 4 defect classes:
  - Pothole
  - Longitudinal Crack
  - Transverse Crack
  - Alligator Crack
- FastAPI backend integrated with SQLite database (`roadlens.db`).
- Interactive API Documentation with Swagger UI.
- Geotagging and defect severity analysis support.

## How to Run Backend

1. Clone the repository:
   git clone https://github.com/Palakpanwar-12/RoadLens-AI.git

2. Install dependencies:
   pip install -r requirements.txt

3. Run FastAPI server:
   uvicorn main:app --reload

4. Access API Docs (Swagger UI):
   http://127.0.0.1:8000/docs
