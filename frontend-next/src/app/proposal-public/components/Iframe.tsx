"use client";

import React, { useState } from 'react';
import { cn } from '@/lib/utils';
import Modal from '@/components/modal';

interface IframeComponentProps {
    onscroll?: boolean;
    value: string; // URL do iframe
    title?: string;
    width?: string | number;
    height?: string | number;
    allow?: string;
    className?: string;
    modal?: boolean;
}

export function IframeContainer({onscroll, value, title, width = '100%', height = 400, allow, className, modal }: IframeComponentProps) {
    return (
        <div className="relative w-full h-full" style={{width: '100%', height: '100%'}}>
            <iframe
                src={value}
                title={title || 'Conteúdo incorporado'}
                width="100%"
                height="100%"
                allow={allow}
                className={cn("w-full h-full min-h-[300px] border-0", className)}
                style={{ width: width, height: height, minHeight: 300, display: 'block' }}
                loading="lazy"
                allowFullScreen
                scrolling={onscroll ? 'yes' : 'no'}
            />
            {(!onscroll && modal == true) && (
                <div
                    className="absolute inset-0 z-10 cursor-pointer"
                    style={{ pointerEvents: 'auto', cursor: 'pointer' }}
                />
            )}
        </div>
    );
}

export function IframeComponent({ value, title, width = '100%', height = 400, allow, className, modal = true }: IframeComponentProps) {
    const [onModal, setModal] = useState(false);

    return (
        <>
            <figure className={cn('my-4 md:my-8', className)} onClick={()=> modal == true && setModal(true)}>
                <div className="relative w-full rounded-xl overflow-hidden shadow-lg">
                    {!onModal &&
                        <IframeContainer onscroll={false} value={value} title={title} width={width} height={height} allow={allow} className={className} modal={modal} />
                    }
                </div>
                {title && (
                    <figcaption className="text-sm text-muted-foreground text-center mt-3 italic">
                        {title}
                    </figcaption>
                )}
            </figure>

            <Modal
                open={onModal}
                onOpenChange={setModal}
                title={title}
                maxWidth="98vw"
                width="98vw"
                height="90vh"
            >
                <div className="w-full h-[85vh] min-h-[400px] flex items-stretch" style={{height: '85vh', minHeight: 400}}>
                    <IframeContainer
                        onscroll={true}
                        value={value}
                        title={title}
                        width="100%"
                        height="100%"
                        allow={allow}
                        className={className}
                    />
                </div>
            </Modal>
        </>
    );
}
