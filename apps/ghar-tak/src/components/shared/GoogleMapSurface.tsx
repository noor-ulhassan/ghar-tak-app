import { useEffect, useRef } from 'react';
import type { MapSurfaceProps } from '@/components/shared/mapSurface';
import { loadGoogleMaps, onGoogleMapsKeyRejected } from '@/lib/googleMaps';

/**
 * Google Maps with a Map / Satellite switch. "Cooperative" gestures mean a plain scroll
 * wheel scrolls the page (Google shows "use ctrl + scroll to zoom"), so scrolling past the
 * map never moves it. Falls back through onUnavailable when Google can't be used.
 */
export default function GoogleMapSurface(props: MapSurfaceProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const propsRef = useRef(props);
  propsRef.current = props;

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    let cancelled = false;
    const listeners: google.maps.MapsEventListener[] = [];
    const stopListening = onGoogleMapsKeyRejected(() => propsRef.current.onUnavailable());
    const onKey = (event: KeyboardEvent) => {
      if (event.key.startsWith('Arrow')) propsRef.current.onUserMove();
    };

    loadGoogleMaps()
      .then(() => {
        if (cancelled) return;
        if (typeof window.google?.maps?.Map !== 'function') {
          propsRef.current.onUnavailable();
          return;
        }
        const { start } = propsRef.current;
        const map = new window.google.maps.Map(container, {
          center: start.point,
          zoom: start.zoom,
          gestureHandling: 'cooperative',
          clickableIcons: false,
          streetViewControl: false,
          fullscreenControl: false,
          mapTypeControl: true,
          mapTypeControlOptions: { mapTypeIds: ['roadmap', 'hybrid'] },
        });
        listeners.push(map.addListener('dragstart', () => propsRef.current.onUserMove()));
        listeners.push(
          map.addListener('idle', () => {
            const center = map.getCenter();
            if (center) propsRef.current.onMoveEnd({ lat: center.lat(), lng: center.lng() });
          }),
        );
        container.addEventListener('keydown', onKey);
        propsRef.current.onReady({
          moveTo: (point, zoom) => {
            map.setZoom(zoom);
            map.setCenter(point);
          },
          zoom: () => map.getZoom() ?? start.zoom,
        });
      })
      .catch(() => {
        if (!cancelled) propsRef.current.onUnavailable();
      });

    return () => {
      cancelled = true;
      stopListening();
      listeners.forEach((listener) => listener.remove());
      container.removeEventListener('keydown', onKey);
      propsRef.current.onReady(null);
    };
  }, []);

  return (
    <div
      ref={containerRef}
      className="h-full w-full"
      aria-label="Map. Move it until the pin in the middle sits on the right spot."
    />
  );
}
