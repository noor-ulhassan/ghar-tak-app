import { createContext, useCallback, useContext, useRef, useState, type ReactNode } from 'react';
import { CITIES, CITY_ACCURACY_M, type Coords } from '@workspace/geo';
import LazyLocationPicker from '@/components/shared/LazyLocationPicker';
import type { PointOrigin } from '@/components/shared/LocationPicker';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { useLocation } from '@/hooks/useLocation';

const OpenLocationChooser = createContext<(() => void) | null>(null);

/** Opens the one location dialog the whole app shares. */
export function useLocationChooser() {
  const openLocationChooser = useContext(OpenLocationChooser);
  if (!openLocationChooser) throw new Error('useLocationChooser must be used inside LocationChooserProvider');
  return { openLocationChooser };
}

/**
 * Mounts the location dialog once for the whole app. Saving a location re-renders the lines
 * that open it, so a dialog inside them would close mid-save and lose the keyboard focus.
 */
export function LocationChooserProvider({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const opener = useRef<HTMLElement | null>(null);

  const openLocationChooser = useCallback(() => {
    const active = document.activeElement;
    opener.current = active instanceof HTMLElement && active !== document.body ? active : null;
    setOpen(true);
  }, []);

  // The button that opened the dialog may be gone after saving (an empty list that now has
  // shops); then focus goes to the page's heading instead of being lost.
  const returnFocus = (event: Event) => {
    event.preventDefault();
    const target = opener.current;
    opener.current = null;
    if (target?.isConnected && target.getClientRects().length > 0) {
      target.focus();
      return;
    }
    const fallback = document.querySelector<HTMLElement>('main h1') ?? document.querySelector<HTMLElement>('main');
    if (!fallback) return;
    if (!fallback.hasAttribute('tabindex')) fallback.setAttribute('tabindex', '-1');
    fallback.focus();
  };

  return (
    <OpenLocationChooser.Provider value={openLocationChooser}>
      {children}
      <LocationChooser open={open} onOpenChange={setOpen} onCloseAutoFocus={returnFocus} />
    </OpenLocationChooser.Provider>
  );
}

/** Lets a customer pin where they are, so the "near me" lists show the shops that reach them. */
function LocationChooser({
  open,
  onOpenChange,
  onCloseAutoFocus,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCloseAutoFocus: (event: Event) => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto" onCloseAutoFocus={onCloseAutoFocus}>
        {/* The dialog drops its content when closed, so each opening starts from the saved location. */}
        <ChooserBody onDone={() => onOpenChange(false)} />
      </DialogContent>
    </Dialog>
  );
}

function ChooserBody({ onDone }: { onDone: () => void }) {
  const { location, chooseLocation } = useLocation();
  const [point, setPoint] = useState<Coords | null>(() => (location ? { lat: location.lat, lng: location.lng } : null));
  // How the point on the map was chosen decides how it is saved.
  const [origin, setOrigin] = useState<PointOrigin>({ kind: 'initial' });
  const [jumpTo, setJumpTo] = useState<{ point: Coords; zoom: number; city: string } | null>(null);
  const pickedCity = origin.kind === 'jump' ? jumpTo?.city : undefined;

  const save = () => {
    if (!point) return;
    if (origin.kind === 'device') {
      // A device reading kept as it was stays one: refreshed daily, flagged when vague.
      chooseLocation(point, { source: 'device', accuracyM: origin.accuracyM });
    } else if (origin.kind === 'jump') {
      // A city on its own is too vague to say who delivers, so the lists sort by it instead.
      chooseLocation(point, { source: 'chosen', accuracyM: CITY_ACCURACY_M, place: pickedCity });
    } else if (origin.kind === 'moved') {
      chooseLocation(point, { source: 'chosen' });
    }
    // 'initial': nobody moved the map, so the saved location stays exactly as it was.
    onDone();
  };

  return (
    <>
      <DialogHeader>
        <DialogTitle>Set your location</DialogTitle>
        <DialogDescription>
          We list the shops and services that reach this spot. Pick your city, then move the map to your street.
        </DialogDescription>
      </DialogHeader>
      <div className="space-y-3">
        <div className="flex flex-wrap gap-2">
          {CITIES.map((city) => (
            <Button
              key={city.name}
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setJumpTo({ point: { lat: city.lat, lng: city.lng }, zoom: 12, city: city.name })}
            >
              {city.name}
            </Button>
          ))}
        </div>
        <LazyLocationPicker
          value={point}
          onChange={(next, how) => {
            setPoint(next);
            setOrigin(how);
          }}
          jumpTo={jumpTo}
        />
        {pickedCity && (
          <p className="text-xs text-muted-foreground">
            With just the city, every shop is listed, nearest to the middle of {pickedCity} first. Move the map to your
            street to see exactly who delivers to you.
          </p>
        )}
      </div>
      <DialogFooter>
        <Button variant="outline" onClick={onDone}>Cancel</Button>
        <Button disabled={!point} onClick={save}>
          Use this location
        </Button>
      </DialogFooter>
    </>
  );
}
