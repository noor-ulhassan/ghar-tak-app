import 'leaflet/dist/leaflet.css';
import * as L from 'leaflet';
import { useEffect, useRef, useState } from 'react';
import { Loader2, LocateFixed, MapPin } from 'lucide-react';
import type { Coords } from '@workspace/geo';
import { Button } from '@/components/ui/button';

// Where the map opens when there is no pin yet and no better guess.
const LAHORE: Coords = { lat: 31.5204, lng: 74.3587 };
// 7 decimals is what the database keeps (about 1 cm).
const round7 = (value: number) => Math.round(value * 1e7) / 1e7;

interface LocationPickerProps {
  /** The chosen point, or null while nothing has been chosen. */
  value: Coords | null;
  onChange: (point: Coords) => void;
  /** Where to open the map when `value` is null, e.g. the customer's last known location. */
  openAt?: Coords | null;
  /** Each new object moves the map there and chooses that spot (a city button, say). */
  jumpTo?: { point: Coords; zoom: number } | null;
  /** Told about each device reading "Use my current location" places, with its accuracy. */
  onLocate?: (point: Coords, accuracyM: number) => void;
}

/**
 * A map with a fixed pin in the middle: the person drags the map until the pin sits on the
 * right spot. Nothing is chosen until they drag it (or pan with the arrow keys) or use their
 * current location, so an untouched map never saves the place it happened to open at.
 * Zooming always keeps the pin where it is, and the scroll wheel only zooms once the map has
 * been clicked, so scrolling the page past the map changes nothing.
 */
export default function LocationPicker({ value, onChange, openAt, jumpTo, onLocate }: LocationPickerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const touchedRef = useRef(value !== null);
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;
  const onLocateRef = useRef(onLocate);
  onLocateRef.current = onLocate;
  // The last point this map reported, to tell its own changes from ones made outside.
  const reportedRef = useRef<Coords | null>(value);
  const report = (point: Coords) => {
    reportedRef.current = point;
    onChangeRef.current(point);
  };
  const [locating, setLocating] = useState(false);
  const [note, setNote] = useState<string | null>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const start = value ?? openAt ?? LAHORE;
    const map = L.map(container, {
      center: [start.lat, start.lng],
      zoom: value ? 17 : 13,
      // Every kind of zoom keeps the middle, where the pin is, in place.
      scrollWheelZoom: 'center',
      doubleClickZoom: 'center',
      touchZoom: 'center',
    });
    mapRef.current = map;
    L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">OpenStreetMap</a> contributors',
    }).addTo(map);

    // The wheel zooms only while the map has focus, so it doesn't catch page scrolling.
    map.scrollWheelZoom.disable();
    map.on('focus', () => map.scrollWheelZoom.enable());
    map.on('blur', () => map.scrollWheelZoom.disable());

    const choose = () => {
      // Dragging past the edge of the world shows another copy of it; wrap back to -180..180.
      const center = map.getCenter().wrap();
      report({ lat: round7(center.lat), lng: round7(center.lng) });
    };
    const touch = () => {
      touchedRef.current = true;
    };
    const touchOnArrowKey = (event: KeyboardEvent) => {
      if (event.key.startsWith('Arrow')) touch();
    };
    map.on('dragstart', touch);
    container.addEventListener('keydown', touchOnArrowKey);
    map.on('moveend', () => {
      if (touchedRef.current) choose();
    });

    // Dialogs animate in, so the map can start at the wrong size.
    const resize = new ResizeObserver(() => map.invalidateSize());
    resize.observe(container);

    return () => {
      resize.disconnect();
      container.removeEventListener('keydown', touchOnArrowKey);
      map.remove();
      mapRef.current = null;
    };
    // The map is built once; the effects below move it.
  }, []);

  // A point set from outside (a form filling in a saved shop, say) moves the map to it.
  useEffect(() => {
    const map = mapRef.current;
    const reported = reportedRef.current;
    if (!map || !value || (reported && reported.lat === value.lat && reported.lng === value.lng)) return;
    reportedRef.current = value;
    touchedRef.current = true;
    map.setView([value.lat, value.lng], Math.max(map.getZoom(), 17));
  }, [value]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !jumpTo) return;
    touchedRef.current = true;
    map.setView([jumpTo.point.lat, jumpTo.point.lng], jumpTo.zoom);
    report({ lat: round7(jumpTo.point.lat), lng: round7(jumpTo.point.lng) });
  }, [jumpTo]);

  const useCurrentLocation = () => {
    if (!navigator.geolocation) {
      setNote("This browser can't share its location. Move the map to the right spot instead.");
      return;
    }
    setLocating(true);
    setNote(null);
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setLocating(false);
        const map = mapRef.current;
        if (!map) return;
        const point = { lat: round7(position.coords.latitude), lng: round7(position.coords.longitude) };
        const metres = Math.round(position.coords.accuracy);
        touchedRef.current = true;
        map.setView([point.lat, point.lng], 18);
        report(point);
        onLocateRef.current?.(point, metres);
        setNote(
          metres > 100
            ? `Your device only knows this to within about ${metres >= 1000 ? `${(metres / 1000).toFixed(1)} km` : `${metres} m`}. Move the map so the pin sits exactly on the right spot.`
            : `Placed to within about ${metres} m. Check that the pin is on the right spot.`,
        );
      },
      (error) => {
        setLocating(false);
        setNote(
          error.code === error.PERMISSION_DENIED
            ? 'Location permission is turned off. Move the map to the right spot instead.'
            : "Couldn't get your location. Move the map to the right spot instead.",
        );
      },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 },
    );
  };

  return (
    <div className="space-y-2">
      <div className="relative isolate h-72 overflow-hidden rounded-md border">
        <div
          ref={containerRef}
          className="h-full w-full"
          role="application"
          aria-label="Map. Move it until the pin in the middle sits on the right spot."
          tabIndex={0}
        />
        <MapPin
          className="pointer-events-none absolute left-1/2 top-1/2 z-[500] h-9 w-9 -translate-x-1/2 -translate-y-full fill-primary text-primary-foreground drop-shadow"
          aria-hidden="true"
        />
      </div>
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
        <Button type="button" variant="outline" size="sm" onClick={useCurrentLocation} disabled={locating}>
          {locating ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <LocateFixed className="mr-2 h-4 w-4" />}
          Use my current location
        </Button>
        {value ? (
          <span className="text-muted-foreground">
            Pin at {value.lat.toFixed(5)}, {value.lng.toFixed(5)} ·{' '}
            <a
              href={`https://www.google.com/maps?q=${value.lat},${value.lng}`}
              target="_blank"
              rel="noreferrer"
              className="text-primary hover:underline"
            >
              Check on Google Maps
            </a>
          </span>
        ) : (
          <span className="text-muted-foreground">No pin yet: move the map to the right spot.</span>
        )}
      </div>
      {note && <p className="text-xs text-muted-foreground">{note}</p>}
    </div>
  );
}
