# RoadLens AI — Ready Frontend

This is the complete ready-to-run React/Vite frontend for RoadLens AI.

## Included
- Dashboard
- Roads & Segments
- AI inspection image upload
- AI Results with D00/D10/D20/D40
- Inspection History
- Previous vs Current Comparison
- Drafts
- Changes / Version History
- Map / GIS
- Reports
- Responsive premium dark UI
- FastAPI integration through Vite `/api` proxy
- Demo fallback when backend is unavailable

## Important
The frontend does not contain `best.pt`. The YOLO model stays in the backend.

## Run with existing RoadLens backend
1. Start backend from the RoadLens-AI folder:
   `uvicorn main:app --reload`
2. In this frontend folder:
   `npm install`
3. Start:
   `npm run dev`

## Backend expected
The frontend uses:
- GET /api/v1/dashboard/stats
- GET /api/v1/roads
- POST /api/v1/inspect
- GET /api/v1/history
- GET /api/v1/drafts
- POST /api/v1/drafts
- GET /api/v1/history/changes
- GET /api/v1/map/defects
- POST /api/v1/reports/generate

## Defect terminology
D00 = Longitudinal Crack
D10 = Transverse Crack
D20 = Alligator / Block Crack
D40 = Pothole

Priority thresholds follow the supplied Member-2 logic:
80–100 Low
60–79 Medium
Below 60 High
