"""
수동 경유지 기반 코스 생성 스크립트 (v5)

OSRM이 계속 우회하므로, 핵심 경유지를 수동 지정하고
직선 보간으로 코스를 생성한다.

경로: 광화문 → 세종대로 남쪽 → 숭례문 → 을지로입구 → 을지로3가(반환)
      → 을지로입구 → 종각역 → 종로 동쪽 → 동대문 → ... → 종합운동장
"""

import json
import math
import os

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


def interpolate_segment(a, b, max_spacing_km=0.05):
    """두 점 사이를 max_spacing_km 간격으로 보간"""
    dist = haversine_km(a, b)
    if dist <= max_spacing_km:
        return [a]
    n = max(2, int(math.ceil(dist / max_spacing_km)))
    points = []
    for i in range(n):
        t = i / n
        lng = a[0] + (b[0] - a[0]) * t
        lat = a[1] + (b[1] - a[1]) * t
        points.append([round(lng, 6), round(lat, 6)])
    return points


def build_course(waypoints, max_spacing_km=0.05):
    """경유지 배열을 보간하여 촘촘한 코스 생성"""
    coords = []
    for i in range(len(waypoints) - 1):
        segment = interpolate_segment(waypoints[i], waypoints[i+1], max_spacing_km)
        coords.extend(segment)
    coords.append(waypoints[-1])
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


# ── 핵심 경유지 정의 ──────────────────────────────────
# [lng, lat] 형식

# 구간 1: 광화문 → 숭례문 (세종대로 남쪽, ~1.7km)
GWANGHWAMUN_TO_SUNGNYEMUN = [
    [126.976889, 37.575817],  # 광화문 출발
    [126.976950, 37.574500],  # 세종대로 (교보문고 앞)
    [126.977000, 37.573000],  # 세종대로 (세종문화회관)
    [126.977050, 37.571500],  # 세종대로
    [126.977080, 37.570000],  # 세종대로 (덕수궁 서쪽)
    [126.977100, 37.568500],  # 세종대로 (시청역 앞)
    [126.977100, 37.567000],  # 세종대로
    [126.977100, 37.565500],  # 세종대로 (대한문)
    [126.977050, 37.564000],  # 세종대로
    [126.976800, 37.562500],  # 세종대로 남쪽
    [126.976200, 37.561000],  # 숭례문 방면
    [126.975500, 37.560100],  # 숭례문 (반환)
]

# 구간 2: 숭례문 → 을지로입구역 (북동쪽, ~1.0km)
SUNGNYEMUN_TO_EULJIRO1 = [
    [126.976000, 37.560500],  # 숭례문 → 남대문로 진입
    [126.977000, 37.561200],  # 남대문로
    [126.978200, 37.562000],  # 남대문로
    [126.979500, 37.563000],  # 남대문로 → 을지로 방면
    [126.980500, 37.564000],  #
    [126.981500, 37.565000],  # 을지로입구역 근처
    [126.982619, 37.566014],  # 을지로입구역
]

# 구간 3: 을지로입구역 → 을지로3가역 12번출구 (동쪽, ~0.8km)
EULJIRO1_TO_EULJIRO3 = [
    [126.984000, 37.566100],  # 을지로 동쪽
    [126.985500, 37.566150],  # 을지로
    [126.987000, 37.566200],  # 을지로2가역
    [126.988500, 37.566250],  # 을지로
    [126.990000, 37.566350],  # 을지로
    [126.991806, 37.566534],  # 을지로3가역 12번출구 (반환점)
]

# 구간 4: 을지로3가역 → 을지로입구역 (서쪽 반환, ~0.8km)
EULJIRO3_TO_EULJIRO1 = [
    [126.990000, 37.566350],  # 반환 서쪽
    [126.988500, 37.566250],  #
    [126.987000, 37.566200],  # 을지로2가역
    [126.985500, 37.566150],  #
    [126.984000, 37.566100],  #
    [126.982619, 37.566014],  # 을지로입구역
]

# 구간 5: 을지로입구역 → 종각역 (북쪽, ~0.6km)
EULJIRO1_TO_JONGGAK = [
    [126.982700, 37.567000],  # 을지로입구 → 종로 방면
    [126.982800, 37.568000],  #
    [126.982900, 37.569000],  #
    [126.983000, 37.570000],  #
    [126.983100, 37.571000],  #
    [126.983240, 37.571470],  # 종각역
]

# 구간 6: 종각역 → 종합운동장 (종로→동대문→성수→잠실)
# 종로 구간 (종각→동대문)
JONGGAK_TO_DONGDAEMUN = [
    [126.985000, 37.571300],  # 종로
    [126.987000, 37.571100],  # 종로
    [126.989000, 37.571000],  # 종로
    [126.991000, 37.570900],  # 종로
    [126.993000, 37.570800],  # 종로
    [126.995000, 37.570700],  # 종로
    [126.997570, 37.571020],  # 종로5가역
]

# 동대문 → 동묘앞 → 신설동
DONGDAEMUN_AREA = [
    [126.999000, 37.571100],  #
    [127.001000, 37.571200],  #
    [127.003000, 37.571100],  #
    [127.005000, 37.571000],  #
    [127.007000, 37.570800],  #
    [127.009180, 37.571440],  # 동대문역
    [127.011000, 37.571500],  # 동묘앞역 방면
    [127.013000, 37.571800],  #
    [127.016380, 37.572100],  # 신설동역
]

# 용두 → 답십리 → 장한평
YONGDU_TO_JANGHANPYEONG = [
    [127.018500, 37.572300],  # 용두역 방면
    [127.021050, 37.572610],  # 용두역
    [127.023000, 37.572400],  # 답십리 방면
    [127.025000, 37.572000],  #
    [127.027080, 37.572490],  # 답십리역 (5호선)
]

# 장한평 → 군자 → 어린이대공원 → 건대입구
JANGHANPYEONG_TO_KONDAE = [
    [127.029000, 37.571500],  #
    [127.031000, 37.570500],  #
    [127.033000, 37.570000],  #
    [127.035000, 37.570200],  #
    [127.037110, 37.570330],  # 장한평역
    [127.039000, 37.569500],  #
    [127.041000, 37.568500],  #
    [127.043000, 37.567500],  #
    [127.044650, 37.566770],  # 군자역
    [127.046500, 37.566000],  #
    [127.048220, 37.565000],  # 어린이대공원역 방면
    [127.050000, 37.564000],  #
    [127.052000, 37.563000],  #
    [127.054000, 37.561500],  #
    [127.054960, 37.556930],  # 건대입구역 방면 (남쪽으로)
]

# 잠실대교 → 잠실새내 → 종합운동장
JAMSIL_BRIDGE = [
    [127.058000, 37.556000],  # 잠실대교 진입 전
    [127.061780, 37.553420],  # 잠실대교 위
    [127.065000, 37.550000],  # 잠실대교
    [127.068000, 37.547000],  #
    [127.069305, 37.545270],  # 잠실대교 남단
    [127.070000, 37.543000],  # 올림픽대로
    [127.071000, 37.540000],  #
    [127.070500, 37.537000],  # 잠실 방면
    [127.069000, 37.535000],  #
    [127.072000, 37.533000],  #
    [127.075000, 37.531000],  #
    [127.074500, 37.529000],  #
    [127.076000, 37.528000],  #
    [127.079000, 37.527500],  # 잠실새내역 방면
    [127.082000, 37.527200],  #
    [127.085000, 37.527400],  #
    [127.088000, 37.528000],  #
    [127.089500, 37.527000],  # 올림픽공원 방면
    [127.093000, 37.522000],  #
    [127.095000, 37.519500],  #
    [127.097000, 37.517000],  #
    [127.098500, 37.515200],  #
    [127.097000, 37.512500],  # 종합운동장 방면
    [127.092000, 37.512000],  #
    [127.088000, 37.511500],  #
    [127.085000, 37.511600],  #
    [127.082000, 37.511800],  #
    [127.079000, 37.511900],  #
    [127.078000, 37.513000],  #
    [127.077500, 37.515400],  #
    [127.075000, 37.515200],  #
    [127.074793, 37.515433],  # 종합운동장 (도착)
]


def main():
    # 모든 구간 합치기
    all_waypoints = (
        GWANGHWAMUN_TO_SUNGNYEMUN +
        SUNGNYEMUN_TO_EULJIRO1 +
        EULJIRO1_TO_EULJIRO3 +
        EULJIRO3_TO_EULJIRO1 +
        EULJIRO1_TO_JONGGAK +
        JONGGAK_TO_DONGDAEMUN +
        DONGDAEMUN_AREA +
        YONGDU_TO_JANGHANPYEONG +
        JANGHANPYEONG_TO_KONDAE +
        JAMSIL_BRIDGE
    )

    print(f"핵심 경유지: {len(all_waypoints)}개")
    print(f"경유지 간 직선 거리 합계: {total_distance(all_waypoints):.3f}km")

    # 50m 간격으로 보간
    course = build_course(all_waypoints, max_spacing_km=0.05)
    total_km = total_distance(course)
    print(f"\n보간 후 좌표: {len(course)}개")
    print(f"총 거리: {total_km:.3f}km")

    # 경유지별 누적 거리 출력
    print("\n주요 지점별 거리:")
    landmarks = {
        "광화문": GWANGHWAMUN_TO_SUNGNYEMUN[0],
        "숭례문": GWANGHWAMUN_TO_SUNGNYEMUN[-1],
        "을지로입구 (1차)": SUNGNYEMUN_TO_EULJIRO1[-1],
        "을지로3가 (반환)": EULJIRO1_TO_EULJIRO3[-1],
        "을지로입구 (복귀)": EULJIRO3_TO_EULJIRO1[-1],
        "종각역": EULJIRO1_TO_JONGGAK[-1],
        "종로5가": JONGGAK_TO_DONGDAEMUN[-1],
        "동대문역": DONGDAEMUN_AREA[5],
        "신설동역": DONGDAEMUN_AREA[-1],
        "용두역": YONGDU_TO_JANGHANPYEONG[1],
        "답십리역": YONGDU_TO_JANGHANPYEONG[-1],
        "장한평역": JANGHANPYEONG_TO_KONDAE[4],
        "군자역": JANGHANPYEONG_TO_KONDAE[8],
        "건대입구": JANGHANPYEONG_TO_KONDAE[-1],
        "잠실대교 남단": JAMSIL_BRIDGE[4],
        "종합운동장": JAMSIL_BRIDGE[-1],
    }

    cum = cumulative_distances(course)
    for name, coord in landmarks.items():
        # Find closest point in course
        min_dist = float('inf')
        min_idx = 0
        for i, c in enumerate(course):
            d = haversine_km(c, coord)
            if d < min_dist:
                min_dist = d
                min_idx = i
        print(f"  {name:20s}: {cum[min_idx]:.2f}km")

    # Split points
    split_distances = [5, 10, 15, 21.0975]
    print(f"\n스플릿 지점:")
    for d in split_distances:
        coord = point_at_distance(course, cum, d)
        print(f"  {d:>7.4f}K: [{coord[0]:.6f}, {coord[1]:.6f}]")

    # GeoJSON
    geojson = {
        "type": "LineString",
        "coordinates": [[round(c[0], 6), round(c[1], 6)] for c in course]
    }

    script_dir = os.path.dirname(os.path.abspath(__file__))
    output_path = os.path.join(script_dir, "course_cleaned.json")
    with open(output_path, "w") as f:
        json.dump(geojson, f, indent=2)
    print(f"\n저장: {output_path}")
    print(f"시작: [{course[0][0]:.6f}, {course[0][1]:.6f}]")
    print(f"끝:   [{course[-1][0]:.6f}, {course[-1][1]:.6f}]")

    result = {
        "course_gpx": geojson,
        "split_points": split_distances
    }
    print("\n=== SUPABASE UPDATE DATA ===")
    print(json.dumps({"coordinates_count": len(course), "total_km": round(total_km, 3)}))

    return result


if __name__ == "__main__":
    main()
