# RaceFlow

마라톤 레이스를 실시간으로 리플레이하는 웹 서비스. 수천 명의 러너가 실제 코스 위를 달리는 모습을 지도 위에서 시각적으로 확인할 수 있습니다.

[https://github.com/shj3497/raceflow/raw/master/public/video/sample.mp4](https://github.com/shj3497/raceflow/raw/master/public/video/sample.mp4)

## Features

- **실시간 레이스 리플레이** — 9,000명+ 러너의 움직임을 지도 위에 동시 렌더링
- **스플릿 기반 보간 엔진** — 5K/10K/15K/하프 스플릿 데이터로 프레임별 위치를 실시간 계산
- **배속 조절** — 50x / 100x / 200x 배속 지원
- **선수 검색** — 이름/배번으로 특정 러너를 검색하고 하이라이트
- **코스 시각화** — 실제 코스 경로 + 스플릿 지점(5K, 10K, 15K, 하프) 마커 표시
- **실시간 통계** — 코스 위 인원 / 완주 / 미출발 현황 표시

## Demo

[https://github.com/shj3497/raceflow/raw/master/public/video/sample.mp4](https://github.com/shj3497/raceflow/raw/master/public/video/sample.mp4)

## Tech Stack


| 영역        | 기술                                               |
| --------- | ------------------------------------------------ |
| Frontend  | Next.js 16, React 19, TypeScript, Tailwind CSS 4 |
| Map       | MapLibre GL JS + MapTiler                        |
| Database  | Supabase (PostgreSQL)                            |
| Animation | requestAnimationFrame + per-frame 실시간 보간         |
| Data      | myresult.co.kr API 크롤링 → Supabase 적재             |


## Architecture

```
┌─────────────────────────────────────────────────┐
│  Browser                                        │
│  ┌──────────┐  ┌──────────┐  ┌───────────────┐  │
│  │ MapView  │  │ Timeline │  │ SearchPanel   │  │
│  │ (WebGL)  │  │          │  │               │  │
│  └────┬─────┘  └────┬─────┘  └───────────────┘  │
│       │              │                           │
│  ┌────┴──────────────┴────────────────────────┐  │
│  │         ReplayClient (Client Component)    │  │
│  │  useRaceAnimation + computeFramePositions  │  │
│  └────────────────────┬───────────────────────┘  │
│                       │                          │
└───────────────────────┼──────────────────────────┘
                        │ SSR (Server Component)
┌───────────────────────┼──────────────────────────┐
│  Next.js Server       │                          │
│  page.tsx → prepareRunnerWaypoints()             │
│           → Supabase 조회 (races + results)      │
└───────────────────────┼──────────────────────────┘
                        │
                 ┌──────┴──────┐
                 │  Supabase   │
                 │ (PostgreSQL)│
                 └─────────────┘
```

**데이터 흐름:**

1. Server Component에서 Supabase로 레이스 데이터 + 9,206명 결과 조회
2. `prepareRunnerWaypoints()`로 각 러너의 스플릿 → 경유지(waypoint) 변환 (경량)
3. Client에서 `requestAnimationFrame` 루프로 매 프레임 `computeFramePositions()` 호출
4. GeoJSON → MapLibre WebGL 원형 레이어로 렌더링

## Project Structure

```
src/
  app/
    page.tsx                      ← 메인 페이지 (레이스 목록)
    race/[id]/
      page.tsx                    ← 리플레이 Server Component
      ReplayClient.tsx            ← 리플레이 Client Component
  components/
    replay/
      MapView.tsx                 ← 지도 렌더링 (MapLibre GL)
      Timeline.tsx                ← 타임라인 + 배속 컨트롤
      StatsPanel.tsx              ← 실시간 통계
      SearchPanel.tsx             ← 선수 검색
      TopBar.tsx                  ← 상단 바
  hooks/
    useRaceAnimation.ts           ← 애니메이션 루프 + 시간 관리
  lib/
    interpolate.ts                ← 스플릿 → 좌표 보간 엔진
    supabase.ts                   ← Supabase 클라이언트
    types.ts                      ← 공통 타입
scripts/
    build_course_manual.py        ← 코스 좌표 생성 (수동 경유지)
    clean_course.py               ← OSRM 좌표 정리
    crawlers/                     ← myresult.co.kr 크롤러
```

## Getting Started

### Prerequisites

- Node.js 18+
- Supabase 프로젝트 (races, results 테이블)
- MapTiler API Key

### Environment Variables

`.env.local` 파일을 생성하세요:

```env
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
NEXT_PUBLIC_MAPTILER_KEY=your_maptiler_key
```

### Installation

```bash
npm install
npm run dev
```

[http://localhost:3000](http://localhost:3000) 에서 확인할 수 있습니다.

## Course Data

**2026 Run Your Way Half Race Seoul** (하프마라톤, 21.098km)

광화문 → 세종대로 → 숭례문(반환) → 을지로입구 → 을지로3가(반환) → 을지로입구 → 종각 → 종로 → 동대문 → 동묘앞 → 신설동 → 용두 → 답십리 → 장한평 → 군자 → 어린이대공원 → 건대입구 → 잠실대교 → 잠실새내 → 종합운동장

참가자 9,206명의 스플릿 데이터 (5K, 10K, 15K, 하프) 기반으로 실시간 위치를 보간합니다.

## Performance

- **9,206명 동시 렌더링** — WebGL circle 레이어로 60fps 유지
- **per-frame 실시간 보간** — 전체 프레임 사전 계산 대신, 현재 시간의 위치만 즉석 계산
- **Server Component SSR** — 데이터 조회/전처리는 서버에서, 렌더링만 클라이언트에서

