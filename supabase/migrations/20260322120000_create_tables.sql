-- 대회
CREATE TABLE races (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  date DATE NOT NULL,
  distance_km DECIMAL NOT NULL,
  course_gpx JSONB,           -- GeoJSON LineString
  split_points JSONB,          -- [5, 10, 15, 21.0975]
  source_url TEXT,
  source_type TEXT,            -- "myresult" | "smartchip" | "manual"
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 참가자 기록
CREATE TABLE results (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  race_id UUID REFERENCES races(id),
  bib_number TEXT,
  name TEXT,
  gender TEXT,
  age_group TEXT,
  gross_time INTERVAL,
  net_time INTERVAL,
  splits JSONB,                -- {"5": "00:25:30", "10": "00:51:12", ...}
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_results_race ON results(race_id);
