"use client";

import React from 'react';
import { cn } from '@/lib/utils';
import Image from 'next/image';
import { remotePatterns } from '@/../remotePattern';
import { parse } from 'url';

interface ImageComponentProps {
  value: string;
  alt?: string;
  caption?: string;
  className?: string;
}

export function ImageComponent({ value, alt, caption, className }: ImageComponentProps) {
  // Função para verificar se o value (URL) contém algum hostname de remotePatterns
  const isRemotePattern = (() => {
    try {
      const { hostname } = parse(value);
      return remotePatterns.some(pattern => pattern.hostname === hostname);
    } catch {
      return false;
    }
  })();

  console.log('isRemotePattern:', isRemotePattern, 'for value:', value);

  return (
    <figure className={cn('my-4 md:my-8', className)}>
      <div className="relative w-full h-64 md:h-96 lg:h-[500px] rounded-xl overflow-hidden shadow-lg">
        {isRemotePattern ? (
          <Image
            src={value}
            alt={alt || 'Imagem da proposta'}
            fill
            className="object-cover"
            sizes="(max-width: 768px) 100vw, (max-width: 1200px) 80vw, 70vw"
          />
        ) : (
          <img
            src={value}
            alt={alt || 'Imagem da proposta'}
            className="object-cover w-full h-full"
            style={{ objectFit: 'cover', width: '100%', height: '100%' }}
          />
        )}
      </div>
      {caption && (
        <figcaption className="text-sm text-muted-foreground text-center mt-3 italic">
          {caption}
        </figcaption>
      )}
    </figure>
  );
}
