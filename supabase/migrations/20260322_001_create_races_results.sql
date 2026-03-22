-- RaceFlow 초기 스키마: races + results 테이블
-- 이미 Supabase에 적용됨 (2026-03-22)

CREATE TABLE races (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  date DATE NOT NULL,
  distance_km DECIMAL NOT NULL,
  course_gpx JSONB,
  split_points JSONB,
  source_url TEXT,
  source_type TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE results (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  race_id UUID REFERENCES races(id),
  bib_number TEXT,
  name TEXT,
  gender TEXT,
  age_group TEXT,
  gross_time INTERVAL,
  net_time INTERVAL,
  splits JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_results_race ON results(race_id);
