

import React, { useState } from "react";

interface TreeProps {
    data: unknown;
    level?: number;
    maxLines?: number;
    keyColor?: string; // classe Tailwind opcional para valores primitivos
    valueColor?: string; // classe Tailwind opcional para chaves de objeto
    nullColor?: string; // classe Tailwind opcional para valores nulos/undefined e índices
}

function hasNestedChildren(val: unknown): boolean {
    return typeof val === "object" && val !== null && (Array.isArray(val) ? val.length > 0 : Object.keys(val).length > 0);
}

interface NodeProps {
    level: number;
    maxLines?: number;
    keyColorClass: string;
    valueColorClass: string;
    nullColorClass: string;
}

function ArrayTree({ data, level, maxLines, keyColorClass, valueColorClass, nullColorClass }: { data: unknown[] } & NodeProps) {
    const [collapsed, setCollapsed] = useState<Record<number, boolean>>({});
    const items = data.slice(0, maxLines && level === 0 ? maxLines : data.length);

    return (
        <ul className="pl-4 border-l border-slate-300 ml-2">
            {items.map((item, idx) => {
                const hasChildren = hasNestedChildren(item);
                const isCollapsed = collapsed[idx] ?? false;
                return (
                    <li key={idx} className="mb-1 break-all min-w-0 max-w-full">
                        {hasChildren ? (
                            <button
                                className={`font-mono mr-1 select-none focus:outline-none ${nullColorClass}`}
                                onClick={() => setCollapsed(c => ({ ...c, [idx]: !isCollapsed }))}
                            >
                                {isCollapsed ? "+" : "-"}
                            </button>
                        ) : null}
                        <span className={nullColorClass}>[{idx}]</span>
                        {(!isCollapsed && hasChildren) || !hasChildren ? (
                            <Tree data={item} level={level + 1} keyColor={keyColorClass} valueColor={valueColorClass} nullColor={nullColorClass} />
                        ) : null}
                    </li>
                );
            })}
        </ul>
    );
}

function ObjectTree({ data, level, maxLines, keyColorClass, valueColorClass, nullColorClass }: { data: Record<string, unknown> } & NodeProps) {
    const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});
    const entries = Object.entries(data).slice(0, maxLines && level === 0 ? maxLines : Object.entries(data).length);

    return (
        <ul className="pl-4 border-l border-slate-300 ml-2">
            {entries.map(([key, value]) => {
                const hasChildren = hasNestedChildren(value);
                const isCollapsed = collapsed[key] ?? false;
                return (
                    <li key={key} className="mb-1 break-all min-w-0 max-w-full">
                        {hasChildren ? (
                            <button
                                className={`font-mono mr-1 select-none focus:outline-none ${valueColorClass}`}
                                onClick={() => setCollapsed(c => ({ ...c, [key]: !isCollapsed }))}
                            >
                                {isCollapsed ? "+" : "-"}
                            </button>
                        ) : null}
                        <span className={valueColorClass}>{key}</span>:
                        {(!isCollapsed && hasChildren) || !hasChildren ? (
                            <Tree data={value} level={level + 1} keyColor={keyColorClass} valueColor={valueColorClass} nullColor={nullColorClass} />
                        ) : null}
                    </li>
                );
            })}
        </ul>
    );
}

export function Tree({ data, level = 0, maxLines, keyColor, valueColor, nullColor }: TreeProps) {
    const keyColorClass = keyColor || "text-emerald-600 dark:text-emerald-400";
    const valueColorClass = valueColor || "text-slate-900 dark:text-slate-100";
    const nullColorClass = nullColor || "text-slate-600 dark:text-slate-400";

    if (data === null || data === undefined) {
        return <span className={`${nullColorClass} break-all`}>{String(data)}</span>;
    }
    if (typeof data !== "object") {
        return <span className={`${keyColorClass} break-all`}>{JSON.stringify(data)}</span>;
    }

    const nodeProps = { level, maxLines, keyColorClass, valueColorClass, nullColorClass };

    if (Array.isArray(data)) {
        return <ArrayTree data={data} {...nodeProps} />;
    }

    return <ObjectTree data={data as Record<string, unknown>} {...nodeProps} />;
}