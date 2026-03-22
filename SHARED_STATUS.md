# RaceFlow — 진행 상황

## 현재 Phase: Phase 1 — 데이터 파이프라인 ✅ 완료

## 진행 중인 태스크

| 태스크 | 에이전트 | 상태 | 시작 시간 |
| ------ | -------- | ---- | --------- |

## 완료된 태스크

| 태스크 | 에이전트 | 완료 시간 | 비고 |
| ------ | -------- | --------- | ---- |
| Supabase 스키마 마이그레이션 | 데이터 | 2026-03-22 | races + results 테이블, 이미 적용됨 |
| myresult.co.kr 크롤러 작성 | 데이터 | 2026-03-22 | API 역공학 → 병렬 크롤러 완성 |
| Run Your Way 크롤링 + DB 적재 | 데이터 | 2026-03-22 | 9,206명 전원 수집, Supabase 적재 완료 |
| 메인 페이지 UI 스펙 작성 | DESIGN | 2026-03-22 | docs/design/main-page.md |
| 리플레이 페이지 UI 스펙 작성 | DESIGN | 2026-03-22 | docs/design/replay-page.md |

## 결정 사항

- MapLibre GL JS 확정 (WebGL 성능 + AI codegen 친화성)
- 개별 점 렌더링 방식 확정 (군집 방식 X)
- Supabase (PostgreSQL) + Next.js API Routes (별도 백엔드 X)
- Figma MCP 양방향 연동 (Stitch는 나중에)
- myresult.co.kr API 구조: /api/event/{id}, /api/event/{id}/player/{bib}

## 블로커

- (없음)
