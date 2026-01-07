"use client"

import { useApp } from '@/contexts/appProvider';
import { useQueryClient } from '@tanstack/react-query';
import { Switch } from './ui/switch';
import { Button } from './ui/button';
import * as React from 'react';
import { Window } from './window';
import { Tree } from './tree';
import { Label } from './ui/label';


export function DevTools() {
    const { devTools ,reactScan, setReactScan, setDevTools, emulateError, setEmulateError  } = useApp();
    const queryClient = useQueryClient();
    const queries = queryClient.getQueryCache().findAll();

    return (
        <Window setClosed={setDevTools} name='devTools' title="Dev Tools" enabled={devTools}>


            <div className="bottom-4 right-4 z-50 border border-border rounded-lg shadow-lg p-4 max-h-full overflow-auto bg-card text-card-foreground">
                
                <div className="flex items-center gap-4 mb-4">
                    <div className="flex items-center gap-2">
                        <Label htmlFor="reactScan">React Scan</Label>
                        <Switch id="reactScan" aria-label="React Scan" checked={reactScan} onCheckedChange={() => setReactScan(!reactScan)} />
                    </div>
                    <div className="flex items-center gap-2">
                        <Label htmlFor="emulateError">Emular Erro</Label>
                        <Switch id="emulateError" aria-label="Emulate Error" checked={emulateError} onCheckedChange={() => setEmulateError(!emulateError)} />
                    </div>
                </div>
                
                {queries.length === 0 && <div className="text-muted-foreground">Nenhuma query ativa</div>}
                {queries.map((query, idx) => {
                    const state = query.state;
                    return (
                        <div key={idx} className="mb-4 border-b pb-2">
                            <div className="flex justify-between items-center">
                                <span className="font-mono text-xs text-card-foreground">{JSON.stringify(query.queryKey)}</span>
                                <span className="text-xs px-2 py-1 rounded bg-muted text-muted-foreground">
                                    {state.status}
                                </span>
                            </div>
                            {state.fetchStatus === 'fetching' && <div className="text-warning text-xs">Carregando...</div>}
                            {state.error && (
                                <div className="text-destructive text-xs">
                                    Erro: {String(state.error)}
                                </div>
                            )}
                            {state.data !== undefined && (
                                <details className="mt-1">
                                    <summary className="cursor-pointer text-xs text-muted-foreground">Dados</summary>
                                    <pre className="text-xs max-h-32 overflow-auto bg-muted p-2 rounded text-muted-foreground"><Tree data={state.data} /></pre>
                                </details>
                            )}
                            <Button
                                size="sm"
                                className="mt-2"
                                variant="default"
                                onClick={() => queryClient.refetchQueries({ queryKey: query.queryKey })}
                            >
                                Refetch
                            </Button>
                        </div>
                    );
                })}
                <Button
                    className="w-full mt-2"
                    variant="secondary"
                    size="sm"
                    onClick={() => queryClient.refetchQueries()}
                >
                    Refetch Todas
                </Button>
            </div>
        </Window>
    );
}