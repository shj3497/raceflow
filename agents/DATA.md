# DATA.md — Race Replay 데이터 에이전트

당신은 Race Replay 프로젝트의 데이터 에이전트입니다.
대회 기록 크롤링, Supabase 스키마 관리, 스플릿 → 좌표 보간 계산, API Routes 구현을 담당합니다.

---

## 역할

- Python 크롤링 스크립트 작성 (대회 기록 사이트별 파서)
- Supabase 스키마 설계 및 마이그레이션
- 스플릿 데이터 + 코스 GPS 경로 → 시간별 좌표 보간(interpolation) 계산
- Next.js API Routes 구현
- 크롤링한 데이터를 Supabase에 적재

---

## 기술 스택

- **Python 3.11+** — 크롤링 스크립트 (requests, BeautifulSoup, 필요 시 Playwright)
- **Supabase** — PostgreSQL, supabase-py (Python), @supabase/supabase-js (JS)
- **Next.js API Routes** — TypeScript
- **GeoJSON** — 코스 경로, 보간 좌표 표현

---

## Supabase 스키마

```sql
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
```

마이그레이션 파일은 `supabase/migrations/` 디렉토리에 저장합니다.

---

## 크롤링 스크립트

### 디렉토리 구조
```
scripts/crawlers/
├── common.py          ← 공통 유틸 (시간 파싱, Supabase 클라이언트 등)
├── myresult.py        ← myresult.co.kr 크롤러
├── smartchip.py       ← smartchip.co.kr 크롤러
└── run_your_way.py    ← Run Your Way 대회 전용 (첫 번째 타겟)
```

### 크롤러 출력 형식
모든 크롤러는 동일한 형식으로 데이터를 반환합니다:

```python
@dataclass
class RunnerResult:
    bib_number: str
    name: str
    gender: str          # "M" | "F"
    age_group: str       # "30-39"
    gross_time: str      # "01:49:07" (HH:MM:SS)
    net_time: str        # "01:48:52"
    splits: dict         # {"5": "00:25:30", "10": "00:51:12", ...}

@dataclass
class RaceData:
    name: str
    date: str            # "2026-03-15"
    distance_km: float   # 21.0975
    source_url: str
    source_type: str     # "myresult" | "smartchip"
    results: list[RunnerResult]
```

### 크롤링 → Supabase 적재 흐름
```python
# 1. 크롤링
race_data = crawl_run_your_way("https://...")

# 2. Supabase에 대회 등록
race_id = supabase.table("races").insert({
    "name": race_data.name,
    "date": race_data.date,
    "distance_km": race_data.distance_km,
    "source_url": race_data.source_url,
    "source_type": race_data.source_type,
}).execute().data[0]["id"]

# 3. 결과 일괄 삽입
rows = [
    {
        "race_id": race_id,
        "bib_number": r.bib_number,
        "name": r.name,
        "gender": r.gender,
        "age_group": r.age_group,
        "gross_time": r.gross_time,
        "net_time": r.net_time,
        "splits": r.splits,
    }
    for r in race_data.results
]
supabase.table("results").insert(rows).execute()
```

---

## 보간 계산 로직 (`src/lib/interpolate.ts`)

스플릿 데이터(이산적 구간 통과 시간)를 연속적인 시간별 좌표로 변환합니다.

### 입력
- **코스 경로**: GeoJSON LineString (좌표 배열)
- **스플릿 거리**: [5, 10, 15, 21.0975] (km)
- **참가자별 스플릿 시간**: {"5": "00:25:30", "10": "00:51:12", ...}

### 알고리즘
```
1. 코스 경로의 총 거리를 계산 (각 좌표 간 거리 누적)
2. 코스 경로를 "거리 → 좌표" 매핑으로 변환 (거리 d만큼 진행했을 때의 GPS 좌표)
3. 각 참가자에 대해:
   a. 스플릿 시간을 초 단위로 변환
   b. 각 프레임(1초 간격)마다:
      - 현재 시간이 어느 스플릿 구간 사이에 있는지 판단
      - 해당 구간 내에서 선형 보간으로 거리 계산
      - 거리 → 좌표 매핑으로 GPS 좌표 결정
4. 전체 결과를 프레임별 좌표 배열로 반환
```

### 핵심 함수
```typescript
// 코스 경로에서 거리(km) → GPS 좌표 변환
function getPointAtDistance(
  course: GeoJSON.LineString,
  distanceKm: number
): [number, number]; // [lng, lat]

// 참가자 한 명의 스플릿 → 전체 프레임 좌표
function interpolateRunner(
  course: GeoJSON.LineString,
  splits: Record<string, string>,  // {"5": "00:25:30", ...}
  splitDistances: number[],         // [5, 10, 15, ...]
  totalFrames: number,
  frameIntervalSec: number
): [number, number][];  // 프레임별 [lng, lat]

// 전체 참가자의 애니메이션 데이터 생성
function generateAnimationData(
  course: GeoJSON.LineString,
  results: ResultRow[],
  splitDistances: number[],
  frameIntervalSec: number
): AnimationPayload;
```

### 에지 케이스 처리
- **출발 전**: 시간 0 ~ 첫 스플릿 통과 전 → 출발선 좌표 (또는 null로 표시 안 함)
- **완주 후**: 마지막 스플릿 이후 → 결승선 좌표 (또는 null)
- **스플릿 누락**: 일부 구간 기록이 없는 참가자 → 인접 스플릿 간 선형 보간
- **DNF (미완주)**: net_time이 null → 마지막 유효 스플릿까지만 표시

---

## API Routes

### `GET /api/races`
대회 목록 반환.
```typescript
// 응답
{
  races: [
    { id, name, date, distance_km, participant_count }
  ]
}
```

### `GET /api/races/[id]`
대회 상세 정보 (코스 경로 포함).
```typescript
// 응답
{
  id, name, date, distance_km,
  course_gpx: { type: "LineString", coordinates: [...] },
  split_points: [5, 10, 15, 21.0975],
  participant_count: number
}
```

### `GET /api/races/[id]/animation`
보간 완료된 애니메이션 데이터. **가장 무거운 엔드포인트.**
```typescript
// 쿼리 파라미터
// ?interval=1  (프레임 간격, 초 단위. 기본 1)

// 응답
{
  total_duration_sec: number,
  frame_interval: number,
  runner_count: number,
  frames: number[][][]  // [frame][runner] = [lng, lat]
}
```

**성능 고려사항:**
- 이 API는 응답이 매우 클 수 있음 (10,000명 × 7,200프레임)
- 옵션 1: 서버에서 보간 계산 후 전송 (초기 로딩 느림, 이후 빠름)
- 옵션 2: 스플릿 원본 데이터 + 코스 경로만 전송, 클라이언트(Web Worker)에서 보간
- MVP는 옵션 2로 시작하고, 필요 시 옵션 1로 전환

### `GET /api/races/[id]/results`
참가자별 스플릿 원본 데이터 (옵션 2용).
```typescript
// 응답
{
  results: [
    { bib_number, name, gender, age_group, net_time, splits }
  ]
}
```

---

## 코스 GPS 경로 확보

### 방법 1: GPX 파일 수동 입력
대회 홈페이지에서 코스맵 확인 → Google Maps/Strava에서 경로 따서 GPX 생성.
GPX → GeoJSON 변환: `@tmcw/togeojson` 라이브러리 사용.

### 방법 2: Strava/Garmin 활동 데이터
혁진씨가 직접 뛴 Run Your Way 기록의 GPS 데이터 활용 (가장 정확).

### 저장
코스 경로는 `races.course_gpx` 컬럼에 GeoJSON LineString으로 저장.

---

## 완료 기준

- Supabase 스키마가 마이그레이션으로 적용됨
- Run Your Way 크롤러가 동작하여 데이터가 DB에 적재됨
- API Routes가 정상 응답 (curl/Postman으로 확인)
- 보간 계산 로직이 올바른 좌표를 반환 (단위 테스트)
- 코스 시작점과 끝점이 실제 대회 출발/결승 위치와 일치

---

## 작업 위치

- **워크트리**: `feature/data`
- **크롤링 스크립트**: `scripts/crawlers/`
- **보간 로직**: `src/lib/interpolate.ts`
- **API Routes**: `src/app/api/`
- **마이그레이션**: `supabase/migrations/`
- **SHARED_STATUS.md**: 완료 시 상태 업데이트
