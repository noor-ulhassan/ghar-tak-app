import type { Coords } from '@workspace/geo';

/** What LocationPicker can do with whichever map it shows. */
export interface MapSurfaceHandle {
  moveTo: (point: Coords, zoom: number) => void;
  zoom: () => number;
}

/**
 * A map with nothing on it: LocationPicker draws the pin, decides when a spot counts as
 * chosen, and works the same with Google or OpenStreetMap underneath.
 */
export interface MapSurfaceProps {
  /** Where the map opens. Read once, when the map is created. */
  start: { point: Coords; zoom: number };
  /** The person started moving the map themselves (a drag, a two-finger gesture, or an arrow key). */
  onUserMove: () => void;
  /** The map finished moving or zooming; the centre as the map library gives it. */
  onMoveEnd: (center: Coords) => void;
  /** The map is ready (or gone, with null). */
  onReady: (handle: MapSurfaceHandle | null) => void;
  /** This map can't be used here (no script, rejected key); show the other one. */
  onUnavailable: () => void;
}
