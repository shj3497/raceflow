"""
코스 좌표 정리 스크립트
- 중복 좌표 제거
- 루프/Backtracking (되돌아가는 구간) 감지 및 제거
- 정리된 좌표를 GeoJSON LineString으로 Supabase에 업데이트
- split_points (5K, 10K, 15K, 21.0975K 지점 좌표) 계산 및 저장
"""

import json
import math
import os

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


# ── Step 2: Remove loops (backtracking) ─────────────────

def remove_loops(coords, proximity_km=0.03):
    """
    루프 감지: 좌표 j가 이전 좌표 i에 proximity_km 이내로 접근하면
    i~j 사이 구간이 루프. i에서 j+1로 바로 연결.
    큰 루프부터 제거하되, 작은 루프도 놓치지 않도록 반복.
    """
    changed = True
    while changed:
        changed = False
        i = 0
        new_coords = []
        while i < len(coords):
            new_coords.append(coords[i])
            # i 이후에 i 근처로 돌아오는 지점 찾기
            best_j = None
            for j in range(i + 3, min(i + 150, len(coords))):  # 최대 150포인트 앞까지
                dist = haversine_km(coords[i], coords[j])
                if dist < proximity_km:
                    best_j = j  # 가장 먼 loop-back 선택 (greedy)

            if best_j is not None:
                # i에서 best_j로 점프 (루프 제거)
                skipped = best_j - i - 1
                if skipped > 2:  # 의미있는 루프만 (3개 이상 건너뛸 때)
                    i = best_j
                    changed = True
                    continue

            i += 1

        if changed:
            coords = new_coords

    return coords


# ── Step 3: Remove small backward steps ──────────────────

def remove_backward_steps(coords):
    """
    전체 진행 방향 (start→end)에 대해 역행하는 연속 구간 제거.
    코스 전체가 서→동 방향이므로 lng 기준으로 판단.
    단, 남→북이 주인 구간도 있으므로 직선거리 기반으로 판단.
    """
    if len(coords) < 3:
        return coords

    # 시작점에서의 직선거리가 줄어드는 구간을 감지
    start = coords[0]
    end = coords[-1]

    # "진행도"를 start→end 벡터에 대한 투영으로 정의
    dx = end[0] - start[0]
    dy = end[1] - start[1]
    mag = math.sqrt(dx * dx + dy * dy)
    if mag == 0:
        return coords

    ux, uy = dx / mag, dy / mag  # 단위 벡터

    def progress(coord):
        return (coord[0] - start[0]) * ux + (coord[1] - start[1]) * uy

    # 각 좌표의 progress 계산
    progs = [progress(c) for c in coords]

    # monotonic increasing으로 필터: progress가 이전 최대값보다 작으면 제거
    # 단, 약간의 tolerance 허용 (도로 커브 때문)
    result = [coords[0]]
    max_prog = progs[0]

    for i in range(1, len(coords)):
        if progs[i] >= max_prog - 0.0005:  # ~50m tolerance
            result.append(coords[i])
            if progs[i] > max_prog:
                max_prog = progs[i]

    return result


# ── Step 4: Simplify (minimum spacing) ──────────────────

def simplify_min_distance(coords, min_dist_km=0.01):
    if len(coords) <= 2:
        return coords
    result = [coords[0]]
    for c in coords[1:-1]:
        if haversine_km(result[-1], c) >= min_dist_km:
            result.append(c)
    result.append(coords[-1])
    return result


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


# ── Main ────────────────────────────────────────────────

def main():
    input_path = "/Users/shimhyeokjin/Desktop/my-dev/raceflow/scripts/course_coordinates.json"
    with open(input_path) as f:
        raw_coords = json.load(f)

    print(f"원본 좌표 수: {len(raw_coords)}")

    # Step 1: 중복 제거
    deduped = remove_duplicates(raw_coords)
    print(f"중복 제거 후: {len(deduped)}")

    # Step 2: 루프 제거 (proximity_km=0.03 — 30m 이내로 돌아오면 루프)
    no_loops = remove_loops(deduped, proximity_km=0.03)
    print(f"루프 제거 후: {len(no_loops)}")

    # Step 3: 간소화 (최소 15m 간격)
    simplified = simplify_min_distance(no_loops, min_dist_km=0.015)
    print(f"간소화 후: {len(simplified)}")

    # 총 거리
    cum_dist = cumulative_distances(simplified)
    total_km = cum_dist[-1]
    print(f"\n총 코스 거리: {total_km:.3f} km")
    print(f"시작점 (광화문): [{simplified[0][0]:.6f}, {simplified[0][1]:.6f}]")
    print(f"끝점 (잠실):     [{simplified[-1][0]:.6f}, {simplified[-1][1]:.6f}]")

    # Split points 계산
    split_distances = [5, 10, 15, 21.0975]
    print(f"\n스플릿 지점:")
    for d in split_distances:
        coord = point_at_distance(simplified, cum_dist, d)
        print(f"  {d:>7.4f}K: [{coord[0]:.6f}, {coord[1]:.6f}]")

    # GeoJSON
    geojson = {
        "type": "LineString",
        "coordinates": [[round(c[0], 6), round(c[1], 6)] for c in simplified]
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
