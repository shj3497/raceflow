"""
코스 좌표 정리 스크립트 (v4)
광화문→숭례문→을지로입구→을지로3가(반환)→을지로입구→종각→...→종합운동장

을지로 왕복 구간이 의도적 반환이므로 두 구간을 분리하여 각각 정리 후 합침.
- Segment A: 광화문 → 을지로3가 반환점 (정방향)
- Segment B: 을지로3가 반환점 → 종합운동장 (역방향 후 동진)
"""

import json
import math
import os

# ── Haversine distance ──────────────────────────────────

def haversine_km(a, b):
    lng1, lat1 = a
    lng2, lat2 = b
    R = 6371.0
    dlat = math.radians(lat2 - lat1)
    dlng = math.radians(lng2 - lng1)
    h = (math.sin(dlat / 2) ** 2 +
         math.cos(math.radians(lat1)) * math.cos(math.radians(lat2)) *
         math.sin(dlng / 2) ** 2)
    return R * 2 * math.atan2(math.sqrt(h), math.sqrt(1 - h))


def total_distance(coords):
    return sum(haversine_km(coords[i], coords[i+1]) for i in range(len(coords)-1))


def remove_duplicates(coords):
    if not coords:
        return coords
    cleaned = [coords[0]]
    for c in coords[1:]:
        if c[0] != cleaned[-1][0] or c[1] != cleaned[-1][1]:
            cleaned.append(c)
    return cleaned


def remove_loops(coords, proximity_km=0.03, max_lookback=200):
    changed = True
    while changed:
        changed = False
        i = 0
        new_coords = []
        while i < len(coords):
            new_coords.append(coords[i])
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
            print(f"    루프 제거: {len(coords)}개")
    return coords


def remove_detours(coords, proximity_km=1.0, min_detour_km=0.8, min_gap=10):
    changed = True
    while changed:
        changed = False
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
            print(f"    디투어 제거: idx {best_i}→{best_j}, 절약 {best_saving:.2f}km")
            coords = coords[:best_i + 1] + coords[best_j:]
            changed = True
    return coords


def remove_backward_segments(coords, threshold_deg=140):
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

    bearings = []
    for i in range(len(coords) - 1):
        if haversine_km(coords[i], coords[i+1]) > 0.001:
            bearings.append(bearing(coords[i], coords[i+1]))
        else:
            bearings.append(bearings[-1] if bearings else 0)

    keep = [True] * len(coords)
    i = 0
    while i < len(bearings) - 1:
        diff = angle_diff(bearings[i], bearings[i+1])
        if diff > threshold_deg:
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


def remove_micro_backtracks(coords, proximity_km=0.05):
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


def simplify_min_distance(coords, min_dist_km=0.015):
    if len(coords) <= 2:
        return coords
    result = [coords[0]]
    for c in coords[1:-1]:
        if haversine_km(result[-1], c) >= min_dist_km:
            result.append(c)
    result.append(coords[-1])
    return result


def clean_segment(coords, name):
    """
    경량 정리: OSRM 아티팩트(소규모 루프, 중복)만 제거.
    디투어/역행 제거는 실제 코스 경로를 날리므로 사용하지 않음.
    """
    print(f"\n{'='*50}")
    print(f"정리 중: {name}")
    print(f"  원본: {len(coords)}개, {total_distance(coords):.3f}km")

    coords = remove_duplicates(coords)
    print(f"  중복 제거: {len(coords)}개")

    # 소규모 루프만 제거 (20m proximity, 짧은 lookback)
    coords = remove_loops(coords, proximity_km=0.02, max_lookback=30)
    print(f"  소규모 루프 제거 (20m): {len(coords)}개, {total_distance(coords):.3f}km")

    # Micro-backtrack만 제거 (매우 보수적)
    coords = remove_micro_backtracks(coords, proximity_km=0.02)
    print(f"  Micro-backtrack: {len(coords)}개, {total_distance(coords):.3f}km")

    # 간소화 (최소 20m 간격)
    coords = simplify_min_distance(coords, min_dist_km=0.020)
    print(f"  간소화: {len(coords)}개, {total_distance(coords):.3f}km")

    return coords


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


def main():
    script_dir = os.path.dirname(os.path.abspath(__file__))

    # Load raw segment files
    with open(os.path.join(script_dir, "course_v4_seg_a.json")) as f:
        seg_a_raw = json.load(f)
    with open(os.path.join(script_dir, "course_v4_seg_b.json")) as f:
        seg_b_raw = json.load(f)

    # Clean each segment independently
    seg_a = clean_segment(seg_a_raw, "Segment A: 광화문→을지로3가 반환점")
    seg_b = clean_segment(seg_b_raw, "Segment B: 을지로3가→을지로입구→종각→종합운동장")

    # Join segments (skip first point of B to avoid duplicate at junction)
    combined = seg_a + seg_b[1:]

    total_km = total_distance(combined)
    print(f"\n{'='*50}")
    print(f"합친 결과: {len(combined)}개, {total_km:.3f}km")
    print(f"시작점 (광화문): [{combined[0][0]:.6f}, {combined[0][1]:.6f}]")
    print(f"끝점 (잠실):     [{combined[-1][0]:.6f}, {combined[-1][1]:.6f}]")

    # Split points
    cum_dist = cumulative_distances(combined)
    split_distances = [5, 10, 15, 21.0975]
    print(f"\n스플릿 지점:")
    for d in split_distances:
        coord = point_at_distance(combined, cum_dist, d)
        print(f"  {d:>7.4f}K: [{coord[0]:.6f}, {coord[1]:.6f}]")

    # GeoJSON
    geojson = {
        "type": "LineString",
        "coordinates": [[round(c[0], 6), round(c[1], 6)] for c in combined]
    }

    # Save
    output_path = os.path.join(script_dir, "course_cleaned.json")
    with open(output_path, "w") as f:
        json.dump(geojson, f, indent=2)
    print(f"\n저장: {output_path}")

    # Supabase update data
    result = {
        "course_gpx": geojson,
        "split_points": split_distances
    }
    print("\n=== SUPABASE UPDATE DATA ===")
    print(json.dumps(result))

    return result


if __name__ == "__main__":
    main()
