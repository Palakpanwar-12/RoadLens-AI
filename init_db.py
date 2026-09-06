import sqlite3

conn = sqlite3.connect("roadlens.db")
cursor = conn.cursor()

cursor.executescript("""
CREATE TABLE IF NOT EXISTS users (
id INTEGER PRIMARY KEY AUTOINCREMENT,
email TEXT UNIQUE NOT NULL,
hashed_password TEXT NOT NULL,
full_name TEXT,
role TEXT DEFAULT 'inspector'
);

CREATE TABLE IF NOT EXISTS inspections (
id INTEGER PRIMARY KEY AUTOINCREMENT,
image_path TEXT NOT NULL,
status TEXT DEFAULT 'pending',
created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS defects (
id INTEGER PRIMARY KEY AUTOINCREMENT,
inspection_id INTEGER,
defect_type TEXT NOT NULL,
severity TEXT,
confidence REAL,
FOREIGN KEY(inspection_id) REFERENCES inspections(id)
);

CREATE TABLE IF NOT EXISTS drafts (
id INTEGER PRIMARY KEY AUTOINCREMENT,
title TEXT NOT NULL,
data TEXT NOT NULL,
created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
""")

conn.commit()
conn.close()

print("SUCCESS: SQLite Database and Tables created successfully!")