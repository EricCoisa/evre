"use client"

import { useEffect, useRef, useState } from 'react';
import { useLocalStorage } from '@/hooks/use-localStorage';
import { Button } from './ui/button';
import { useTranslation } from '@/hooks/use-translation';

export interface WindowProps {
    title: string
    enabled?: boolean
    children: React.ReactNode
    name?: string
    setClosed?: (closed: boolean) => void
}

export function Window({ title, enabled = true, children, name, setClosed }: WindowProps) {
    const { t } = useTranslation("common");
    // LocalStorage integration
    const { getValue, setValue } = useLocalStorage<{ size: { width: number, height: number }, position: { x: number, y: number } }>(name || "window-default");

    // Estado para redimensionamento (valores padrão)
    const [size, setSize] = useState<{ width: number, height: number }>({ width: 320, height: 180 });
    const [resizing, setResizing] = useState(false);
    const resizeStart = useRef({ x: 0, y: 0, width: 320, height: 180 });

    // Drag state
    const windowRef = useRef<HTMLDivElement>(null);
    const [dragging, setDragging] = useState(false);
    const [position, setPosition] = useState<{ x: number, y: number }>({ x: 40, y: 40 });
    const [offset, setOffset] = useState({ x: 0, y: 0 });

    // Buscar valores salvos do localStorage apenas no client
    useEffect(() => {
        if (name) {
            const saved = getValue();
            if (saved?.size) setSize(saved.size);
            if (saved?.position) setPosition(saved.position);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [name]);
    // Salva no localStorage ao mudar tamanho ou posição
    useEffect(() => {
        if (name) {
            setValue({ size, position });
        }
    }, [size, position, name, setValue]);

    const onResizeMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
        e.stopPropagation();
        setResizing(true);
        resizeStart.current = {
            x: e.clientX,
            y: e.clientY,
            width: size.width,
            height: size.height,
        };
    };
    const onResizeMouseMove = (e: MouseEvent) => {
        if (!resizing) return;
        let newWidth = resizeStart.current.width + (e.clientX - resizeStart.current.x);
        let newHeight = resizeStart.current.height + (e.clientY - resizeStart.current.y);
        // Limites mínimos/máximos
        newWidth = Math.max(240, Math.min(window.innerWidth - position.x, newWidth));
        newHeight = Math.max(120, Math.min(window.innerHeight - position.y, newHeight));
        setSize({ width: newWidth, height: newHeight });
    };
    const onResizeMouseUp = () => setResizing(false);

    useEffect(() => {
        if (resizing) {
            window.addEventListener('mousemove', onResizeMouseMove);
            window.addEventListener('mouseup', onResizeMouseUp);
        } else {
            window.removeEventListener('mousemove', onResizeMouseMove);
            window.removeEventListener('mouseup', onResizeMouseUp);
        }
        return () => {
            window.removeEventListener('mousemove', onResizeMouseMove);
            window.removeEventListener('mouseup', onResizeMouseUp);
        };
    }, [resizing]);

    // Mouse events
    const onMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
        setDragging(true);
        setOffset({
            x: e.clientX - position.x,
            y: e.clientY - position.y,
        });
    };
    const onMouseMove = (e: MouseEvent) => {
        if (!dragging) return;
        // Limites da tela
        const winW = window.innerWidth;
        const winH = window.innerHeight;
        let newX = e.clientX - offset.x;
        let newY = e.clientY - offset.y;
        // Respeita limites
        newX = Math.max(0, Math.min(winW - 320, newX));
        newY = Math.max(0, Math.min(winH - 240, newY));
        setPosition({ x: newX, y: newY });
    };
    const onMouseUp = () => setDragging(false);

    // Attach/detach listeners
    useEffect(() => {
        if (dragging) {
            window.addEventListener('mousemove', onMouseMove);
            window.addEventListener('mouseup', onMouseUp);
        } else {
            window.removeEventListener('mousemove', onMouseMove);
            window.removeEventListener('mouseup', onMouseUp);
        }
        return () => {
            window.removeEventListener('mousemove', onMouseMove);
            window.removeEventListener('mouseup', onMouseUp);
        };
    }, [dragging]);

    return (
        <div
            ref={windowRef}
            className="fixed z-50 rounded-lg shadow-lg border border-zinc-700 bg-background overflow-hidden"
            style={{ display: enabled ? 'block' : 'none', left: position.x, top: position.y, width: size.width, height: size.height, minWidth: 240, minHeight: 120 }}
        >
            <div
                className="cursor-grab bg-zinc-800 text-white px-3 py-2 font-semibold select-none flex items-center justify-between"
                onMouseDown={onMouseDown}
            >
                <span>{title}</span>
                <Button size="sm" className="ml-2 cursor-pointer" onClick={e => { e.stopPropagation(); setClosed && setClosed(false); }}>{t('close')}</Button>
            </div>
            {children}
            {/* Handle de redimensionamento no canto inferior direito */}
            <div
                className="absolute right-0 bottom-0 w-4 h-4 cursor-nwse-resize bg-zinc-700 rounded-br-lg flex items-end justify-end"
                onMouseDown={onResizeMouseDown}
                style={{ zIndex: 10 }}
            >
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M2 14L14 2" stroke="#fff" strokeWidth="2" /></svg>
            </div>
        </div>
    );
}