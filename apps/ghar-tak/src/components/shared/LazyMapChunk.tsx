import { Component, lazy, Suspense, useState, type ComponentType, type LazyExoticComponent, type ReactNode } from 'react';
import { Button } from '@/components/ui/button';

type Loader<P> = () => Promise<{ default: ComponentType<P> }>;

// One lazy() per loader, shared by every place that shows it, so a chunk that has loaded
// once shows straight away the next time (a dialog opening again) without a loading flash.
const chunks = new Map<Loader<never>, LazyExoticComponent<ComponentType<never>>>();

function chunkFor<P>(load: Loader<P>, fresh: boolean): LazyExoticComponent<ComponentType<P>> {
  let chunk = chunks.get(load as Loader<never>);
  if (!chunk || fresh) {
    chunk = lazy(load as Loader<never>);
    chunks.set(load as Loader<never>, chunk);
  }
  return chunk as unknown as LazyExoticComponent<ComponentType<P>>;
}

class ChunkErrorBoundary extends Component<
  { fallback: ReactNode; onError: () => void; children: ReactNode },
  { failed: boolean }
> {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  componentDidCatch() {
    this.props.onError();
  }

  render() {
    return this.state.failed ? this.props.fallback : this.props.children;
  }
}

/**
 * Shows a lazily loaded map component. If its file can't be downloaded (a flaky network, or
 * a new deploy that replaced the old files) only this spot shows a message with a way to
 * retry, instead of the error blanking the whole page.
 *
 * `frameClassName` gives the loading and failure boxes the size of the map they stand in for.
 */
export default function LazyMapChunk<P extends object>({
  load,
  componentProps,
  frameClassName,
}: {
  load: Loader<P>;
  componentProps: P;
  frameClassName: string;
}) {
  const [attempt, setAttempt] = useState(0);
  const [failures, setFailures] = useState(0);
  const Chunk = chunkFor(load, false) as ComponentType<P>;

  const retry = () => {
    // React keeps a failed import and throws it again, so a retry needs a new lazy().
    chunkFor(load, true);
    setAttempt((n) => n + 1);
  };

  const failedBox = (
    <div
      className={`${frameClassName} flex flex-col items-center justify-center gap-3 bg-muted p-4 text-center text-sm`}
    >
      <p role="alert">The map couldn't load. Check your connection.</p>
      <div className="flex flex-wrap justify-center gap-2">
        <Button type="button" variant="outline" size="sm" onClick={retry}>
          Try again
        </Button>
        {/* After a deploy the old file is gone for good, so only a fresh page can fix it. */}
        {failures >= 2 && (
          <Button type="button" variant="outline" size="sm" onClick={() => window.location.reload()}>
            Reload page
          </Button>
        )}
      </div>
    </div>
  );

  return (
    <ChunkErrorBoundary key={attempt} fallback={failedBox} onError={() => setFailures((n) => n + 1)}>
      <Suspense fallback={<div className={`${frameClassName} bg-muted animate-pulse`} />}>
        <Chunk {...componentProps} />
      </Suspense>
    </ChunkErrorBoundary>
  );
}
