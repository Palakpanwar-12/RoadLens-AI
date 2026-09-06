DROP DATABASE IF EXISTS roadlens_ai;
CREATE DATABASE roadlens_ai CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci;
USE roadlens_ai;

CREATE TABLE users (
 user_id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
 full_name VARCHAR(120) NOT NULL,
 email VARCHAR(255) UNIQUE,
 role ENUM('ADMIN','INSPECTOR','ENGINEER','VIEWER') NOT NULL DEFAULT 'VIEWER',
 created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB;

CREATE TABLE roads (
 road_id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
 road_code VARCHAR(50) NOT NULL UNIQUE,
 road_name VARCHAR(200) NOT NULL,
 location_description VARCHAR(500),
 district VARCHAR(100), state VARCHAR(100), country VARCHAR(100) DEFAULT 'India',
 start_latitude DECIMAL(10,7), start_longitude DECIMAL(10,7),
 end_latitude DECIMAL(10,7), end_longitude DECIMAL(10,7),
 created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
 CHECK (start_latitude IS NULL OR start_latitude BETWEEN -90 AND 90),
 CHECK (end_latitude IS NULL OR end_latitude BETWEEN -90 AND 90),
 CHECK (start_longitude IS NULL OR start_longitude BETWEEN -180 AND 180),
 CHECK (end_longitude IS NULL OR end_longitude BETWEEN -180 AND 180)
) ENGINE=InnoDB;

CREATE TABLE road_segments (
 segment_id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
 road_id BIGINT UNSIGNED NOT NULL,
 segment_code VARCHAR(80) NOT NULL,
 chainage_start DECIMAL(10,2), chainage_end DECIMAL(10,2),
 start_latitude DECIMAL(10,7), start_longitude DECIMAL(10,7),
 end_latitude DECIMAL(10,7), end_longitude DECIMAL(10,7),
 coordinates JSON,
 created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
 FOREIGN KEY (road_id) REFERENCES roads(road_id) ON UPDATE CASCADE ON DELETE CASCADE,
 UNIQUE (road_id, segment_code),
 CHECK (chainage_start IS NULL OR chainage_start >= 0),
 CHECK (chainage_end IS NULL OR chainage_end >= 0),
 CHECK (chainage_end IS NULL OR chainage_start IS NULL OR chainage_end >= chainage_start),
 CHECK (coordinates IS NULL OR JSON_TYPE(coordinates) = 'ARRAY')
) ENGINE=InnoDB;

CREATE INDEX idx_segments_road ON road_segments(road_id);

CREATE TABLE inspections (
 inspection_id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
 road_id BIGINT UNSIGNED NOT NULL,
 segment_id BIGINT UNSIGNED,
 inspected_by BIGINT UNSIGNED,
 inspection_date DATETIME NOT NULL,
 status ENUM('DRAFT','PROCESSING','COMPLETED','FAILED') NOT NULL DEFAULT 'DRAFT',
 notes TEXT,
 created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
 updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
 FOREIGN KEY (road_id) REFERENCES roads(road_id) ON UPDATE CASCADE ON DELETE RESTRICT,
 FOREIGN KEY (segment_id) REFERENCES road_segments(segment_id) ON UPDATE CASCADE ON DELETE SET NULL,
 FOREIGN KEY (inspected_by) REFERENCES users(user_id) ON UPDATE CASCADE ON DELETE SET NULL
) ENGINE=InnoDB;

CREATE INDEX idx_inspections_road_date ON inspections(road_id, inspection_date);
CREATE INDEX idx_inspections_segment_date ON inspections(segment_id, inspection_date);

CREATE TABLE inspection_images (
 image_id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
 inspection_id BIGINT UNSIGNED NOT NULL,
 image_name VARCHAR(255) NOT NULL,
 image_url VARCHAR(1000),
 captured_at DATETIME,
 image_width INT UNSIGNED, image_height INT UNSIGNED,
 processing_status ENUM('UPLOADED','PROCESSING','PROCESSED','FAILED') DEFAULT 'UPLOADED',
 created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
 FOREIGN KEY (inspection_id) REFERENCES inspections(inspection_id) ON UPDATE CASCADE ON DELETE CASCADE,
 UNIQUE (inspection_id, image_name)
) ENGINE=InnoDB;

CREATE TABLE defect_types (
 defect_code VARCHAR(10) PRIMARY KEY,
 defect_name VARCHAR(100) NOT NULL,
 severity_weight DECIMAL(6,2) NOT NULL,
 is_active BOOLEAN NOT NULL DEFAULT TRUE,
 CHECK (severity_weight >= 0)
) ENGINE=InnoDB;

INSERT INTO defect_types VALUES
('D00','Longitudinal Crack',2.00,TRUE),
('D10','Transverse Crack',2.00,TRUE),
('D20','Alligator / Block Crack',4.00,TRUE),
('D40','Pothole',5.00,TRUE);

CREATE TABLE ai_detections (
 detection_id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
 image_id BIGINT UNSIGNED NOT NULL,
 model_name VARCHAR(120) NOT NULL DEFAULT 'YOLOv8 best.pt',
 defect_code VARCHAR(10) NOT NULL,
 defect_name VARCHAR(100),
 confidence DECIMAL(5,4) NOT NULL,
 bbox_x1 INT UNSIGNED, bbox_y1 INT UNSIGNED,
 bbox_x2 INT UNSIGNED, bbox_y2 INT UNSIGNED,
 area_pixels BIGINT UNSIGNED,
 area_percentage DECIMAL(7,3) NOT NULL,
 detected_at DATETIME,
 created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
 FOREIGN KEY (image_id) REFERENCES inspection_images(image_id) ON UPDATE CASCADE ON DELETE CASCADE,
 FOREIGN KEY (defect_code) REFERENCES defect_types(defect_code) ON UPDATE CASCADE ON DELETE RESTRICT,
 CHECK (confidence BETWEEN 0 AND 1),
 CHECK (area_percentage BETWEEN 0 AND 100)
) ENGINE=InnoDB;

CREATE INDEX idx_detections_image ON ai_detections(image_id);
CREATE INDEX idx_detections_code ON ai_detections(defect_code);

CREATE TABLE health_scores (
 analysis_id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
 image_id BIGINT UNSIGNED NOT NULL,
 defect_counts JSON NOT NULL,
 severity_score DECIMAL(10,2) NOT NULL DEFAULT 0,
 health_score DECIMAL(5,1) NOT NULL,
 priority ENUM('Low','Medium','High') NOT NULL,
 calculation_k DECIMAL(5,3) NOT NULL DEFAULT 0.300,
 analyzed_at DATETIME DEFAULT CURRENT_TIMESTAMP,
 FOREIGN KEY (image_id) REFERENCES inspection_images(image_id) ON UPDATE CASCADE ON DELETE CASCADE,
 UNIQUE (image_id),
 CHECK (severity_score >= 0),
 CHECK (health_score BETWEEN 0 AND 100)
) ENGINE=InnoDB;

CREATE INDEX idx_health_priority ON health_scores(priority);
CREATE INDEX idx_health_score ON health_scores(health_score);

CREATE TABLE inspection_versions (
 version_id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
 inspection_id BIGINT UNSIGNED NOT NULL,
 version_number INT UNSIGNED NOT NULL,
 version_status ENUM('DRAFT','FINAL','SUPERSEDED') DEFAULT 'DRAFT',
 snapshot JSON,
 created_by BIGINT UNSIGNED,
 created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
 FOREIGN KEY (inspection_id) REFERENCES inspections(inspection_id) ON UPDATE CASCADE ON DELETE CASCADE,
 FOREIGN KEY (created_by) REFERENCES users(user_id) ON UPDATE CASCADE ON DELETE SET NULL,
 UNIQUE (inspection_id, version_number)
) ENGINE=InnoDB;

CREATE TABLE reports (
 report_id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
 inspection_id BIGINT UNSIGNED NOT NULL,
 report_title VARCHAR(255) NOT NULL,
 report_url VARCHAR(1000),
 generated_by BIGINT UNSIGNED,
 generated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
 report_status ENUM('GENERATED','FAILED') DEFAULT 'GENERATED',
 FOREIGN KEY (inspection_id) REFERENCES inspections(inspection_id) ON UPDATE CASCADE ON DELETE CASCADE,
 FOREIGN KEY (generated_by) REFERENCES users(user_id) ON UPDATE CASCADE ON DELETE SET NULL
) ENGINE=InnoDB;

CREATE TABLE audit_logs (
 audit_id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
 user_id BIGINT UNSIGNED,
 entity_type VARCHAR(50) NOT NULL,
 entity_id BIGINT UNSIGNED NOT NULL,
 action ENUM('CREATE','UPDATE','DELETE','PROCESS','EXPORT') NOT NULL,
 old_data JSON, new_data JSON,
 created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
 FOREIGN KEY (user_id) REFERENCES users(user_id) ON UPDATE CASCADE ON DELETE SET NULL
) ENGINE=InnoDB;

CREATE INDEX idx_audit_entity ON audit_logs(entity_type, entity_id);

CREATE OR REPLACE VIEW v_road_segment_gis AS
SELECT r.road_id, r.road_code, r.road_name,
       rs.segment_id, rs.segment_code,
       rs.chainage_start, rs.chainage_end,
       rs.start_latitude, rs.start_longitude,
       rs.end_latitude, rs.end_longitude,
       rs.coordinates
FROM roads r
JOIN road_segments rs ON rs.road_id = r.road_id;

CREATE OR REPLACE VIEW v_image_analysis AS
SELECT i.image_id,i.inspection_id,i.image_name,i.captured_at,
       h.defect_counts,h.severity_score,h.health_score,h.priority,
       h.calculation_k,h.analyzed_at
FROM inspection_images i LEFT JOIN health_scores h ON h.image_id=i.image_id;

CREATE OR REPLACE VIEW v_detection_details AS
SELECT d.detection_id,d.image_id,i.image_name,d.defect_code,
       dt.defect_name,dt.severity_weight,d.confidence,d.area_pixels,
       d.area_percentage,d.bbox_x1,d.bbox_y1,d.bbox_x2,d.bbox_y2,d.model_name
FROM ai_detections d
JOIN inspection_images i ON i.image_id=d.image_id
JOIN defect_types dt ON dt.defect_code=d.defect_code;
