

import React, { useState } from "react";

interface TreeProps {
    data: unknown;
    level?: number;
    maxLines?: number;
    keyColor?: string; // classe Tailwind opcional para valores primitivos
    valueColor?: string; // classe Tailwind opcional para chaves de objeto
    nullColor?: string; // classe Tailwind opcional para valores nulos/undefined e índices
}

export function Tree({ data, level = 0, maxLines, keyColor, valueColor, nullColor }: TreeProps) {
    // Definir valores padrão para as cores caso não sejam passadas
    const keyColorClass = keyColor || "text-emerald-600 dark:text-emerald-400";
    const valueColorClass = valueColor || "text-slate-900 dark:text-slate-100";
    const nullColorClass = nullColor || "text-slate-600 dark:text-slate-400";
    // Collapse logic for arrays and objects with children
    const [collapsed, setCollapsed] = useState<Record<string | number, boolean>>({});
    const [lineCount, setLineCount] = useState<number>(0);

    if (data === null || data === undefined) {
        return <span className={nullColorClass}>{String(data)}</span>;
    }
    if (typeof data !== "object") {
        return <span className={keyColorClass}>{JSON.stringify(data)}</span>;
    }

    // Array
    if (Array.isArray(data)) {
        return (
            <ul className="pl-4 border-l border-slate-300 ml-2">
                {data.slice(0, maxLines && level === 0 ? maxLines : data.length).map((item, idx) => {
                    const hasChildren = typeof item === "object" && item !== null && (Array.isArray(item) ? item.length > 0 : Object.keys(item).length > 0);
                    const isCollapsed = collapsed[idx] ?? false;
                    return (
                        <li key={idx} className="mb-1">
                            {hasChildren ? (
                                <button
                                    className={`font-mono mr-1 select-none focus:outline-none ${nullColorClass}`}
                                    onClick={() => setCollapsed(c => ({ ...c, [idx]: !isCollapsed }))}
                                >
                                    {isCollapsed ? "+" : "-"}
                                </button>
                            ) : <span className={nullColorClass}>[{idx}]</span>}
                            <span className={nullColorClass}>[{idx}]</span>
                            {!isCollapsed && hasChildren ? <Tree data={item} level={level + 1} keyColor={keyColorClass} valueColor={valueColorClass} nullColor={nullColorClass} /> : null}
                            {!hasChildren ? <Tree data={item} level={level + 1} keyColor={keyColorClass} valueColor={valueColorClass} nullColor={nullColorClass} /> : null}
                        </li>
                    );
                })}

            </ul>
        );
    }
    // Object
    return (
        <ul className="pl-4 border-l border-slate-300 ml-2">
            {Object.entries(data).slice(0, maxLines && level === 0 ? maxLines : Object.entries(data).length).map(([key, value]) => {
                const hasChildren = typeof value === "object" && value !== null && (Array.isArray(value) ? value.length > 0 : Object.keys(value).length > 0);
                const isCollapsed = collapsed[key] ?? false;
                return (
                    <li key={key} className="mb-1">
                        {hasChildren ? (
                            <button
                                className={`font-mono mr-1 select-none focus:outline-none ${valueColorClass}`}
                                onClick={() => setCollapsed(c => ({ ...c, [key]: !isCollapsed }))}
                            >
                                {isCollapsed ? "+" : "-"}
                            </button>
                        ) : null}
                        <span className={valueColorClass}>{key}</span>:
                        {!isCollapsed && hasChildren ? <Tree data={value} level={level + 1} keyColor={keyColorClass} valueColor={valueColorClass} nullColor={nullColorClass} /> : null}
                        {!hasChildren ? <Tree data={value} level={level + 1} keyColor={keyColorClass} valueColor={valueColorClass} nullColor={nullColorClass} /> : null}
                    </li>
                );
            })}
        </ul>
    );
}