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
| 메인 페이지 구현 | FRONTEND | 2026-03-22 | Header, HeroSection, RaceList, RaceCard, Footer |
| 리플레이 페이지 구현 | FRONTEND | 2026-03-22 | MapView, Timeline, StatsPanel, SearchPanel |
| 애니메이션 엔진 | FRONTEND | 2026-03-22 | useRaceAnimation + requestAnimationFrame |

## 결정 사항

- MapLibre GL JS + MapTiler 확정 (Mapbox에서 전환, 오픈소스 + 무료 타일)
- 개별 점 렌더링 방식 확정 (군집 방식 X)
- Supabase (PostgreSQL) + Next.js API Routes (별도 백엔드 X)
- Figma MCP 양방향 연동 (Stitch는 나중에)
- myresult.co.kr API 구조: /api/event/{id}, /api/event/{id}/player/{bib}

## 블로커

- NEXT_PUBLIC_MAPTILER_KEY 환경변수 설정 필요 (지도 렌더링용)
