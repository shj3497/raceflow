'use client';

import { useRef, useEffect, useCallback } from 'react';
import mapboxgl from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';
import type { RaceDetail } from '@/lib/types';

interface MapViewProps {
  race: RaceDetail;
  onMapReady: (map: mapboxgl.Map) => void;
}

export default function MapView({ race, onMapReady }: MapViewProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<mapboxgl.Map | null>(null);

  const initMap = useCallback(() => {
    if (!containerRef.current || mapRef.current) return;

    const token = process.env.NEXT_PUBLIC_MAPBOX_TOKEN;
    if (!token) {
      console.warn('NEXT_PUBLIC_MAPBOX_TOKEN is not set');
      return;
    }
    mapboxgl.accessToken = token;

    const coords = race.course_geojson.coordinates as [number, number][];
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

    const map = new mapboxgl.Map({
      container: containerRef.current,
      style: 'mapbox://styles/mapbox/dark-v11',
      bounds: new mapboxgl.LngLatBounds(bounds[0], bounds[1]),
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
          geometry: race.course_geojson,
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

      // Checkpoint markers as circle + symbol layers
      const checkpointFeatures: GeoJSON.Feature[] = race.split_points.map((sp) => ({
        type: 'Feature',
        geometry: { type: 'Point', coordinates: sp.coordinates },
        properties: { name: sp.name },
      }));

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
