import { lazy, Suspense, useState } from 'react';
import type { Coords } from '@workspace/geo';
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
import { CITIES } from '@/lib/cities';

// The map library is only downloaded when this dialog opens.
const LocationPicker = lazy(() => import('@/components/shared/LocationPicker'));

/** Lets a customer pin where they are, so the "near me" lists show the shops that reach them. */
export default function LocationChooser({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
        {/* The dialog drops its content when closed, so each opening starts from the saved location. */}
        <ChooserBody onDone={() => onOpenChange(false)} />
      </DialogContent>
    </Dialog>
  );
}

function ChooserBody({ onDone }: { onDone: () => void }) {
  const { location, chooseLocation } = useLocation();
  const [point, setPoint] = useState<Coords | null>(() => (location ? { lat: location.lat, lng: location.lng } : null));
  const [jumpTo, setJumpTo] = useState<{ point: Coords; zoom: number } | null>(null);
  // The last reading "Use my current location" placed. Kept unchanged, it is saved as the
  // device's location (refreshed daily, flagged when vague) rather than as a pinned spot.
  const [deviceFix, setDeviceFix] = useState<{ point: Coords; accuracyM: number } | null>(null);
  const keptDeviceFix =
    deviceFix && point && deviceFix.point.lat === point.lat && deviceFix.point.lng === point.lng ? deviceFix : null;

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
              onClick={() => setJumpTo({ point: { lat: city.lat, lng: city.lng }, zoom: 12 })}
            >
              {city.name}
            </Button>
          ))}
        </div>
        <Suspense fallback={<div className="h-72 rounded-md border bg-muted animate-pulse" />}>
          <LocationPicker
            value={point}
            onChange={setPoint}
            jumpTo={jumpTo}
            onLocate={(located, accuracyM) => setDeviceFix({ point: located, accuracyM })}
          />
        </Suspense>
      </div>
      <DialogFooter>
        <Button variant="outline" onClick={onDone}>Cancel</Button>
        <Button
          disabled={!point}
          onClick={() => {
            if (!point) return;
            chooseLocation(point, keptDeviceFix?.accuracyM);
            onDone();
          }}
        >
          Use this location
        </Button>
      </DialogFooter>
    </>
  );
}
