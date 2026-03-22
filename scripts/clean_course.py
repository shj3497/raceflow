"""
코스 좌표 정리 스크립트 (v2)
- 중복 좌표 제거
- 루프/Backtracking 감지 및 제거 (다중 패스)
- 정리된 좌표를 GeoJSON LineString으로 출력
- split_points (5K, 10K, 15K, 21.0975K 지점) 계산

Usage:
  python3 scripts/clean_course.py <input_file>
  python3 scripts/clean_course.py  # 기본: course_v2_raw.json
"""

import json
import math
import os
import sys

# ── Haversine distance ──────────────────────────────────

def haversine_km(a, b):
    """두 [lng, lat] 좌표 간 거리(km)"""
    lng1, lat1 = a
    lng2, lat2 = b
    R = 6371.0
    dlat = math.radians(lat2 - lat1)
    dlng = math.radians(lng2 - lng1)
    h = (math.sin(dlat / 2) ** 2 +
         math.cos(math.radians(lat1)) * math.cos(math.radians(lat2)) *
         math.sin(dlng / 2) ** 2)
    return R * 2 * math.atan2(math.sqrt(h), math.sqrt(1 - h))


# ── Step 1: Remove consecutive duplicates ───────────────

def remove_duplicates(coords):
    if not coords:
        return coords
    cleaned = [coords[0]]
    for c in coords[1:]:
        if c[0] != cleaned[-1][0] or c[1] != cleaned[-1][1]:
            cleaned.append(c)
    return cleaned


# ── Step 2: Remove loops ────────────────────────────────

def remove_loops(coords, proximity_km=0.03, max_lookback=200):
    """
    루프 감지: 좌표 j가 이전 좌표 i에 proximity_km 이내로 접근하면
    i~j 사이 구간이 루프. i에서 j로 점프 (루프 건너뜀).
    가장 먼 j를 선택해 최대한 큰 루프를 한번에 제거.
    변경이 없을 때까지 반복.
    """
    iteration = 0
    changed = True
    while changed:
        changed = False
        iteration += 1
        i = 0
        new_coords = []
        while i < len(coords):
            new_coords.append(coords[i])
            # i 이후에 i 근처로 돌아오는 가장 먼 지점 찾기
            best_j = None
            for j in range(i + 3, min(i + max_lookback, len(coords))):
                dist = haversine_km(coords[i], coords[j])
                if dist < proximity_km:
                    best_j = j

            if best_j is not None:
                skipped = best_j - i - 1
                if skipped > 2:
                    i = best_j
                    changed = True
                    continue

            i += 1

        if changed:
            coords = new_coords
            print(f"  루프 제거 패스 {iteration}: {len(coords)}개")

    return coords


# ── Step 3: Remove backward segments ────────────────────

def remove_backward_segments(coords, window=5, threshold_deg=140):
    """
    연속 세그먼트의 방위각이 급격히 반전(>threshold_deg)되는 구간 감지.
    U턴 후 원래 경로로 돌아올 때까지의 좌표를 제거.
    """
    def bearing(a, b):
        lng1, lat1 = math.radians(a[0]), math.radians(a[1])
        lng2, lat2 = math.radians(b[0]), math.radians(b[1])
        dlng = lng2 - lng1
        x = math.sin(dlng) * math.cos(lat2)
        y = (math.cos(lat1) * math.sin(lat2) -
             math.sin(lat1) * math.cos(lat2) * math.cos(dlng))
        return math.degrees(math.atan2(x, y)) % 360

    def angle_diff(a, b):
        d = abs(a - b) % 360
        return d if d <= 180 else 360 - d

    if len(coords) < 10:
        return coords

    # 이동 평균 방위각 계산 (window 크기)
    bearings = []
    for i in range(len(coords) - 1):
        if haversine_km(coords[i], coords[i+1]) > 0.001:
            bearings.append(bearing(coords[i], coords[i+1]))
        else:
            bearings.append(bearings[-1] if bearings else 0)

    # U턴 지점 찾기
    keep = [True] * len(coords)
    i = 0
    while i < len(bearings) - 1:
        diff = angle_diff(bearings[i], bearings[i+1])
        if diff > threshold_deg:
            # U턴 감지 — 원래 방향으로 돌아올 때까지 제거
            original_bearing = bearings[i]
            start_idx = i + 1
            end_idx = None
            for j in range(start_idx + 1, min(start_idx + 50, len(bearings))):
                if angle_diff(original_bearing, bearings[j]) < 60:
                    end_idx = j
                    break
            if end_idx is not None and end_idx - start_idx > 2:
                for k in range(start_idx, end_idx):
                    keep[k + 1] = False
                i = end_idx
                continue
        i += 1

    return [c for c, k in zip(coords, keep) if k]


# ── Step 4: Simplify (minimum spacing) ──────────────────

def simplify_min_distance(coords, min_dist_km=0.015):
    if len(coords) <= 2:
        return coords
    result = [coords[0]]
    for c in coords[1:-1]:
        if haversine_km(result[-1], c) >= min_dist_km:
            result.append(c)
    result.append(coords[-1])
    return result


# ── Step 5: Remove detours (shortcut detector) ──────────

def remove_detours(coords, proximity_km=0.5, min_detour_km=0.8, min_gap=10):
    """
    디투어 감지: 좌표 i와 j가 proximity_km 이내인데 경로 거리가 min_detour_km 이상이면
    i~j 사이가 불필요한 우회. i에서 j로 직접 연결.
    가장 큰 디투어부터 반복 제거.
    """
    changed = True
    while changed:
        changed = False
        # 누적 거리 계산
        cum = [0.0]
        for i in range(1, len(coords)):
            cum.append(cum[-1] + haversine_km(coords[i-1], coords[i]))

        best_saving = 0
        best_i, best_j = -1, -1

        for i in range(len(coords)):
            for j in range(i + min_gap, min(i + 200, len(coords))):
                d_straight = haversine_km(coords[i], coords[j])
                if d_straight < proximity_km:
                    d_route = cum[j] - cum[i]
                    saving = d_route - d_straight
                    if saving > min_detour_km and saving > best_saving:
                        best_saving = saving
                        best_i, best_j = i, j

        if best_i >= 0:
            print(f"  디투어 제거: idx {best_i}→{best_j}, 절약 {best_saving:.2f}km")
            coords = coords[:best_i + 1] + coords[best_j:]
            changed = True

    return coords


# ── Step 6: Remove remaining micro-backtracks ───────────

def remove_micro_backtracks(coords, proximity_km=0.05):
    """
    짧은 거리(proximity_km 이내)에서 되돌아오는 micro U턴 제거.
    """
    changed = True
    while changed:
        changed = False
        new_coords = [coords[0]]
        i = 1
        while i < len(coords) - 1:
            dist_skip = haversine_km(coords[i-1], coords[i+1])
            dist_via = haversine_km(coords[i-1], coords[i]) + haversine_km(coords[i], coords[i+1])
            if dist_via > dist_skip * 3 and dist_skip < proximity_km:
                changed = True
                i += 1
                continue
            new_coords.append(coords[i])
            i += 1
        if i == len(coords) - 1:
            new_coords.append(coords[-1])
        coords = new_coords
    return coords


# ── Utilities ───────────────────────────────────────────

def cumulative_distances(coords):
    cum = [0.0]
    for i in range(1, len(coords)):
        cum.append(cum[-1] + haversine_km(coords[i-1], coords[i]))
    return cum


def point_at_distance(coords, cum_dist, target_km):
    if target_km <= 0:
        return coords[0]
    total = cum_dist[-1]
    if target_km >= total:
        return coords[-1]
    for i in range(1, len(cum_dist)):
        if cum_dist[i] >= target_km:
            seg_len = cum_dist[i] - cum_dist[i-1]
            if seg_len == 0:
                return coords[i]
            t = (target_km - cum_dist[i-1]) / seg_len
            lng = coords[i-1][0] + (coords[i][0] - coords[i-1][0]) * t
            lat = coords[i-1][1] + (coords[i][1] - coords[i-1][1]) * t
            return [round(lng, 6), round(lat, 6)]
    return coords[-1]


def total_distance(coords):
    return sum(haversine_km(coords[i], coords[i+1]) for i in range(len(coords)-1))


# ── Main ────────────────────────────────────────────────

def main():
    # 입력 파일 결정
    if len(sys.argv) > 1:
        input_path = sys.argv[1]
    else:
        input_path = "/Users/shimhyeokjin/Desktop/my-dev/raceflow/scripts/course_v2_raw.json"

    with open(input_path) as f:
        raw_coords = json.load(f)

    print(f"원본 좌표 수: {len(raw_coords)}")
    print(f"원본 거리: {total_distance(raw_coords):.3f} km")

    # Step 1: 중복 제거
    coords = remove_duplicates(raw_coords)
    print(f"\n[1] 중복 제거: {len(raw_coords)} → {len(coords)}")

    # Step 2: 루프 제거 (proximity 30m, 최대 200포인트 룩어헤드)
    print(f"\n[2] 루프 제거 시작...")
    coords = remove_loops(coords, proximity_km=0.03, max_lookback=250)
    print(f"  결과: {len(coords)}개, {total_distance(coords):.3f} km")

    # Step 2b: 더 넓은 proximity로 한번 더 (50m)
    print(f"\n[2b] 넓은 proximity 루프 제거...")
    coords = remove_loops(coords, proximity_km=0.05, max_lookback=100)
    print(f"  결과: {len(coords)}개, {total_distance(coords):.3f} km")

    # Step 3: 디투어 제거 (직선 1km 이내인데 경로가 직선의 2배 이상인 구간)
    print(f"\n[3] 디투어 제거...")
    coords = remove_detours(coords, proximity_km=1.0, min_detour_km=0.8, min_gap=10)
    print(f"  결과: {len(coords)}개, {total_distance(coords):.3f} km")

    # Step 4: U턴 기반 역행 제거
    before = len(coords)
    coords = remove_backward_segments(coords)
    print(f"\n[4] U턴 역행 제거: {before} → {len(coords)}, {total_distance(coords):.3f} km")

    # Step 5: Micro-backtrack 제거
    before = len(coords)
    coords = remove_micro_backtracks(coords, proximity_km=0.03)
    print(f"\n[5] Micro-backtrack 제거: {before} → {len(coords)}, {total_distance(coords):.3f} km")

    # Step 5b: 루프 재확인 (디투어 제거 후 새로운 루프 가능)
    coords = remove_loops(coords, proximity_km=0.03, max_lookback=100)
    print(f"\n[5b] 루프 재확인: {len(coords)}개, {total_distance(coords):.3f} km")

    # Step 6: 간소화 (최소 15m 간격)
    coords = simplify_min_distance(coords, min_dist_km=0.015)
    print(f"\n[6] 간소화: {len(coords)}개, {total_distance(coords):.3f} km")

    # 최종 결과
    cum_dist = cumulative_distances(coords)
    total_km = cum_dist[-1]
    print(f"\n{'='*50}")
    print(f"최종 좌표 수: {len(coords)}")
    print(f"총 코스 거리: {total_km:.3f} km")
    print(f"시작점 (광화문): [{coords[0][0]:.6f}, {coords[0][1]:.6f}]")
    print(f"끝점 (잠실):     [{coords[-1][0]:.6f}, {coords[-1][1]:.6f}]")

    # Split points 계산
    split_distances = [5, 10, 15, 21.0975]
    print(f"\n스플릿 지점:")
    for d in split_distances:
        coord = point_at_distance(coords, cum_dist, d)
        print(f"  {d:>7.4f}K: [{coord[0]:.6f}, {coord[1]:.6f}]")

    # GeoJSON
    geojson = {
        "type": "LineString",
        "coordinates": [[round(c[0], 6), round(c[1], 6)] for c in coords]
    }

    # 저장
    output_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), "course_cleaned.json")
    with open(output_path, "w") as f:
        json.dump(geojson, f, indent=2)
    print(f"\n정리된 좌표 저장: {output_path}")

    # Supabase 업데이트용 JSON
    result = {
        "course_gpx": geojson,
        "split_points": split_distances
    }
    print("\n=== SUPABASE UPDATE DATA ===")
    print(json.dumps(result))

    return result


if __name__ == "__main__":
    main()
