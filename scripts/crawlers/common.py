"""공통 유틸: 시간 파싱, Supabase 클라이언트, 데이터 모델"""
import os
import re
from dataclasses import dataclass, field, asdict
from datetime import timedelta


def get_supabase():
    from supabase import create_client
    url = os.environ["SUPABASE_URL"]
    key = os.environ["SUPABASE_SERVICE_ROLE_KEY"]
    return create_client(url, key)


@dataclass
class RunnerResult:
    bib_number: str
    name: str
    gender: str          # "M" | "F"
    age_group: str       # 없으면 ""
    gross_time: str | None   # "HH:MM:SS" or None
    net_time: str | None     # "HH:MM:SS" or None
    splits: dict         # {"5": "00:25:30", "10": "00:51:12", ...}


@dataclass
class RaceData:
    name: str
    date: str            # "2026-03-02"
    distance_km: float
    source_url: str
    source_type: str     # "myresult"
    course_gpx: dict | None = None  # GeoJSON LineString
    split_points: list[float] = field(default_factory=list)
    results: list[RunnerResult] = field(default_factory=list)


def parse_time_to_hms(time_str: str | None) -> str | None:
    """'01:13:22.38' 또는 '01:13:22' → 'HH:MM:SS' 형식으로 변환"""
    if not time_str:
        return None
    # 소수점 제거
    clean = time_str.split(".")[0]
    parts = clean.split(":")
    if len(parts) == 3:
        return clean
    return None


def time_point_to_split(gun_start: str, time_point: str) -> str | None:
    """절대 시각(time_point)에서 건타임 시작(gun_start)을 빼서 경과 시간 계산.
    '07:30:00' 기준 '07:46:41' → '00:16:41'
    """
    def to_seconds(t: str) -> int:
        parts = t.split(".")
        hms = parts[0].split(":")
        return int(hms[0]) * 3600 + int(hms[1]) * 60 + int(hms[2])

    try:
        elapsed = to_seconds(time_point) - to_seconds(gun_start)
        if elapsed < 0:
            elapsed += 86400  # 자정 넘김 보정
        h, rem = divmod(elapsed, 3600)
        m, s = divmod(rem, 60)
        return f"{h:02d}:{m:02d}:{s:02d}"
    except (ValueError, IndexError):
        return None


def upload_race_data(race_data: RaceData) -> str:
    """RaceData를 Supabase에 적재. race_id 반환."""
    supabase = get_supabase()

    # 대회 등록
    race_row = {
        "name": race_data.name,
        "date": race_data.date,
        "distance_km": race_data.distance_km,
        "source_url": race_data.source_url,
        "source_type": race_data.source_type,
    }
    if race_data.course_gpx:
        race_row["course_gpx"] = race_data.course_gpx
    if race_data.split_points:
        race_row["split_points"] = race_data.split_points

    resp = supabase.table("races").insert(race_row).execute()
    race_id = resp.data[0]["id"]

    # 결과 일괄 삽입 (500개씩 배치)
    rows = []
    for r in race_data.results:
        rows.append({
            "race_id": race_id,
            "bib_number": r.bib_number,
            "name": r.name,
            "gender": r.gender,
            "age_group": r.age_group,
            "gross_time": r.gross_time,
            "net_time": r.net_time,
            "splits": r.splits,
        })

    batch_size = 500
    for i in range(0, len(rows), batch_size):
        batch = rows[i:i + batch_size]
        supabase.table("results").insert(batch).execute()
        print(f"  적재: {i + len(batch)}/{len(rows)}")

    print(f"완료: race_id={race_id}, {len(rows)}명 적재")
    return race_id
