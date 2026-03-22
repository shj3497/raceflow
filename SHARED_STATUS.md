
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
| MapView 컴포넌트 | 프론트엔드 | 2026-03-22 | Mapbox dark-v11, 코스 polyline, 체크포인트 마커, circle layer |
| ParticleLayer (선수 점 렌더링) | 프론트엔드 | 2026-03-22 | GeoJSON source + circle layer, 상태별 색상/크기, 줌 보간 |
| Timeline 컨트롤 | 프론트엔드 | 2026-03-22 | 재생/일시정지, 배속 1~30x, 시간 슬라이더, 키보드 단축키 |
| AnimationEngine | 프론트엔드 | 2026-03-22 | requestAnimationFrame 기반 프레임 루프, 보간 엔진 |
| StatsPanel | 프론트엔드 | 2026-03-22 | 경과 시간, 코스위/완주/출발전/DNF 인원 |
| SearchPanel | 프론트엔드 | 2026-03-22 | 이름/배번 검색, 하이라이트, 열기/닫기 |
| Mock 데이터 | 프론트엔드 | 2026-03-22 | 9,206명 목 데이터 생성, 서울 하프 코스 GeoJSON |

## 결정 사항
- Mapbox GL JS 확정 (WebGL 성능 + AI codegen 친화성)
- 개별 점 렌더링 방식 확정 (군집 방식 X)
- Supabase (PostgreSQL) + Next.js API Routes (별도 백엔드 X)
- Figma MCP 양방향 연동 (Stitch는 나중에)

## 프론트엔드 구현 현황
### 파일 구조
```
src/
  app/
    page.tsx                    ← 메인 페이지 (대회 목록)
    layout.tsx                  ← 공통 레이아웃
    globals.css                 ← Tailwind + Mapbox CSS
    race/[id]/
      page.tsx                  ← 리플레이 페이지 (Server Component)
      ReplayClient.tsx          ← 리플레이 Client Component
  components/
    Header.tsx, Footer.tsx, HeroSection.tsx, RaceCard.tsx, RaceList.tsx
    replay/
      MapView.tsx, TopBar.tsx, Timeline.tsx, StatsPanel.tsx, SearchPanel.tsx
  hooks/
    useRaceAnimation.ts         ← 애니메이션 루프 + 시간 관리
  lib/
    types.ts                    ← 공통 타입 정의
    mock-data.ts                ← 목 데이터 (9,206명)
    animation.ts                ← 보간 엔진 + 통계 계산
    utils.ts                    ← 유틸리티 (시간 포맷, 거리 라벨 등)
```

### API 연동 대기 중
- GET /api/races → mockRaces 사용 중
- GET /api/races/[id] → mockRaceDetail 사용 중
- GET /api/races/[id]/results → mockRunners 사용 중

## 블로커
- NEXT_PUBLIC_MAPBOX_TOKEN 환경변수 설정 필요 (지도 렌더링용)
