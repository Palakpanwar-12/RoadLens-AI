USE roadlens_ai;

-- TEST / DEMO DATA ONLY.
-- This data is intentionally separate from the real GIS data in gis_data.sql.
-- Load gis_data.sql independently when you want the project road/segment records.

INSERT INTO users(full_name,email,role) VALUES
('Test Inspector','inspector@test.local','INSPECTOR'),
('Test Engineer','engineer@test.local','ENGINEER');

INSERT INTO roads(road_code,road_name,location_description,state)
VALUES ('TEST-R01','Test Road 01','Placeholder for integration testing','Uttar Pradesh');
SET @test_road_id = (SELECT road_id FROM roads WHERE road_code='TEST-R01');

INSERT INTO road_segments(road_id,segment_code,chainage_start,chainage_end)
VALUES (@test_road_id,'TEST-S01',0,100);
SET @test_segment_id = (
    SELECT segment_id FROM road_segments
    WHERE road_id=@test_road_id AND segment_code='TEST-S01'
);

INSERT INTO inspections(road_id,segment_id,inspected_by,inspection_date,status,notes)
VALUES (@test_road_id,@test_segment_id,1,'2026-09-01 10:15:30','COMPLETED','Test record');
SET @test_inspection_id = LAST_INSERT_ID();

INSERT INTO inspection_images(inspection_id,image_name,captured_at,processing_status)
VALUES (@test_inspection_id,'IMG_2026_001.jpg','2026-09-01 10:15:30','PROCESSED');
SET @test_image_id = LAST_INSERT_ID();

INSERT INTO ai_detections
(image_id,model_name,defect_code,defect_name,confidence,
 bbox_x1,bbox_y1,bbox_x2,bbox_y2,area_pixels,area_percentage,detected_at)
VALUES
(@test_image_id,'YOLOv8 best.pt','D40','Pothole',0.8900,120,340,450,680,112200,14.200,'2026-09-01 10:15:30');

-- Kirti documented result: severity 71.0, health 78.7, Medium.
INSERT INTO health_scores(image_id,defect_counts,severity_score,health_score,priority)
VALUES (@test_image_id,JSON_OBJECT('D40',1),71.00,78.7,'Medium');

INSERT INTO inspection_images(inspection_id,image_name,processing_status)
VALUES (@test_inspection_id,'India_000022_jpg.rf.eae498a61f4511494b3ddd157e475fd8.jpg','PROCESSED');
SET @zero_image_id=LAST_INSERT_ID();

INSERT INTO health_scores(image_id,defect_counts,severity_score,health_score,priority)
VALUES (@zero_image_id,JSON_OBJECT(),0,100.0,'Low');

INSERT INTO inspection_versions(inspection_id,version_number,version_status,snapshot,created_by)
VALUES (@test_inspection_id,1,'FINAL',JSON_OBJECT('status','COMPLETED'),1);

INSERT INTO reports(inspection_id,report_title,generated_by)
VALUES (@test_inspection_id,'RoadLens Test Inspection Report',2);
