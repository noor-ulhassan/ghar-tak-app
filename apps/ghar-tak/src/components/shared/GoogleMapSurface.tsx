import { useEffect, useRef, useState } from 'react';
import type { MapSurfaceProps } from '@/components/shared/mapSurface';
import { loadGoogleMaps, markGoogleMapsUnavailable, onGoogleMapsKeyRejected } from '@/lib/googleMaps';

// A script that hangs (a bad connection that never answers) must not leave a blank box for ever.
const READY_TIMEOUT_MS = 10_000;

// Google's own controls (zoom buttons, the map-type menu) take arrow keys for themselves.
const OWN_CONTROLS = 'button, a, input, select, [role="menu"], [role^="menuitem"]';

/**
 * Google Maps with a Map / Satellite switch. "Cooperative" gestures mean a plain scroll
 * wheel scrolls the page (Google shows "use ctrl + scroll to zoom"), so scrolling past the
 * map never moves it. Falls back through onUnavailable when Google can't be used.
 */
export default function GoogleMapSurface(props: MapSurfaceProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const propsRef = useRef(props);
  propsRef.current = props;
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    let cancelled = false;
    const listeners: google.maps.MapsEventListener[] = [];
    const stopListening = onGoogleMapsKeyRejected(() => propsRef.current.onUnavailable());
    const giveUp = () => {
      markGoogleMapsUnavailable();
      propsRef.current.onUnavailable();
    };
    const timeout = window.setTimeout(giveUp, READY_TIMEOUT_MS);
    const onKey = (event: KeyboardEvent) => {
      if (!event.key.startsWith('Arrow')) return;
      if (event.target instanceof Element && event.target.closest(OWN_CONTROLS)) return;
      propsRef.current.onUserMove();
    };

    loadGoogleMaps()
      .then(() => {
        if (cancelled) return;
        if (typeof window.google?.maps?.Map !== 'function') {
          giveUp();
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
        window.clearTimeout(timeout);
        setReady(true);
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
      window.clearTimeout(timeout);
      stopListening();
      listeners.forEach((listener) => listener.remove());
      container.removeEventListener('keydown', onKey);
      propsRef.current.onReady(null);
    };
  }, []);

  return (
    <>
      <div
        ref={containerRef}
        className="h-full w-full"
        role="region"
        aria-label="Map. Move it until the pin in the middle sits on the right spot."
      />
      {/* Until Google's map is drawn, the same grey pulse as the other map's loading box. */}
      {!ready && <div className="absolute inset-0 bg-muted animate-pulse" />}
    </>
  );
}
