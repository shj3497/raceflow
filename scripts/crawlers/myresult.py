"""myresult.co.kr API 크롤러

사용법:
    python scripts/crawlers/myresult.py 141

환경변수:
    SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
"""
import json
import sys
import time
import urllib.request
from concurrent.futures import ThreadPoolExecutor, as_completed

from common import (
    RaceData, RunnerResult,
    parse_time_to_hms, time_point_to_split, upload_race_data,
)

BASE_URL = "https://myresult.co.kr/api"


def fetch_json(url: str) -> dict | list | None:
    """URL에서 JSON을 가져온다. 실패 시 None."""
    try:
        req = urllib.request.Request(url)
        with urllib.request.urlopen(req, timeout=10) as resp:
            return json.loads(resp.read())
    except Exception as e:
        return None


def fetch_event(event_id: int) -> dict:
    """대회 정보 조회"""
    data = fetch_json(f"{BASE_URL}/event/{event_id}")
    if not data or "id" not in data:
        raise RuntimeError(f"대회 정보를 가져올 수 없습니다: event_id={event_id}")
    return data


def find_bib_ranges(event_id: int) -> list[tuple[int, int]]:
    """배번 범위를 이진 탐색으로 찾는다."""
    ranges = []

    def check(n: int) -> bool:
        data = fetch_json(f"{BASE_URL}/event/{event_id}/player/{n}")
        return data is not None and bool(data.get("num"))

    # 알려진 시작점 후보
    candidates = [1, 10000, 20000, 30000, 40000, 50000, 60000]

    for start in candidates:
        if not check(start):
            continue

        # 범위 끝을 이진 탐색
        lo, hi = start, start + 15000
        while hi - lo > 1:
            mid = (lo + hi) // 2
            if check(mid):
                lo = mid
            else:
                hi = mid
        ranges.append((start, lo))
        print(f"  배번 범위 발견: {start} - {lo}")

    return ranges


def fetch_player(event_id: int, bib: int, gun_start: str, split_distances: dict) -> RunnerResult | None:
    """개별 참가자 기록 조회"""
    data = fetch_json(f"{BASE_URL}/event/{event_id}/player/{bib}")
    if not data or not data.get("num"):
        return None

    # 스플릿 계산: records 배열에서 각 체크포인트 통과 시각 추출
    splits = {}
    records = data.get("records", [])
    for rec in records:
        point = rec.get("point", {})
        distance = point.get("distance", "0")
        point_cd = rec.get("point_cd", "")
        time_point = rec.get("time_point")

        # 출발 지점(distance=0)은 스플릿에서 제외
        dist_float = float(distance)
        if dist_float == 0:
            continue

        elapsed = time_point_to_split(gun_start, time_point)
        if elapsed:
            # 거리 키: "5", "10", "15", "21.1"
            dist_key = str(int(dist_float)) if dist_float == int(dist_float) else str(round(dist_float, 1))
            splits[dist_key] = elapsed

    return RunnerResult(
        bib_number=str(data["num"]),
        name=data.get("name", ""),
        gender=data.get("gender", ""),
        age_group=data.get("sector_name", "") or "",
        gross_time=parse_time_to_hms(data.get("result_guntime")),
        net_time=parse_time_to_hms(data.get("result_nettime")),
        splits=splits,
    )


def crawl_myresult(event_id: int) -> RaceData:
    """myresult.co.kr에서 대회 전체 데이터를 크롤링한다."""
    print(f"[myresult] 대회 정보 조회: event_id={event_id}")
    event = fetch_event(event_id)
    course = event["courses"][0]  # 첫 번째 코스 (하프)

    # 코스 경로 → GeoJSON LineString
    path = course.get("path", [])
    course_gpx = {
        "type": "LineString",
        "coordinates": [[p["lng"], p["lat"]] for p in path],
    }

    # 스플릿 포인트 거리
    points = course.get("points", [])
    split_distances = {}
    split_points = []
    for pt in points:
        dist = float(pt["distance"])
        if dist > 0:
            split_distances[pt["point_cd"]] = dist
            split_points.append(dist)

    gun_start = course.get("guntime", "07:30:00")

    race_data = RaceData(
        name=event["name"],
        date=event["date"],
        distance_km=float(course["distance"]),
        source_url=f"https://myresult.co.kr/{event_id}",
        source_type="myresult",
        course_gpx=course_gpx,
        split_points=split_points,
    )

    # 배번 범위 탐색
    print("[myresult] 배번 범위 탐색 중...")
    bib_ranges = find_bib_ranges(event_id)

    # 모든 배번 목록 생성
    all_bibs = []
    for start, end in bib_ranges:
        all_bibs.extend(range(start, end + 1))
    print(f"[myresult] 총 {len(all_bibs)}개 배번 크롤링 시작")

    # 병렬 크롤링
    results = []
    failed = 0
    with ThreadPoolExecutor(max_workers=20) as executor:
        futures = {
            executor.submit(fetch_player, event_id, bib, gun_start, split_distances): bib
            for bib in all_bibs
        }
        for i, future in enumerate(as_completed(futures), 1):
            try:
                result = future.result()
                if result:
                    results.append(result)
            except Exception:
                failed += 1

            if i % 500 == 0:
                print(f"  진행: {i}/{len(all_bibs)} (성공: {len(results)}, 빈배번: {i - len(results) - failed}, 실패: {failed})")

    race_data.results = results
    print(f"[myresult] 크롤링 완료: {len(results)}명 수집 (총 {len(all_bibs)}개 배번 중)")
    return race_data


if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("사용법: python myresult.py <event_id> [--upload]")
        sys.exit(1)

    event_id = int(sys.argv[1])
    do_upload = "--upload" in sys.argv

    race_data = crawl_myresult(event_id)

    # JSON으로 저장
    output_file = f"race_{event_id}.json"
    with open(output_file, "w", encoding="utf-8") as f:
        json.dump({
            "name": race_data.name,
            "date": race_data.date,
            "distance_km": race_data.distance_km,
            "source_url": race_data.source_url,
            "source_type": race_data.source_type,
            "course_gpx": race_data.course_gpx,
            "split_points": race_data.split_points,
            "results_count": len(race_data.results),
            "results": [
                {
                    "bib_number": r.bib_number,
                    "name": r.name,
                    "gender": r.gender,
                    "age_group": r.age_group,
                    "gross_time": r.gross_time,
                    "net_time": r.net_time,
                    "splits": r.splits,
                }
                for r in race_data.results
            ],
        }, f, ensure_ascii=False, indent=2)
    print(f"JSON 저장: {output_file}")

    if do_upload:
        race_id = upload_race_data(race_data)
        print(f"Supabase 적재 완료: race_id={race_id}")
    else:
        print("Supabase 적재를 하려면 --upload 옵션을 추가하세요.")
