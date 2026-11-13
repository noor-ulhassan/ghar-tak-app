import { useEffect, useRef, useState } from 'react';
import { Loader2, LocateFixed, MapPin } from 'lucide-react';
import type { Coords } from '@workspace/geo';
import { Button } from '@/components/ui/button';
import GoogleMapSurface from '@/components/shared/GoogleMapSurface';
import LazyMapChunk from '@/components/shared/LazyMapChunk';
import type { MapSurfaceHandle, MapSurfaceProps } from '@/components/shared/mapSurface';
import { googleMapsUnavailable, hasGoogleMapsKey } from '@/lib/googleMaps';

// The OpenStreetMap library is only downloaded when Google Maps can't be used.
const loadOsmSurface = () => import('@/components/shared/OsmMapSurface');

// Where the map opens when there is no pin yet and no better guess.
const LAHORE: Coords = { lat: 31.5204, lng: 74.3587 };

/**
 * As the database keeps it: 7 decimals (about 1 cm), and the longitude wrapped into
 * -180..180 (dragging past the edge of the world shows another copy of it).
 */
function clean(point: Coords): Coords {
  const lng = ((((point.lng + 180) % 360) + 360) % 360) - 180;
  return { lat: Math.round(point.lat * 1e7) / 1e7, lng: Math.round(lng * 1e7) / 1e7 };
}

const samePoint = (a: Coords, b: Coords) => a.lat === b.lat && a.lng === b.lng;

/** How the point that was just reported came to be chosen. */
export type PointOrigin =
  /** The person dragged, pinched or used the arrow keys. */
  | { kind: 'moved' }
  /** "Use my current location" placed it, and the map hasn't been moved since. */
  | { kind: 'device'; accuracyM: number }
  /** A `jumpTo` (a city button, say) placed it, and the map hasn't been moved since. */
  | { kind: 'jump' }
  /** The map opened on `value` (or `value` was set from outside) and nobody has moved it. */
  | { kind: 'initial' };

export interface LocationPickerProps {
  /** The chosen point, or null while nothing has been chosen. */
  value: Coords | null;
  /** The chosen point and how it was chosen. The origin stays the same through the zooms that follow. */
  onChange: (point: Coords, origin: PointOrigin) => void;
  /** Where to open the map when `value` is null, e.g. the customer's last known location. */
  openAt?: Coords | null;
  /** Each new object moves the map there and chooses that spot (a city button, say). */
  jumpTo?: { point: Coords; zoom: number } | null;
  /** Told about each device reading "Use my current location" places, with its accuracy. */
  onLocate?: (point: Coords, accuracyM: number) => void;
  /** The id of the element that names this map (a form label), for screen readers. */
  labelledBy?: string;
}

/**
 * A map with a fixed pin in the middle: the person drags the map until the pin sits on the
 * right spot. Nothing is chosen until they drag it (or pan with the arrow keys) or use their
 * current location, so an untouched map never saves the place it happened to open at, and
 * scrolling the page past the map changes nothing. Google Maps when a working key is set,
 * otherwise OpenStreetMap.
 */
export default function LocationPicker({
  value,
  onChange,
  openAt,
  jumpTo,
  onLocate,
  labelledBy,
}: LocationPickerProps) {
  const [engine, setEngine] = useState<'google' | 'osm'>(() =>
    hasGoogleMapsKey && !googleMapsUnavailable() ? 'google' : 'osm',
  );
  const handleRef = useRef<MapSurfaceHandle | null>(null);
  const touchedRef = useRef(value !== null);
  const valueRef = useRef(value);
  valueRef.current = value;
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;
  const onLocateRef = useRef(onLocate);
  onLocateRef.current = onLocate;
  // The last point this picker reported, to tell its own changes from ones made outside.
  const reportedRef = useRef<Coords | null>(value);
  // How the current point came to be. A placement by the device or a jump sticks, through
  // the zooms and map events that follow it, until the person moves the map themselves.
  const originRef = useRef<PointOrigin>({ kind: 'initial' });
  // A city jump asked for before the map was ready.
  const pendingJumpRef = useRef<{ point: Coords; zoom: number } | null>(null);
  const [locating, setLocating] = useState(false);
  const [note, setNote] = useState<string | null>(null);

  const report = (point: Coords) => {
    reportedRef.current = point;
    onChangeRef.current(point, originRef.current);
  };

  const placeJump = (handle: MapSurfaceHandle, jump: { point: Coords; zoom: number }) => {
    touchedRef.current = true;
    originRef.current = { kind: 'jump' };
    setNote(null);
    handle.moveTo(jump.point, jump.zoom);
    report(clean(jump.point));
  };

  const surfaceProps: MapSurfaceProps = {
    start: { point: value ?? openAt ?? LAHORE, zoom: value ? 17 : 13 },
    onUserMove: () => {
      touchedRef.current = true;
      originRef.current = { kind: 'moved' };
      setNote(null);
    },
    onMoveEnd: (center) => {
      if (touchedRef.current) report(clean(center));
    },
    onReady: (handle) => {
      handleRef.current = handle;
      if (!handle) return;
      // The map opened on the current point, so that point counts as chosen.
      const current = valueRef.current;
      if (current) {
        touchedRef.current = true;
        reportedRef.current = current;
      }
      const jump = pendingJumpRef.current;
      pendingJumpRef.current = null;
      if (jump) placeJump(handle, jump);
    },
    onUnavailable: () => setEngine('osm'),
  };

  // A point set from outside (a form filling in a saved shop, say) moves the map to it.
  useEffect(() => {
    const handle = handleRef.current;
    const reported = reportedRef.current;
    if (!handle || !value || (reported && samePoint(reported, value))) return;
    reportedRef.current = value;
    touchedRef.current = true;
    originRef.current = { kind: 'initial' };
    handle.moveTo(value, Math.max(handle.zoom(), 17));
  }, [value]);

  useEffect(() => {
    if (!jumpTo) return;
    const handle = handleRef.current;
    if (!handle) {
      pendingJumpRef.current = jumpTo;
      return;
    }
    placeJump(handle, jumpTo);
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
        const point = clean({ lat: position.coords.latitude, lng: position.coords.longitude });
        const metres = Math.round(position.coords.accuracy);
        touchedRef.current = true;
        originRef.current = { kind: 'device', accuracyM: metres };
        handleRef.current?.moveTo(point, 18);
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
    <div className="space-y-2" role={labelledBy ? 'group' : undefined} aria-labelledby={labelledBy}>
      {/* The wrapper clips Leaflet's own focus outline, so it draws the ring for keyboard focus. */}
      <div className="relative isolate h-72 overflow-hidden rounded-md border has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-ring">
        {engine === 'google' ? (
          <GoogleMapSurface {...surfaceProps} />
        ) : (
          <LazyMapChunk load={loadOsmSurface} componentProps={surfaceProps} frameClassName="h-full w-full" />
        )}
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
        <span role="status" className="text-muted-foreground">
          {value ? (
            <>
              Pin at {value.lat.toFixed(5)}, {value.lng.toFixed(5)} ·{' '}
              <a
                href={`https://www.google.com/maps?q=${value.lat},${value.lng}`}
                target="_blank"
                rel="noreferrer"
                className="text-primary hover:underline"
              >
                Check on Google Maps
              </a>
            </>
          ) : (
            'No pin yet: move the map to the right spot.'
          )}
        </span>
      </div>
      {/* Always in the page, so screen readers announce the note when it appears. */}
      <p role="status" className={note ? 'text-xs text-muted-foreground' : 'sr-only'}>
        {note}
      </p>
    </div>
  );
}
