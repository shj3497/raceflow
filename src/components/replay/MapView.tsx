'use client';

import { useRef, useEffect, useCallback } from 'react';
import maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import type { RaceDetail } from '@/lib/types';
import { getPointAtDistance } from '@/lib/interpolate';

interface MapViewProps {
  race: RaceDetail;
  onMapReady: (map: maplibregl.Map) => void;
}

export default function MapView({ race, onMapReady }: MapViewProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);

  const initMap = useCallback(() => {
    if (!containerRef.current || mapRef.current) return;

    const key = process.env.NEXT_PUBLIC_MAPTILER_KEY;
    if (!key) {
      console.warn('NEXT_PUBLIC_MAPTILER_KEY is not set');
      return;
    }

    const coords = race.course_gpx.coordinates as [number, number][];
    const bounds = coords.reduce(
      (b, c) => {
        b[0][0] = Math.min(b[0][0], c[0]);
        b[0][1] = Math.min(b[0][1], c[1]);
        b[1][0] = Math.max(b[1][0], c[0]);
        b[1][1] = Math.max(b[1][1], c[1]);
        return b;
      },
      [
        [Infinity, Infinity],
        [-Infinity, -Infinity],
      ] as [[number, number], [number, number]],
    );

    const map = new maplibregl.Map({
      container: containerRef.current,
      style: `https://api.maptiler.com/maps/streets-v2-dark/style.json?key=${key}`,
      bounds: new maplibregl.LngLatBounds(bounds[0], bounds[1]),
      fitBoundsOptions: { padding: 60 },
      minZoom: 11,
      maxZoom: 16,
      dragRotate: false,
    });

    map.on('load', () => {
      // Course polyline
      map.addSource('course', {
        type: 'geojson',
        data: {
          type: 'Feature',
          properties: {},
          geometry: race.course_gpx,
        },
      });

      map.addLayer({
        id: 'course-line',
        type: 'line',
        source: 'course',
        paint: {
          'line-color': '#60A5FA',
          'line-width': 3,
          'line-opacity': 0.6,
        },
        layout: {
          'line-cap': 'round',
          'line-join': 'round',
        },
      });

      // Checkpoint markers — split_points is number[] (e.g. [5, 10, 15, 21.0975])
      const courseLS = race.course_gpx as unknown as import('@/lib/interpolate').LineString;
      const checkpointFeatures: GeoJSON.Feature[] = race.split_points.map((distKm) => {
        const coord = getPointAtDistance(courseLS, distKm);
        const label = distKm === race.split_points[race.split_points.length - 1]
          ? 'FINISH'
          : `${distKm}K`;
        return {
          type: 'Feature',
          geometry: { type: 'Point', coordinates: coord },
          properties: { name: label },
        };
      });
      // Add START marker
      const startCoord = race.course_gpx.coordinates[0];
      checkpointFeatures.unshift({
        type: 'Feature',
        geometry: { type: 'Point', coordinates: startCoord },
        properties: { name: 'START' },
      });

      map.addSource('checkpoints', {
        type: 'geojson',
        data: { type: 'FeatureCollection', features: checkpointFeatures },
      });

      map.addLayer({
        id: 'checkpoint-circles',
        type: 'circle',
        source: 'checkpoints',
        paint: {
          'circle-radius': 12,
          'circle-color': '#1F2937',
          'circle-stroke-color': '#60A5FA',
          'circle-stroke-width': 2,
        },
      });

      map.addLayer({
        id: 'checkpoint-labels',
        type: 'symbol',
        source: 'checkpoints',
        layout: {
          'text-field': ['get', 'name'],
          'text-size': 11,
          'text-allow-overlap': true,
        },
        paint: {
          'text-color': '#FFFFFF',
        },
      });

      // Runners source (initially empty)
      map.addSource('runners', {
        type: 'geojson',
        data: { type: 'FeatureCollection', features: [] },
      });

      // Base runner layer
      map.addLayer({
        id: 'runners-layer',
        type: 'circle',
        source: 'runners',
        filter: ['!', ['get', 'highlighted']],
        paint: {
          'circle-radius': [
            'interpolate',
            ['linear'],
            ['zoom'],
            11, 2,
            14, 4,
            16, 6,
          ],
          'circle-color': [
            'match',
            ['get', 'status'],
            'on_course', '#FBBF24',
            'finished', '#34D399',
            'not_started', '#6B7280',
            '#FBBF24',
          ],
          'circle-opacity': [
            'match',
            ['get', 'status'],
            'on_course', 0.7,
            'finished', 0.5,
            'not_started', 0.3,
            0.7,
          ],
        },
      });

      // Highlighted runner layer (on top)
      map.addLayer({
        id: 'runners-highlight',
        type: 'circle',
        source: 'runners',
        filter: ['get', 'highlighted'],
        paint: {
          'circle-radius': [
            'interpolate',
            ['linear'],
            ['zoom'],
            11, 5,
            14, 8,
            16, 10,
          ],
          'circle-color': '#F43F5E',
          'circle-opacity': 1,
          'circle-stroke-color': '#FFFFFF',
          'circle-stroke-width': 2,
        },
      });

      mapRef.current = map;
      onMapReady(map);
    });

    return () => {
      map.remove();
      mapRef.current = null;
    };
  }, [race, onMapReady]);

  useEffect(() => {
    const cleanup = initMap();
    return () => cleanup?.();
  }, [initMap]);

  return (
    <div ref={containerRef} className="absolute inset-0 w-full h-full" />
  );
}
