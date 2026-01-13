'use client';

import { useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { MessageCircle, Loader2, ChevronLeft, ChevronRight } from 'lucide-react';
import { useProject, useStagesByProject } from '@/lib/actions/project/queries';
import { useTranslation } from '@/hooks/use-translation';

import { cn } from '@/lib/utils';

import { Project, Stage } from '@/lib/actions/project/types';
import { ClientStageColumn } from './client-stage-column';
import { CommentModal } from '../comment-modal';

interface StageViewProps {
    project: Project
    stages: Stage[]
    projectId: string;
    setProgress?: React.Dispatch<React.SetStateAction<{stageId: string, value: number}[]>>;
}

export function StageView({ projectId, project, stages, setProgress }: StageViewProps) {
    const { t } = useTranslation('projects');

    const scrollRef = useRef<HTMLDivElement>(null);

    const handleScroll = (direction: 'left' | 'right') => {
        if (scrollRef.current) {
            const amount = 320; // px to scroll per click
            scrollRef.current.scrollBy({
                left: direction === 'left' ? -amount : amount,
                behavior: 'smooth',
            });
        }
    };

    return (
        <div className="space-y-6 w-full">
            {/* Board */}
            <div className="relative w-full">
                {stages.length > 0 ? (
                    <div className="w-full flex items-center">
                        {/* Botão esquerda */}
                        <Button
                            variant="ghost"
                            size="icon"
                            className="absolute left-0 top-1/2 -translate-y-1/2 z-10"
                            onClick={() => handleScroll('left')}
                            aria-label="Scroll left"
                        >
                            <ChevronLeft className="h-6 w-6" />
                        </Button>
                        {/* Board com scroll */}
                        <div className="overflow-x-auto w-full pb-4" ref={scrollRef}>
                            <div className="flex gap-4 min-w-max">
                                {stages.map((stage) => (
                                    <ClientStageColumn
                                        key={stage.id}
                                        stage={stage}
                                        projectId={projectId}
                                        setProgress={setProgress}
                                    />
                                ))}
                            </div>
                        </div>
                        {/* Botão direita */}
                        <Button
                            variant="ghost"
                            size="icon"
                            className="absolute right-0 top-1/2 -translate-y-1/2 z-10"
                            onClick={() => handleScroll('right')}
                            aria-label="Scroll right"
                        >
                            <ChevronRight className="h-6 w-6" />
                        </Button>
                    </div>
                ) : (
                    <Card>
                        <CardContent className="py-12 text-center">
                            <p className="text-muted-foreground">{t('noStages')}</p>
                        </CardContent>
                    </Card>
                )}
            </div>
        </div>
    );
}
