'use client';

import { useState, useRef, CSSProperties } from 'react';

interface ArtifactFrameProps {
  demos: Array<{ url: string; label: string }>;
  className?: string;
  style?: CSSProperties;
}

export function ArtifactFrame({ demos, className = '', style }: ArtifactFrameProps) {
  const [current, setCurrent] = useState(0);
  const [loading, setLoading] = useState(true);
  const loadedRef = useRef<Set<number>>(new Set());

  const n = demos.length;

  const go = (to: number) => {
    const next = ((to % n) + n) % n;
    setLoading(!loadedRef.current.has(next));
    setCurrent(next);
  };

  const handleLoad = (i: number) => {
    loadedRef.current.add(i);
    if (i === current) setLoading(false);
  };

  return (
    <div
      className={`overflow-hidden rounded-lg border ${className}`}
      style={{
        background: 'var(--lp-elevated)',
        borderColor: 'var(--lp-border)',
        boxShadow: '0 48px 96px rgba(0,0,0,0.65)',
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
            Nenhum demo configurado no Payload CMS.
          </div>
        ) : (
          demos.map((demo, i) => (
            <iframe
              key={demo.url}
              src={demo.url}
              title={demo.label}
              onLoad={() => handleLoad(i)}
              style={{
                position: 'absolute',
                inset: 0,
                width: '100%',
                height: '100%',
                border: 'none',
                opacity: i === current ? 1 : 0,
                pointerEvents: i === current ? 'auto' : 'none',
              }}
            />
          ))
        )}
        {/* skeleton AFTER iframes — z-10 cobre sem competir com document order */}
        {loading && demos.length > 0 && (
          <div
            className="absolute inset-0 z-10 flex flex-col gap-3 p-5 animate-pulse"
            style={{ background: 'var(--lp-elevated)' }}
          >
            <div className="h-6 w-2/5 rounded-sm" style={{ background: 'var(--lp-border)' }} />
            <div className="h-4 w-3/5 rounded-sm" style={{ background: 'var(--lp-border)' }} />
            <div className="mt-2 h-32 w-full rounded-sm" style={{ background: 'var(--lp-border)' }} />
            <div className="h-4 w-4/5 rounded-sm" style={{ background: 'var(--lp-border)' }} />
            <div className="h-4 w-2/3 rounded-sm" style={{ background: 'var(--lp-border)' }} />
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
