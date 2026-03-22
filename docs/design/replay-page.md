# 리플레이 페이지 (`/race/[id]`) UI 스펙

> 코스 지도 위에 9,000+명의 선수 위치를 시간순으로 애니메이션 재생하는 핵심 화면.
> 지도가 화면의 주인공이며, 모든 UI는 지도 위 오버레이로 배치한다.

---

## 레이아웃

```
┌──────────────────────────────────────────────────────────┐
│ [← 뒤로]  2026 Run Your Way Half Race Seoul    [⚙ 설정] │ ← TopBar (오버레이)
├──────────────────────────────────────────────────────────┤
│                                                          │
│                                                          │
│                    Mapbox 전체화면 지도                    │
│                                                          │
│              ┌─────────────┐                             │
│              │  체크포인트   │  ← 코스 위 마커             │
│              │   5K 통과    │                             │
│              └─────────────┘                             │
│                                                          │
│   ┌──────────┐                                           │
│   │ StatsPanel│                          ┌─────────────┐ │
│   │ 경과 01:23│                          │ 선수 검색 🔍 │ │
│   │ 선두: 김○○│                          └─────────────┘ │
│   │ 완주: 342 │                                          │
│   │ 코스위:8864│                                         │
│   └──────────┘                                           │
│                                                          │
├──────────────────────────────────────────────────────────┤
│  ◀◀  ▶  ▶▶   1x ▾   ───●──────────────  01:23 / 03:10  │ ← Timeline (하단)
└──────────────────────────────────────────────────────────┘
```

### 레이어 구조 (z-index 순서)

| z-index | 레이어 | 설명 |
|---|---|---|
| 0 | `MapView` | Mapbox GL 지도 (전체화면) |
| 10 | `CourseOverlay` | 코스 경로 polyline + 체크포인트 마커 |
| 20 | `ParticleLayer` | 선수 점(particle) 레이어 |
| 30 | `StatsPanel` | 좌측 하단 통계 패널 |
| 30 | `SearchPanel` | 우측 하단 선수 검색 |
| 40 | `TopBar` | 상단 대회명 + 네비게이션 |
| 40 | `Timeline` | 하단 재생 컨트롤 |
| 50 | `PlayerTooltip` | 선수 점 hover/클릭 시 툴팁 |

---

## 컴포넌트 목록

| 컴포넌트 | 위치 | 설명 |
|---|---|---|
| `MapView` | 전체화면 배경 | Mapbox GL JS 지도. dark 스타일 (`mapbox://styles/mapbox/dark-v11`) |
| `CourseOverlay` | 지도 위 | 코스 경로 polyline + 체크포인트 마커 (5K, 10K, 15K, 도착) |
| `ParticleLayer` | 지도 위 | 선수 점 렌더링. WebGL로 9,000+ 점 실시간 업데이트 |
| `TopBar` | 상단 오버레이 | 뒤로가기, 대회명, 설정 버튼 |
| `Timeline` | 하단 오버레이 | 재생/일시정지, 배속, 시간 슬라이더, 경과 시간 |
| `StatsPanel` | 좌측 하단 오버레이 | 실시간 통계 (경과 시간, 선두/후미, 완주자 수 등) |
| `SearchPanel` | 우측 하단 오버레이 | 선수 검색 + 하이라이트 |
| `PlayerTooltip` | 선수 점 위 | hover/클릭 시 선수 정보 툴팁 |
| `CheckpointMarker` | 코스 위 | 스플릿 지점 표시 (출발, 5K, 10K, 15K, 도착) |

---

## MapView 상세

### 지도 스타일
- **스타일**: Mapbox Dark (`dark-v11`) — 밝은 선수 점이 잘 보이도록
- **초기 뷰**: 코스 전체가 보이도록 `fitBounds` (코스 경로의 bounding box + padding 60px)
- **인터랙션**: 줌, 패닝, 더블클릭 줌 활성화. 회전은 비활성화 (`dragRotate: false`)
- **줌 범위**: `minZoom: 11`, `maxZoom: 16`

### 코스 경로 (CourseOverlay)
- **polyline**: `line-color: #60A5FA` (blue-400), `line-width: 3`, `line-opacity: 0.6`
- **방향 표시**: polyline 위에 작은 화살표 패턴 (Mapbox `symbol-placement: line`)

### 체크포인트 마커 (CheckpointMarker)
- 코스 위 원형 마커: `width: 24px`, `height: 24px`
- 배경: `#1F2937` (gray-800), 테두리: `2px solid #60A5FA`
- 라벨: 거리 텍스트 ("5K", "10K" 등), `font-size: 11px`, `color: #FFFFFF`
- 출발/도착은 깃발 아이콘으로 구분

```
    ┌──┐
    │5K│  ← 원형 마커 + 라벨
    └──┘
     │
─────●───── ← 코스 polyline 위
```

---

## ParticleLayer 상세 (핵심)

9,206개의 점을 60fps로 렌더링하는 핵심 레이어.

### 렌더링 방식
- Mapbox GL JS의 **GeoJSON source + circle layer** 사용
- 매 프레임마다 GeoJSON source의 좌표를 업데이트 (`source.setData()`)
- `requestAnimationFrame` 기반 애니메이션 루프

### 선수 점 스타일

| 상태 | 색상 | 크기 | 투명도 |
|---|---|---|---|
| 기본 (코스 위) | `#FBBF24` (amber-400) | `3px` | `0.7` |
| 출발 전 | `#6B7280` (gray-500) | `2px` | `0.3` |
| 완주 | `#34D399` (emerald-400) | `3px` | `0.5` |
| 검색 하이라이트 | `#F43F5E` (rose-500) | `8px` | `1.0` |
| hover/선택 | `#FFFFFF` | `10px` | `1.0` |

### 데이터 밀도 대응
- **줌 레벨에 따른 점 크기 보간**:
  - 줌 11 (전체 코스) → 점 크기 `2px` (밀집 시 겹침 방지)
  - 줌 14 (중간) → 점 크기 `4px`
  - 줌 16 (확대) → 점 크기 `6px`
- **투명도 조절**: 밀집 구간에서는 낮은 투명도가 자연스러운 밀도감 표현
- 별도의 군집(clustering) 처리 없이 개별 점 렌더링

### 애니메이션 보간
- 각 선수의 스플릿 시간(출발, 5K, 10K, 15K, 도착) 사이를 **선형 보간**
- 체크포인트 간 코스 경로를 따라 점이 이동 (직선 아닌 경로 따라감)
- 보간 공식: 현재 시간이 두 체크포인트 사이일 때, 해당 구간 코스 경로상 비례 위치 계산

---

## TopBar 상세

```
┌──────────────────────────────────────────────────────────┐
│  ← 뒤로    2026 Run Your Way Half Race Seoul     ⚙ 설정  │
└──────────────────────────────────────────────────────────┘
```

- **높이**: `56px`
- **배경**: `rgba(17, 24, 39, 0.85)` (gray-900, 85% 불투명) + `backdrop-filter: blur(8px)`
- **뒤로가기**: `←` 아이콘, 클릭 시 메인 페이지(`/`)로 이동
- **대회명**: `font-size: 16px`, `font-weight: 600`, `color: #FFFFFF`, 중앙 정렬
- **설정 버튼**: 기어 아이콘 — MVP에서는 placeholder (향후 점 크기/색상 조절 등)

---

## Timeline 상세

```
┌──────────────────────────────────────────────────────────┐
│                                                          │
│   ◀◀   ▶ ︎  ▶▶     1x ▾     ───────●──────   01:23:45   │
│                                              / 03:10:00  │
└──────────────────────────────────────────────────────────┘
```

### 구성 요소

| 요소 | 설명 |
|---|---|
| `◀◀` (되감기) | 10초 뒤로 이동 |
| `▶` (재생/일시정지) | 토글 버튼. 재생 중이면 `❚❚` 표시 |
| `▶▶` (빨리감기) | 10초 앞으로 이동 |
| `1x ▾` (배속 선택) | 드롭다운: 1x, 2x, 5x, 10x, 30x |
| 시간 슬라이더 | 전체 레이스 시간 범위, 드래그로 특정 시점 이동 |
| 경과 시간 | `HH:MM:SS / HH:MM:SS` (현재 / 전체) |

### 스타일
- **높이**: `72px`
- **배경**: `rgba(17, 24, 39, 0.9)` + `backdrop-filter: blur(8px)`
- **위치**: 화면 하단 고정, 좌우 `16px` 마진, 하단 `16px` 마진, `border-radius: 16px`
- **버튼**: `36px × 36px`, `border-radius: 50%`, 아이콘 `color: #FFFFFF`
  - hover: `background: rgba(255,255,255,0.1)`
  - 재생 버튼은 약간 더 크게: `44px × 44px`
- **슬라이더 트랙**: `height: 4px`, `background: #374151` (gray-700), `border-radius: 2px`
- **슬라이더 진행바**: `background: #3B82F6` (blue-500)
- **슬라이더 핸들**: `width: 14px`, `height: 14px`, 원형, `background: #FFFFFF`, 드래그 가능
- **경과 시간**: `font-size: 14px`, `font-family: monospace`, `color: #D1D5DB` (gray-300)
- **배속 드롭다운**: pill 형태, `font-size: 13px`, `color: #93C5FD` (blue-300), 클릭 시 위로 팝업

### 슬라이더 체크포인트 마커
슬라이더 트랙 위에 체크포인트 위치를 작은 점으로 표시:

```
    출발  5K    10K       15K      도착
     ●────●─────●─────────●────────●
           ▲
         현재 위치 (핸들)
```

- 체크포인트 점: `4px` 원, `color: #6B7280`
- 현재 재생 위치의 체크포인트에 도달하면 점 색상 변경: `#60A5FA`

---

## StatsPanel 상세

```
┌────────────────────┐
│  경과 시간          │
│  01:23:45          │
│                    │
│  ─────────────     │
│                    │
│  🏃 코스 위  7,341  │
│  🏁 완주      342  │
│  ⏳ 출발 전  1,523  │
│                    │
│  ─────────────     │
│                    │
│  선두  김○○  01:02  │
│  중간  박○○  01:45  │
│  후미  이○○  02:15  │
└────────────────────┘
```

### 구성 요소

| 섹션 | 내용 |
|---|---|
| 경과 시간 | 현재 재생 시간 (큰 글씨) |
| 참가자 분포 | 코스 위 / 완주 / 출발 전 인원 (실시간 업데이트) |
| 선두/중간/후미 | 각 위치의 대표 선수명 + 기록 |

### 스타일
- **위치**: 좌측 하단, Timeline 위 `16px`
- **크기**: `width: 220px`, 높이는 콘텐츠에 따라 가변
- **배경**: `rgba(17, 24, 39, 0.85)` + `backdrop-filter: blur(8px)`
- **모서리**: `border-radius: 12px`
- **패딩**: `16px`
- **경과 시간**: `font-size: 32px`, `font-weight: 700`, `font-family: monospace`, `color: #FFFFFF`
- **참가자 수**: `font-size: 14px`, `color: #D1D5DB`
  - 숫자: `font-weight: 600`, `font-family: monospace`
  - 코스 위: `color: #FBBF24` (amber)
  - 완주: `color: #34D399` (emerald)
  - 출발 전: `color: #6B7280` (gray)
- **선두/후미 섹션**: `font-size: 13px`, `color: #9CA3AF`
- **구분선**: `1px solid rgba(255,255,255,0.1)`

---

## SearchPanel 상세

### 닫힌 상태
```
┌───────┐
│  🔍   │  ← 아이콘 버튼만 표시
└───────┘
```

### 열린 상태
```
┌───────────────────────┐
│ 🔍  선수 이름 검색...   │ ← 텍스트 입력
├───────────────────────┤
│  김민수  01:32:45     │ ← 검색 결과 리스트
│  김민지  01:45:12     │
│  김민호  02:01:33     │
└───────────────────────┘
```

### 동작
| 액션 | 결과 |
|---|---|
| 검색 아이콘 클릭 | 패널 열림, 입력 필드 포커스 |
| 이름 입력 (2글자+) | 실시간 필터링, 최대 10건 표시 |
| 결과 항목 클릭 | 해당 선수 점 하이라이트 (rose-500, 8px) + 지도 해당 위치로 패닝 |
| ESC 또는 ✕ 클릭 | 패널 닫힘, 하이라이트 해제 |

### 스타일
- **위치**: 우측 하단, Timeline 위 `16px`
- **닫힌 상태**: `48px × 48px` 원형 버튼
- **열린 상태**: `width: 280px`
- **배경**: `rgba(17, 24, 39, 0.9)` + `backdrop-filter: blur(8px)`
- **입력 필드**: `background: rgba(255,255,255,0.1)`, `color: #FFFFFF`, `placeholder-color: #6B7280`
- **결과 항목**: `padding: 8px 12px`, hover 시 `background: rgba(255,255,255,0.05)`
- **하이라이트 선수**: 결과에 rose-500 점 인디케이터 표시

---

## PlayerTooltip 상세

선수 점을 hover하거나 클릭했을 때 표시:

```
       ┌─────────────────┐
       │  김민수           │
       │  기록: 01:32:45   │
       │  구간: 10K~15K    │
       │  페이스: 4:32/km  │
       └────────┬────────┘
                ●  ← 선수 점
```

- **배경**: `#1F2937` (gray-800), `border: 1px solid #374151`
- **모서리**: `border-radius: 8px`
- **패딩**: `12px`
- **텍스트**: 이름 `font-weight: 600`, `color: #FFFFFF` / 상세 `font-size: 13px`, `color: #9CA3AF`
- **위치**: 점 위에 표시, 화면 밖으로 나가면 자동 방향 조정
- **표시 조건**: hover 시 0.3초 딜레이 후 표시 (점이 밀집된 곳에서 깜빡임 방지)

---

## 인터랙션

| 사용자 액션 | 결과 |
|---|---|
| 페이지 진입 | 코스 데이터 + 결과 데이터 fetch → 지도에 코스 표시, 모든 점 출발선에 배치, 일시정지 상태 |
| 재생 버튼 클릭 | 애니메이션 시작. 경과 시간 증가, 점들이 코스 따라 이동 |
| 일시정지 클릭 | 애니메이션 정지. 현재 시점 유지 |
| 슬라이더 드래그 | 해당 시점으로 모든 점 위치 즉시 업데이트 |
| 배속 변경 | 1x/2x/5x/10x/30x — 시간 흐름 속도 변경 |
| 되감기/빨리감기 | 현재 시점 기준 ±10초 이동 |
| 지도 줌 인/아웃 | 줌 레벨에 따라 점 크기 자동 조절 |
| 선수 점 hover | 0.3초 후 PlayerTooltip 표시 |
| 선수 점 클릭 | 해당 선수 하이라이트 + 툴팁 고정 |
| 선수 검색 | SearchPanel 열림 → 결과 클릭 시 하이라이트 + 지도 패닝 |
| 뒤로가기 | 메인 페이지(`/`)로 이동 |
| 키보드: Space | 재생/일시정지 토글 |
| 키보드: ← / → | 10초 뒤로/앞으로 |
| 키보드: +/- | 배속 증가/감소 |

---

## 반응형 규칙

### 데스크톱 (1024px+)
- 지도: 전체화면
- StatsPanel: 좌측 하단, `width: 220px`
- SearchPanel: 우측 하단
- Timeline: 하단, 좌우 `16px` 마진
- TopBar: 상단 전체 너비

### 태블릿 (768px ~ 1023px)
- 지도: 전체화면
- StatsPanel: `width: 200px`, 폰트 크기 약간 축소
- Timeline: 좌우 `12px` 마진
- 기타 동일

### 모바일 (~767px)
- 지도: 전체화면
- TopBar: 대회명 말줄임 처리 (`text-overflow: ellipsis`)
- Timeline: 좌우 `8px` 마진, 하단 `8px` 마진
  - 되감기/빨리감기 버튼 숨김 (슬라이더 드래그로 대체)
  - 배속 드롭다운: 아이콘만 표시
- StatsPanel: 축소 모드
  - 기본: 경과 시간 + 코스 위 인원만 표시 (한 줄)
  - 탭하면 전체 패널 펼침
- SearchPanel: 상단으로 이동 (TopBar 내 검색 아이콘)
  - 클릭 시 전체 너비 검색 패널 오버레이
- PlayerTooltip: 하단 시트 스타일로 표시

---

## 색상/스타일 가이드

### 색상 팔레트 (리플레이 페이지 전용)

| 용도 | 색상 | 코드 |
|---|---|---|
| 지도 스타일 | Mapbox Dark | `dark-v11` |
| 오버레이 배경 | 반투명 다크 | `rgba(17, 24, 39, 0.85~0.9)` |
| 코스 경로 | 밝은 파랑 | `#60A5FA` |
| 선수 점 (기본) | 앰버 | `#FBBF24` |
| 선수 점 (완주) | 에메랄드 | `#34D399` |
| 선수 점 (출발 전) | 회색 | `#6B7280` |
| 선수 점 (하이라이트) | 로즈 | `#F43F5E` |
| 재생 슬라이더 진행 | 파랑 | `#3B82F6` |
| 텍스트 (주요) | 흰색 | `#FFFFFF` |
| 텍스트 (보조) | 밝은 회색 | `#D1D5DB` |
| 텍스트 (비활성) | 회색 | `#6B7280` |

### 타이포그래피
- 경과 시간: `monospace`, `32px`
- 일반 텍스트: `Inter` + `Pretendard`, `14px`
- 툴팁/라벨: `13px`

### 오버레이 공통 스타일
- `backdrop-filter: blur(8px)`
- `border-radius: 12~16px`
- `border: 1px solid rgba(255,255,255,0.06)` (미세한 경계)
- 그림자 없음 (블러로 충분, 성능 고려)

---

## 성능 고려사항

| 항목 | 전략 |
|---|---|
| 9,000+ 점 렌더링 | Mapbox `circle` 레이어 (WebGL) — DOM 점 아님 |
| 매 프레임 좌표 업데이트 | `requestAnimationFrame` + `source.setData()` |
| GeoJSON 크기 | FeatureCollection 재사용, 좌표만 변경 (GC 최소화) |
| 보간 계산 | 프레임마다 전체 계산 대신, 시간 구간별 사전 계산 캐시 |
| 슬라이더 드래그 | `throttle` 적용 (16ms = 60fps) |
| 지도 줌/패닝 중 | 애니메이션 프레임 유지 (Mapbox 내부 렌더링과 동기화) |
| 검색 필터링 | 클라이언트 사이드, `useMemo` + 디바운스 300ms |

---

## 컴포넌트 트리 (구현 참고)

```
app/
  race/
    [id]/
      page.tsx              ← 리플레이 페이지 (Server Component: 데이터 fetch)
      ReplayClient.tsx      ← Client Component (모든 인터랙티브 UI 래핑)

components/
  replay/
    MapView.tsx             ← Mapbox GL JS 지도 초기화 + 관리
    CourseOverlay.tsx        ← 코스 polyline + 체크포인트 마커
    ParticleLayer.tsx        ← 선수 점 렌더링 + 애니메이션 루프
    TopBar.tsx               ← 상단 네비게이션 바
    Timeline.tsx             ← 재생 컨트롤 + 슬라이더
    StatsPanel.tsx           ← 실시간 통계 패널
    SearchPanel.tsx          ← 선수 검색/하이라이트
    PlayerTooltip.tsx        ← 선수 정보 툴팁
    CheckpointMarker.tsx     ← 체크포인트 마커 컴포넌트
    SpeedSelector.tsx        ← 배속 드롭다운

hooks/
  useRaceAnimation.ts       ← 애니메이션 루프 + 시간 관리 훅
  useParticlePositions.ts   ← 선수 위치 보간 계산 훅
  usePlayerSearch.ts        ← 선수 검색 로직 훅
```

---

## 데이터 흐름

```
page.tsx (Server Component)
  ├─ fetch('/api/races/[id]')         → 코스 경로 (GeoJSON LineString)
  └─ fetch('/api/races/[id]/results') → 선수 스플릿 데이터
       └─ <ReplayClient course={course} results={results} />
            ├─ useRaceAnimation()      → { currentTime, isPlaying, speed, play, pause, seek }
            ├─ useParticlePositions()   → GeoJSON FeatureCollection (매 프레임 갱신)
            │
            ├─ <MapView>
            │    ├─ <CourseOverlay polyline={course} />
            │    ├─ <ParticleLayer positions={positions} highlighted={selectedPlayer} />
            │    └─ <PlayerTooltip player={hoveredPlayer} />
            ├─ <TopBar raceName={race.name} />
            ├─ <StatsPanel stats={currentStats} />
            ├─ <SearchPanel players={results} onSelect={highlightPlayer} />
            └─ <Timeline
                  currentTime={currentTime}
                  totalTime={totalTime}
                  isPlaying={isPlaying}
                  speed={speed}
                  onPlay={play}
                  onPause={pause}
                  onSeek={seek}
                  onSpeedChange={setSpeed}
                />
```
