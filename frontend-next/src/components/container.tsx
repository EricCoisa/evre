"use client";

import { cn } from "@/lib/cn";
import { useState } from "react";

export type ContainerVariant = 'default' | 'dataTable' | 'sortableTable' | 'form' | 'config' | 'configGroup' | 'dashboard' | 'stats' | 'compact' | 'notification';

// 10 variant names kept for semantics; only 2 actual heights
const AUTO_HEIGHT_VARIANTS: ContainerVariant[] = ['config', 'configGroup', 'stats', 'compact', 'notification'];

interface ContainerBaseProps {
    children: React.ReactNode;
    className?: string;
    variant?: ContainerVariant;
    widthClass?: string;
}

interface ContainerSpacingProps {
    noSpacing?: boolean;
    padding?: boolean;
}

interface ContainerBorderProps {
    border?: boolean;
}

interface ContainerCollapsibleProps {
    collapsible?: boolean;
    defaultExpanded?: boolean;
}

interface ContainerGridItemProps {
    gridItem?: {
        colStart?: number;
        colEnd?: number;
        rowStart?: number;
        rowEnd?: number;
        area?: string;
    };
}

export type ContainerProps =
    & ContainerBaseProps
    & Partial<ContainerSpacingProps & ContainerBorderProps & ContainerCollapsibleProps & ContainerGridItemProps>;

type ContainerGridProps = {
    children: React.ReactNode;
    columns?: number | string;
    rows?: string;
    gap?: string;
    className?: string;
    style?: React.CSSProperties;
}

export function ContainerGrid({ children, columns = 3, rows = 'auto', gap = '1rem', className, style }: ContainerGridProps) {
    const gridStyle: React.CSSProperties = {
        display: 'grid',
        gridTemplateColumns: typeof columns === 'number' ? `repeat(${columns}, minmax(0, 1fr))` : columns,
        gridTemplateRows: rows,
        gap,
        width: '100%',
        ...style
    };
    return (
        <div className={cn('w-full', className)} style={gridStyle}>
            {children}
        </div>
    );
}

function resolveGridItemStyle(gridItem?: ContainerProps['gridItem']): React.CSSProperties {
    if (!gridItem) return {};
    const style: React.CSSProperties = {};
    if (gridItem.colStart) style.gridColumnStart = gridItem.colStart;
    if (gridItem.colEnd) style.gridColumnEnd = gridItem.colEnd;
    if (gridItem.rowStart) style.gridRowStart = gridItem.rowStart;
    if (gridItem.rowEnd) style.gridRowEnd = gridItem.rowEnd;
    if (gridItem.area) style.gridArea = gridItem.area;
    return style;
}

function getContainerInnerClass(border: boolean, heightClass: string, widthClass: string, isExpanded: boolean): string {
    return cn(
        'rounded-lg flex flex-col transition-shadow duration-300',
        border && 'border border-border bg-card',
        heightClass,
        widthClass,
        !isExpanded && 'min-h-0 h-auto max-h-20 overflow-hidden'
    );
}

function resolveContainerHeight(variant?: ContainerVariant) {
    return variant && AUTO_HEIGHT_VARIANTS.includes(variant) ? 'h-auto min-h-[50px]' : 'h-full min-h-[50px]';
}

export function Container(props: ContainerProps) {
    const {
        children,
        className,
        variant = 'default',
        noSpacing,
        border = true,
        defaultExpanded = true,
        widthClass = 'w-full',
        gridItem,
        padding = true,
    } = props;
    const [isExpanded] = useState<boolean>(Boolean(defaultExpanded));
    const heightClass = resolveContainerHeight(variant);
    const outerClass = cn(!noSpacing && 'space-y-2 sm:space-y-4 md:space-y-6', 'flex flex-col rounded-xl', className);
    const innerPaddingClass = cn('flex flex-col', padding ? (variant === 'dataTable' ? 'p-0 sm:p-6' : 'p-3 sm:p-6 pt-2') : '');

    return (
        <div className={outerClass}>
            <div
                className={getContainerInnerClass(border, heightClass, widthClass, isExpanded)}
                style={resolveGridItemStyle(gridItem)}
            >
                <div className={innerPaddingClass}>
                    {isExpanded && <div className="flex-1 flex flex-col">{children}</div>}
                </div>
            </div>
        </div>
    );
}
