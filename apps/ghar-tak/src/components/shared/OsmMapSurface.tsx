import 'leaflet/dist/leaflet.css';
import * as L from 'leaflet';
import { useEffect, useRef, useState } from 'react';
import type { MapSurfaceProps } from '@/components/shared/mapSurface';

const HINT_MS = 1500;

/**
 * OpenStreetMap through Leaflet. Every zoom keeps the middle (the pin) in place, and the
 * scroll wheel only zooms once the map has been clicked, so scrolling the page past it
 * changes nothing. On a phone one finger scrolls the page and two fingers move and zoom
 * the map (like Google's "cooperative" gestures), so a swipe that starts on the map
 * doesn't silently move the pin.
 */
export default function OsmMapSurface(props: MapSurfaceProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const propsRef = useRef(props);
  propsRef.current = props;
  const [hint, setHint] = useState(false);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const { start } = propsRef.current;
    const touchScreen = window.matchMedia('(pointer: coarse)').matches;
    const map = L.map(container, {
      center: [start.point.lat, start.point.lng],
      zoom: start.zoom,
      scrollWheelZoom: 'center',
      doubleClickZoom: 'center',
      // Without one-finger dragging Leaflet leaves the page's own scrolling alone
      // (touch-action: pan-x pan-y), and its two-finger handler both zooms and pans.
      ...(touchScreen ? { dragging: false, touchZoom: true } : { touchZoom: 'center' as const }),
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
      // Arrow keys on the zoom buttons or the attribution link don't move the map.
      if (event.target === container && event.key.startsWith('Arrow')) userMove();
    };
    map.on('dragstart', userMove);
    container.addEventListener('keydown', onKey);
    map.on('moveend', () => {
      const center = map.getCenter();
      propsRef.current.onMoveEnd({ lat: center.lat, lng: center.lng });
    });

    let hintTimer: number | undefined;
    const onTouchStart = (event: TouchEvent) => {
      if (event.touches.length >= 2) userMove();
    };
    const onTouchMove = (event: TouchEvent) => {
      if (event.touches.length !== 1) return;
      setHint(true);
      window.clearTimeout(hintTimer);
      hintTimer = window.setTimeout(() => setHint(false), HINT_MS);
    };
    if (touchScreen) {
      container.addEventListener('touchstart', onTouchStart, { passive: true });
      container.addEventListener('touchmove', onTouchMove, { passive: true });
    }

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
      window.clearTimeout(hintTimer);
      container.removeEventListener('keydown', onKey);
      container.removeEventListener('touchstart', onTouchStart);
      container.removeEventListener('touchmove', onTouchMove);
      map.remove();
    };
  }, []);

  return (
    <>
      <div
        ref={containerRef}
        className="h-full w-full"
        role="application"
        aria-label="Map. Move it until the pin in the middle sits on the right spot."
        tabIndex={0}
      />
      {hint && (
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 z-[1100] flex items-center justify-center bg-black/50 p-4 text-center text-sm font-medium text-white"
        >
          Use two fingers to move the map
        </div>
      )}
    </>
  );
}
