'use client';

import { useState, CSSProperties } from 'react';
import { Skeleton } from '@/components/ui/skeleton';

interface ArtifactFrameProps {
  demos: Array<{ url: string; label: string }>;
  interactive?: boolean;
  className?: string;
  style?: CSSProperties;
}

export function ArtifactFrame({ demos, interactive = true, className = '', style }: ArtifactFrameProps) {
  const [current, setCurrent] = useState(0);
  const [loadedSet, setLoadedSet] = useState(() => new Set<number>());

  const n = demos.length;
  const loading = demos.length > 0 && !loadedSet.has(current);

  const go = (to: number) => {
    setCurrent(((to % n) + n) % n);
  };

  const handleLoad = (i: number) => {
    setLoadedSet(prev => new Set([...prev, i]));
  };

  return (
    <div
      className={`overflow-hidden rounded-lg border ${className}`}
      style={{
        background: 'var(--lp-elevated)',
        borderColor: 'var(--lp-border)',
        boxShadow: '0 24px 60px rgba(0,0,0,0.35)',
        isolation: 'isolate',
        ...style,
      }}
    >
      {/* Chrome bar */}
      <div
        className="flex items-center gap-2.5 border-b px-3.5 py-2.5"
        style={{ background: 'var(--lp-chrome)', borderColor: 'var(--lp-border)' }}
      >
        <div className="flex gap-1.5">
          {['#ff5f57', '#febc2e', '#28c840'].map(c => (
            <div key={c} className="h-2.5 w-2.5 rounded-full" style={{ background: c }} />
          ))}
        </div>
        <div
          className="flex-1 truncate rounded px-2 py-1 text-center"
          style={{ background: 'var(--lp-border)', fontSize: '10.5px', color: 'var(--lp-muted)' }}
        >
          {demos[current]?.label ?? '—'}
        </div>
      </div>

      {/* Iframe viewport */}
      <div className="relative overflow-hidden" style={{ height: '340px' }}>
        {demos.length === 0 ? (
          <div className="flex h-full items-center justify-center text-xs" style={{ color: 'var(--lp-muted)' }}>
            Nenhum demo configurado.
          </div>
        ) : (
          demos.map((demo, i) => (
            <iframe
              key={demo.url}
              src={demo.url}
              title={demo.label}
              onLoad={() => handleLoad(i)}
              ref={(el) => {
                try { if (el?.contentDocument?.readyState === 'complete' && !loadedSet.has(i)) handleLoad(i); } catch { /* cross-origin */ }
              }}
              style={{
                position: 'absolute',
                inset: 0,
                width: '100%',
                height: '100%',
                border: 'none',
                opacity: i === current ? 1 : 0,
                pointerEvents: interactive && i === current ? 'auto' : 'none',
              }}
            />
          ))
        )}
        {/* skeleton AFTER iframes — z-10 cobre sem competir com document order */}
        {loading && demos.length > 0 && (
          <div className="absolute inset-0 z-10 flex flex-col gap-3 p-5" style={{ background: 'var(--lp-elevated)' }}>
            <Skeleton className="h-6 w-2/5" />
            <Skeleton className="h-4 w-3/5" />
            <Skeleton className="mt-2 h-32 w-full" />
            <Skeleton className="h-4 w-4/5" />
            <Skeleton className="h-4 w-2/3" />
          </div>
        )}
      </div>

      {/* Nav — só com 2+ demos */}
      {demos.length > 1 && (
        <div
          className="flex items-center justify-center gap-4 border-t py-2.5"
          style={{ background: 'var(--lp-chrome)', borderColor: 'var(--lp-border)' }}
        >
          <button
            onClick={() => go(current - 1)}
            className="flex h-7 w-7 items-center justify-center rounded-full border text-sm transition-all duration-200 text-muted-foreground hover:text-foreground border-border hover:border-foreground/20"
            aria-label="Demo anterior"
          >
            ←
          </button>
          <div className="flex gap-1.5">
            {demos.map((_, i) => (
              <button
                key={i}
                onClick={() => go(i)}
                className="h-1.5 rounded-full transition-all duration-200"
                style={{
                  width: i === current ? '1.5rem' : '0.375rem',
                  background: i === current ? 'var(--lp-fg)' : 'var(--lp-muted)',
                  opacity: i === current ? 0.8 : 0.35,
                }}
                aria-label={`Demo ${i + 1}`}
              />
            ))}
          </div>
          <button
            onClick={() => go(current + 1)}
            className="flex h-7 w-7 items-center justify-center rounded-full border text-sm transition-all duration-200 text-muted-foreground hover:text-foreground border-border hover:border-foreground/20"
            aria-label="Próxima demo"
          >
            →
          </button>
        </div>
      )}
    </div>
  );
}
