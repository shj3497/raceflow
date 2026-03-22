
# RaceFlow — 진행 상황

## 현재 Phase: Phase 2 — 구현

## 진행 중인 태스크
| 태스크 | 에이전트 | 상태 | 시작 시간 |
|---|---|---|---|

## 완료된 태스크
| 태스크 | 에이전트 | 완료 시간 | 비고 |
|---|---|---|---|
| 메인 페이지 (대회 목록 카드 그리드) | 프론트엔드 | 2026-03-22 | Header, HeroSection, RaceList, RaceCard, Footer 구현 |
| 리플레이 페이지 레이아웃 | 프론트엔드 | 2026-03-22 | TopBar, 전체화면 지도 배치 |
| MapView 컴포넌트 | 프론트엔드 | 2026-03-22 | MapLibre dark 스타일, 코스 polyline, 체크포인트 마커, circle layer |
| ParticleLayer (선수 점 렌더링) | 프론트엔드 | 2026-03-22 | GeoJSON source + circle layer, 상태별 색상/크기, 줌 보간 |
| Timeline 컨트롤 | 프론트엔드 | 2026-03-22 | 재생/일시정지, 배속 1~100x (기본 50x), 키보드 단축키 |
| AnimationEngine | 프론트엔드 | 2026-03-22 | requestAnimationFrame + 프레임 기반 보간 엔진 |
| StatsPanel | 프론트엔드 | 2026-03-22 | 경과 시간, 코스위/완주/출발전 인원 |
| SearchPanel | 프론트엔드 | 2026-03-22 | 이름/배번 검색, 하이라이트, 열기/닫기 |
| Supabase 연동 | 프론트엔드 | 2026-03-22 | mock-data 제거, API Routes + Server Component에서 직접 Supabase 조회 |
| 보간 엔진 통합 | 프론트엔드 | 2026-03-22 | data 에이전트의 interpolate.ts를 프론트엔드에 통합 |

## 결정 사항
- MapLibre GL JS + MapTiler 확정 (Mapbox에서 전환, 오픈소스 + 무료 타일)
- 개별 점 렌더링 방식 확정 (군집 방식 X)
- Supabase (PostgreSQL) + Next.js API Routes (별도 백엔드 X)
- Figma MCP 양방향 연동 (Stitch는 나중에)

## 프론트엔드 구현 현황
### 파일 구조
```
src/
  app/
    page.tsx                    ← 메인 페이지 (Supabase 직접 조회)
    layout.tsx                  ← 공통 레이아웃
    globals.css                 ← Tailwind + MapLibre CSS
    race/[id]/
      page.tsx                  ← 리플레이 페이지 (Supabase 조회 + 보간)
      ReplayClient.tsx          ← 리플레이 Client Component
    api/races/
      route.ts                  ← GET /api/races
      [id]/
        route.ts                ← GET /api/races/[id]
        results/route.ts        ← GET /api/races/[id]/results
  components/
    Header.tsx, Footer.tsx, HeroSection.tsx, RaceCard.tsx, RaceList.tsx
    replay/
      MapView.tsx, TopBar.tsx, Timeline.tsx, StatsPanel.tsx, SearchPanel.tsx
  hooks/
    useRaceAnimation.ts         ← 애니메이션 루프 + 시간 관리
  lib/
    types.ts                    ← 공통 타입 정의 (DB 스키마 기반)
    supabase.ts                 ← Supabase 클라이언트
    interpolate.ts              ← 스플릿 → 프레임별 좌표 보간 엔진
    animation.ts                ← 프레임 GeoJSON 빌더 + 통계 계산
    utils.ts                    ← 유틸리티 (시간 포맷, 거리 라벨 등)
```

### 데이터 흐름
- 메인 페이지: Server Component → Supabase 직접 조회
- 리플레이 페이지: Server Component → Supabase 조회 → interpolate.ts로 보간 → Client로 전달
- API Routes도 제공 (외부 접근용)

## 블로커
- NEXT_PUBLIC_MAPTILER_KEY 환경변수 설정 필요 (지도 렌더링용)
- NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY 설정 필요
