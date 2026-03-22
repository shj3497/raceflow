
# RaceFlow — 진행 상황

## 현재 Phase: Phase 1 — 기획

## 진행 중인 태스크
| 태스크 | 에이전트 | 상태 | 시작 시간 |
|---|---|---|---|

## 완료된 태스크
| 태스크 | 에이전트 | 완료 시간 | 비고 |
|---|---|---|---|
| Supabase 스키마 마이그레이션 (races, results 테이블) | DATA | 2026-03-22 | races 1건, results 9,206건 적재 완료 |
| 보간 계산 로직 (src/lib/interpolate.ts) | DATA | 2026-03-22 | getPointAtDistance, interpolateRunner, generateAnimationData 구현. Web Worker 호환 |
| API Routes (races, races/[id], races/[id]/results) | DATA | 2026-03-22 | curl 테스트 통과. 9,206건 전체 반환 확인 |
| Supabase 클라이언트 (src/lib/supabase.ts) | DATA | 2026-03-22 | anon(client) + service role(server) 분리 |

## 결정 사항
- Mapbox GL JS 확정 (WebGL 성능 + AI codegen 친화성)
- 개별 점 렌더링 방식 확정 (군집 방식 X)
- Supabase (PostgreSQL) + Next.js API Routes (별도 백엔드 X)
- Figma MCP 양방향 연동 (Stitch는 나중에)

## 블로커
- (없음)
