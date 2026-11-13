import 'leaflet/dist/leaflet.css';
import * as L from 'leaflet';
import { useEffect, useRef } from 'react';
import type { MapSurfaceProps } from '@/components/shared/mapSurface';

/**
 * OpenStreetMap through Leaflet. Every zoom keeps the middle (the pin) in place, and the
 * scroll wheel only zooms once the map has been clicked, so scrolling the page past it
 * changes nothing.
 */
export default function OsmMapSurface(props: MapSurfaceProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const propsRef = useRef(props);
  propsRef.current = props;

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const { start } = propsRef.current;
    const map = L.map(container, {
      center: [start.point.lat, start.point.lng],
      zoom: start.zoom,
      scrollWheelZoom: 'center',
      doubleClickZoom: 'center',
      touchZoom: 'center',
    });
    L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">OpenStreetMap</a> contributors',
    }).addTo(map);

    map.scrollWheelZoom.disable();
    map.on('focus', () => map.scrollWheelZoom.enable());
    map.on('blur', () => map.scrollWheelZoom.disable());

    const userMove = () => propsRef.current.onUserMove();
    const onKey = (event: KeyboardEvent) => {
      if (event.key.startsWith('Arrow')) userMove();
    };
    map.on('dragstart', userMove);
    container.addEventListener('keydown', onKey);
    map.on('moveend', () => {
      const center = map.getCenter();
      propsRef.current.onMoveEnd({ lat: center.lat, lng: center.lng });
    });

    // Dialogs animate in, so the map can start at the wrong size.
    const resize = new ResizeObserver(() => map.invalidateSize());
    resize.observe(container);

    propsRef.current.onReady({
      moveTo: (point, zoom) => map.setView([point.lat, point.lng], zoom),
      zoom: () => map.getZoom(),
    });

    return () => {
      propsRef.current.onReady(null);
      resize.disconnect();
      container.removeEventListener('keydown', onKey);
      map.remove();
    };
  }, []);

  return (
    <div
      ref={containerRef}
      className="h-full w-full"
      role="application"
      aria-label="Map. Move it until the pin in the middle sits on the right spot."
      tabIndex={0}
    />
  );
}
