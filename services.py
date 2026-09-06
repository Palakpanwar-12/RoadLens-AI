import os
from ultralytics import YOLO

MODEL_PATH = "best.pt"

try:
    model = YOLO(MODEL_PATH)
    print("AI Model loaded successfully!")
except Exception as e:
    print(f"Error loading AI model: {e}")
    model = None

def process_road_image(image_path: str):
    if not model:
        return {
            "detections": [],
            "metrics": {
                "defect_counts": {"pothole": 0},
                "severity_score": 0,
                "health_score": 100,
                "priority": "Low"
            }
        }

    abs_image_path = os.path.abspath(image_path)
    
    # Confidence threshold घटकर 0.10 (10%) कर दिया है
    results = model(abs_image_path, conf=0.10)
    
    detections = []
    pothole_count = 0

    for r in results:
        for box in r.boxes:
            conf = float(box.conf[0])
            cls_id = int(box.cls[0])
            class_name = r.names[cls_id]
            
            detections.append({
                "class": class_name,
                "confidence": round(conf, 2),
                "box": [round(x, 2) for x in box.xyxy[0].tolist()]
            })
            pothole_count += 1

    severity = min(pothole_count * 20, 100)
    health = max(100 - severity, 0)
    priority = "High" if severity > 50 else ("Medium" if severity > 20 else "Low")

    return {
        "detections": detections,
        "metrics": {
            "defect_counts": {"pothole": pothole_count},
            "severity_score": severity,
            "health_score": health,
            "priority": priority
        }
    }