"use client"

import { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useLocalStorage } from '@/hooks/use-localStorage';
import { useHasMounted } from '@/hooks/use-has-mounted';
import { useIsMobile } from '@/hooks/use-mobile';
import { Button } from './ui/button';
import { useTranslation } from '@/hooks/use-translation';

export interface WindowProps {
    title: React.ReactNode
    enabled?: boolean
    children: React.ReactNode
    name?: string
    cascadeIndex?: number
    setClosed?: (closed: boolean) => void
}

const DEFAULT_SIZE = { width: 460, height: 620 };
const MARGIN = 24;

interface Geometry {
    size: { width: number, height: number }
    position: { x: number, y: number }
}

function clampDimension(savedValue: number | undefined, defaultValue: number, maxAvailable: number): number {
    return Math.min(savedValue ?? defaultValue, maxAvailable - MARGIN * 2);
}

function resolveWantedPosition(saved: Geometry | null, width: number, height: number, cascadeIndex: number) {
    if (saved?.position) return saved.position;
    const cascade = Math.max(0, cascadeIndex % 5) * 32;
    return {
        x: window.innerWidth - width - MARGIN - cascade,
        y: window.innerHeight - height - MARGIN - cascade,
    };
}

/** Geometria inicial da janela, encaixada no viewport atual a partir do que foi salvo. */
function initialGeometry(saved: Geometry | null, cascadeIndex = 0): Geometry {
    if (typeof window === 'undefined') return { size: DEFAULT_SIZE, position: { x: MARGIN, y: MARGIN } };

    const width = clampDimension(saved?.size?.width, DEFAULT_SIZE.width, window.innerWidth);
    const height = clampDimension(saved?.size?.height, DEFAULT_SIZE.height, window.innerHeight);
    const wanted = resolveWantedPosition(saved, width, height, cascadeIndex);

    return {
        size: { width, height },
        position: {
            x: Math.max(0, Math.min(window.innerWidth - width, wanted.x)),
            y: Math.max(0, Math.min(window.innerHeight - height, wanted.y)),
        },
    };
}

export function Window({ title, enabled = true, children, name, cascadeIndex = 0, setClosed }: WindowProps) {
    const isMobile = useIsMobile();
    const { t } = useTranslation("common");
    // LocalStorage integration
    const { getValue, setValue } = useLocalStorage<Geometry>(name || "window-default");

    // Restaura a geometria de forma síncrona no primeiro render, antes de qualquer pintura.
    const [initial] = useState(() => initialGeometry(name ? getValue() : null, cascadeIndex));

    const [size, setSize] = useState(initial.size);
    const [resizing, setResizing] = useState(false);
    const resizeStart = useRef({ x: 0, y: 0, ...initial.size });

    // Drag state
    const [dragging, setDragging] = useState(false);
    const [position, setPosition] = useState(initial.position);
    const [offset, setOffset] = useState({ x: 0, y: 0 });

    // Portal só aparece depois da hidratação, via useHasMounted
    const mounted = useHasMounted();

    // Cada janela vive num host próprio no fim do <body>: escapa de qualquer ancestral
    // com transform/overflow e deixa o empilhamento ser a ordem do DOM (ver bringToFront).
    const [host] = useState(() => typeof document === 'undefined' ? null : document.createElement('div'));
    useEffect(() => {
        if (!host) return;
        document.body.appendChild(host);
        return () => host.remove();
    }, [host]);

    // Janela ativa no topo: reinsere o nó no fim do body, em capture, só se houver alguém depois.
    const bringToFront = () => {
        if (host?.nextElementSibling) document.body.appendChild(host);
    };

    // Salva no localStorage ao mudar tamanho ou posição
    useEffect(() => {
        if (name) {
            setValue({ size, position });
        }
    }, [size, position, name, setValue]);

    const onResizePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
        e.stopPropagation();
        e.preventDefault();
        setResizing(true);
        resizeStart.current = {
            x: e.clientX,
            y: e.clientY,
            width: size.width,
            height: size.height,
        };
    };
    const onResizePointerMove = useCallback((e: PointerEvent) => {
        if (!resizing) return;
        let newWidth = resizeStart.current.width + (e.clientX - resizeStart.current.x);
        let newHeight = resizeStart.current.height + (e.clientY - resizeStart.current.y);
        // Limites mínimos/máximos
        newWidth = Math.max(240, Math.min(window.innerWidth - position.x, newWidth));
        newHeight = Math.max(120, Math.min(window.innerHeight - position.y, newHeight));
        setSize({ width: newWidth, height: newHeight });
    }, [resizing, position.x, position.y]);
    const onResizePointerUp = () => setResizing(false);

    useEffect(() => {
        if (resizing) {
            window.addEventListener('pointermove', onResizePointerMove);
            window.addEventListener('pointerup', onResizePointerUp);
            window.addEventListener('pointercancel', onResizePointerUp);
        } else {
            window.removeEventListener('pointermove', onResizePointerMove);
            window.removeEventListener('pointerup', onResizePointerUp);
            window.removeEventListener('pointercancel', onResizePointerUp);
        }
        return () => {
            window.removeEventListener('pointermove', onResizePointerMove);
            window.removeEventListener('pointerup', onResizePointerUp);
            window.removeEventListener('pointercancel', onResizePointerUp);
        };
    }, [resizing, onResizePointerMove]);

    const onPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
        if ((e.target as HTMLElement).closest('button')) return;
        e.preventDefault();
        setDragging(true);
        setOffset({
            x: e.clientX - position.x,
            y: e.clientY - position.y,
        });
    };
    const onPointerMove = useCallback((e: PointerEvent) => {
        if (!dragging) return;
        // Limites da tela
        const winW = window.innerWidth;
        const winH = window.innerHeight;
        let newX = e.clientX - offset.x;
        let newY = e.clientY - offset.y;
        // Respeita limites
        newX = Math.max(0, Math.min(winW - size.width, newX));
        newY = Math.max(0, Math.min(winH - size.height, newY));
        setPosition({ x: newX, y: newY });
    }, [dragging, offset.x, offset.y, size.width, size.height]);
    const onPointerUp = () => setDragging(false);

    // Attach/detach listeners
    useEffect(() => {
        if (dragging) {
            window.addEventListener('pointermove', onPointerMove);
            window.addEventListener('pointerup', onPointerUp);
            window.addEventListener('pointercancel', onPointerUp);
        } else {
            window.removeEventListener('pointermove', onPointerMove);
            window.removeEventListener('pointerup', onPointerUp);
            window.removeEventListener('pointercancel', onPointerUp);
        }
        return () => {
            window.removeEventListener('pointermove', onPointerMove);
            window.removeEventListener('pointerup', onPointerUp);
            window.removeEventListener('pointercancel', onPointerUp);
        };
    }, [dragging, onPointerMove]);

    if (!mounted || !host) return null;

    if (isMobile) {
        return createPortal(
            <WindowMobileView
                title={title}
                enabled={enabled}
                setClosed={setClosed}
                t={t}
            >
                {children}
            </WindowMobileView>,
            host
        );
    }

    // z-40: acima do conteúdo e da sidebar (z-20), abaixo dos overlays em portal (z-50).
    return createPortal(
        <div
            className="fixed z-40 flex flex-col rounded-lg shadow-lg border border-zinc-700 bg-background overflow-hidden"
            style={{ display: enabled ? 'flex' : 'none', left: position.x, top: position.y, width: size.width, height: size.height, minWidth: 240, minHeight: 120 }}
            onPointerDownCapture={bringToFront}
        >
            <div
                className="cursor-grab touch-none bg-zinc-800 text-white px-3 py-2 font-semibold select-none flex items-center justify-between"
                onPointerDown={onPointerDown}
            >
                <span className="min-w-0 flex-1 truncate">{title}</span>
                <Button size="sm" className="ml-2 cursor-pointer h-9 px-3" onClick={e => { e.stopPropagation(); setClosed?.(false); }}>{t('close')}</Button>
            </div>
            <div className="flex-1 min-h-0 overflow-hidden">{children}</div>
            {/* Handle de redimensionamento no canto inferior direito apenas no desktop */}
            <div
                className="absolute right-0 bottom-0 w-4 h-4 cursor-nwse-resize bg-zinc-700 rounded-br-lg flex items-end justify-end"
                onPointerDown={onResizePointerDown}
                style={{ zIndex: 10 }}
            >
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M2 14L14 2" stroke="#fff" strokeWidth="2" /></svg>
            </div>
        </div>,
        host
    );
}

function WindowMobileView({
    title,
    enabled,
    children,
    setClosed,
    t,
}: {
    title: React.ReactNode;
    enabled: boolean;
    children: React.ReactNode;
    setClosed?: (closed: boolean) => void;
    t: (k: string) => string;
}) {
    useEffect(() => {
        if (!enabled) return;
        const originalOverflow = document.body.style.overflow;
        const originalTouchAction = document.body.style.touchAction;
        document.body.style.overflow = 'hidden';
        document.body.style.touchAction = 'none';

        return () => {
            document.body.style.overflow = originalOverflow;
            document.body.style.touchAction = originalTouchAction;
        };
    }, [enabled]);

    return (
        <div
            className="fixed inset-0 z-50 flex flex-col bg-background overflow-hidden w-full h-full"
            style={{ display: enabled ? 'flex' : 'none' }}
        >
            <div className="bg-zinc-800 text-white px-4 py-3 font-semibold select-none flex items-center justify-between shrink-0">
                <span className="min-w-0 flex-1 truncate">{title}</span>
                <Button size="sm" className="ml-2 cursor-pointer h-9 px-3" onClick={e => { e.stopPropagation(); setClosed?.(false); }}>{t('close')}</Button>
            </div>
            <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain">{children}</div>
        </div>
    );
}