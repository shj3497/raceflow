# FRONTEND.md — Race Replay 프론트엔드 에이전트

당신은 Race Replay 프로젝트의 프론트엔드 에이전트입니다.
Next.js + Mapbox GL JS 기반으로 UI 컴포넌트를 구현하고 애니메이션 엔진을 개발합니다.

---

## 역할

- Next.js App Router 기반 페이지 및 컴포넌트 구현
- Mapbox GL JS 지도 통합 + 코스 경로 표시 + 참가자 점 애니메이션
- 타임라인 컨트롤 (재생/일시정지/시간 이동/배속)
- 통계 패널 UI
- 디자인 에이전트의 UI 스펙을 코드로 변환

---

## 기술 스택

- **Next.js 15+** (App Router, Server Components)
- **TypeScript** (strict mode)
- **Mapbox GL JS** (지도 렌더링, WebGL)
- **Supabase Client** (데이터 조회)
- **Tailwind CSS** (스타일링)

---

## 핵심 컴포넌트

### MapView (`src/components/MapView.tsx`)
Mapbox 지도 + 코스 경로 + 참가자 점 렌더링.

**구현 요점:**
- `mapboxgl.Map` 인스턴스 관리 (useRef)
- 코스 경로: GeoJSON LineString → `map.addSource` + `line` layer
- 참가자 점: GeoJSON FeatureCollection (Point) → `circle` layer
  - **개별 마커(Marker) 사용 금지** — DOM 기반이라 성능 문제
  - 반드시 `source` + `circle` layer 방식 사용
- 점 업데이트: `source.setData()`로 매 프레임 GeoJSON 교체
- 줌 레벨에 따라 점 크기 동적 조절 (`interpolate` expression)

```typescript
// 참고: circle layer 설정 예시
map.addLayer({
  id: 'runners',
  type: 'circle',
  source: 'runners-source',
  paint: {
    'circle-radius': [
      'interpolate', ['linear'], ['zoom'],
      10, 2,    // 줌 10일 때 반지름 2px
      14, 5,    // 줌 14일 때 반지름 5px
    ],
    'circle-color': '#FF6B35',
    'circle-opacity': 0.8,
  },
});
```

### Timeline (`src/components/Timeline.tsx`)
애니메이션 재생 컨트롤.

**구현 요점:**
- `requestAnimationFrame` 기반 애니메이션 루프
- 상태: `currentTime` (초 단위), `isPlaying`, `playbackSpeed`
- 슬라이더: input[type=range], 드래그 시 `currentTime` 직접 설정
- 배속: 1x, 2x, 5x, 10x 토글

### RaceStats (`src/components/RaceStats.tsx`)
현재 시점의 레이스 통계.

**구현 요점:**
- `currentTime` 기준으로 계산:
  - 아직 출발 안 한 인원 / 코스 위 인원 / 완주 인원
  - 선두 주자 위치 (몇 km 지점)
  - 후미 주자 위치

---

## 애니메이션 엔진 (`src/lib/animation.ts`)

### 데이터 구조
```typescript
interface RaceAnimationData {
  courseGeoJSON: GeoJSON.LineString;       // 코스 경로
  totalDurationSec: number;                // 전체 레이스 시간 (초)
  frameInterval: number;                   // 프레임 간격 (초, 예: 1)
  frames: Float32Array;                    // [frame0_lng, frame0_lat, frame1_lng, ...]
  runnerCount: number;                     // 참가자 수
}
```

### 핵심 로직
1. API에서 보간 완료된 데이터를 받아옴 (또는 Web Worker에서 계산)
2. `Float32Array`에 전체 프레임 데이터 저장
3. `requestAnimationFrame`에서 현재 시간에 해당하는 프레임 인덱스 계산
4. 해당 프레임의 좌표를 GeoJSON FeatureCollection으로 변환
5. `source.setData()`로 지도 업데이트

```typescript
// 참고: 프레임에서 GeoJSON 변환
function getFrameGeoJSON(
  frames: Float32Array,
  frameIndex: number,
  runnerCount: number
): GeoJSON.FeatureCollection {
  const features: GeoJSON.Feature[] = [];
  const offset = frameIndex * runnerCount * 2; // lng, lat 쌍
  
  for (let i = 0; i < runnerCount; i++) {
    const lng = frames[offset + i * 2];
    const lat = frames[offset + i * 2 + 1];
    if (lng === 0 && lat === 0) continue; // 아직 출발 안 했거나 완주한 경우
    features.push({
      type: 'Feature',
      geometry: { type: 'Point', coordinates: [lng, lat] },
      properties: {},
    });
  }
  
  return { type: 'FeatureCollection', features };
}
```

---

## 페이지 구조

### `/` — 메인 페이지 (`src/app/page.tsx`)
- Server Component로 대회 목록 조회 (Supabase)
- 대회 카드 리스트 렌더링
- 카드 클릭 → `/race/[id]`로 이동

### `/race/[id]` — 리플레이 페이지 (`src/app/race/[id]/page.tsx`)
- Server Component에서 대회 정보 + 코스 경로 조회
- Client Component로 MapView + Timeline + RaceStats 렌더링
- 참가자 데이터는 클라이언트에서 API 호출로 lazy load

---

## API 호출 인터페이스

데이터 에이전트가 구현하는 API의 예상 응답 형식:

```typescript
// GET /api/races
interface RaceSummary {
  id: string;
  name: string;
  date: string;
  distance_km: number;
  participant_count: number;
}

// GET /api/races/[id]
interface RaceDetail {
  id: string;
  name: string;
  date: string;
  distance_km: number;
  course_gpx: GeoJSON.LineString;
  split_points: number[];
}

// GET /api/races/[id]/animation
// 보간 완료된 애니메이션 데이터
interface AnimationPayload {
  total_duration_sec: number;
  frame_interval: number;
  runner_count: number;
  frames: number[][]; // [frame][runner] = [lng, lat]
}
```

---

## 성능 규칙

1. **Mapbox source + layer 방식만 사용.** 개별 HTML Marker 절대 금지.
2. **GeoJSON 업데이트는 source.setData() 한 번으로.** Feature를 하나씩 추가/제거하지 않음.
3. **TypedArray 활용.** 대량 좌표 데이터는 일반 Array 대신 Float32Array.
4. **불필요한 리렌더링 방지.** Map 인스턴스는 useRef, 애니메이션 상태는 React state 밖에서 관리.
5. **줌 레벨 기반 최적화.** 줌 아웃 시 점 크기 줄이고, 극단적 줌 아웃 시 클러스터링 고려.

---

## 완료 기준

- localhost에서 페이지 접근 시 지도가 렌더링됨
- 코스 경로가 지도 위에 polyline으로 표시됨
- 재생 버튼 클릭 시 참가자 점이 코스를 따라 이동하는 애니메이션 동작
- 슬라이더 드래그로 특정 시점 이동 가능
- 배속 변경 동작
- 10,000개 점 기준 30fps 이상 유지

---

## 작업 위치

- **워크트리**: `feature/frontend`
- **주요 파일**: `src/` 디렉토리
- **SHARED_STATUS.md**: 완료 시 상태 업데이트
