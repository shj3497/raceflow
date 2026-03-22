# RaceFlow — 진행 상황

## 현재 Phase: Phase 4 — 통합 + QA

## 진행 중인 태스크

| 태스크 | 에이전트 | 상태 | 시작 시간 |
| ------ | -------- | ---- | --------- |

## 완료된 태스크

| 태스크 | 에이전트 | 완료 시간 | 비고 |
| ------ | -------- | --------- | ---- |
| Supabase 스키마 마이그레이션 | 데이터 | 2026-03-22 | races + results 테이블 |
| myresult.co.kr 크롤러 작성 | 데이터 | 2026-03-22 | API 역공학 → 병렬 크롤러 |
| Run Your Way 크롤링 + DB 적재 | 데이터 | 2026-03-22 | 9,206명 수집 + Supabase 적재 |
| 메인 페이지 UI 스펙 | DESIGN | 2026-03-22 | docs/design/main-page.md |
| 리플레이 페이지 UI 스펙 | DESIGN | 2026-03-22 | docs/design/replay-page.md |
| 보간 계산 로직 | DATA | 2026-03-22 | src/lib/interpolate.ts |
| API Routes | DATA | 2026-03-22 | /api/races, /api/races/[id], /api/races/[id]/results |
| Supabase 클라이언트 | DATA | 2026-03-22 | src/lib/supabase.ts |
| 코스 좌표 정리 + DB 업데이트 | DATA | 2026-03-22 | OSRM 기반 광화문→잠실 20.89km, 370 좌표 |
| 메인 페이지 구현 | FRONTEND | 2026-03-22 | Header, HeroSection, RaceList, RaceCard, Footer |
| 리플레이 페이지 구현 | FRONTEND | 2026-03-22 | MapView, Timeline, StatsPanel, SearchPanel |
| 애니메이션 엔진 | FRONTEND | 2026-03-22 | useRaceAnimation + requestAnimationFrame |
| Mock 데이터 제거 + Supabase 연동 | FRONTEND | 2026-03-22 | API Routes + Server Component 직접 조회 |
| 배속 옵션 변경 | FRONTEND | 2026-03-22 | 기본 50x, 옵션 [50, 100, 200] |

## 결정 사항

- MapLibre GL JS + MapTiler 확정 (Mapbox에서 전환, 오픈소스 + 무료 타일)
- 개별 점 렌더링 방식 확정 (군집 방식 X)
- Supabase (PostgreSQL) + Next.js API Routes (별도 백엔드 X)
- Figma MCP 양방향 연동 (Stitch는 나중에)
- myresult.co.kr API 구조: /api/event/{id}, /api/event/{id}/player/{bib}

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

- (해결됨) NEXT_PUBLIC_MAPTILER_KEY 환경변수 → .env.local에 설정 완료
- (해결됨) Supabase 환경변수 → .env.local에 설정 완료
