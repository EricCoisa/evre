"use client";
import React, { createContext, useContext, useState, useCallback, useMemo } from 'react';
import { DataTableContext } from '@/components/data-table';
import { Button } from '@/components/ui/button';
import { RotateCcw } from 'lucide-react';
import { useTranslation } from '@/hooks/use-translation';
import type { ReactNode } from 'react';
type DataTableContextType = React.ContextType<typeof DataTableContext>;

interface FilterSidebarContextProps {
  isOpen: boolean;
  open: (content: ReactNode, title?: string, dataTableContextValue?: DataTableContextType) => void;
  update: (content: ReactNode, dataTableContextValue?: DataTableContextType) => void;
  close: () => void;
}

const FilterSidebarContext = createContext<FilterSidebarContextProps | undefined>(undefined);

export function useFilterSidebar() {
  const ctx = useContext(FilterSidebarContext);
  if (!ctx) throw new Error('useFilterSidebar must be used within a FilterSidebarProvider');
  return ctx;
}

export function FilterSidebarProvider({ children }: { children: ReactNode }) {
  const { t } = useTranslation('common');
  const [isOpen, setIsOpen] = useState(false);
  const [content, setContent] = useState<ReactNode>(null);
  const [title, setTitle] = useState<string>('');
  const [dataTableContextValue, setDataTableContextValue] = useState<DataTableContextType | null>(null);

  const defaultTitle = t('filters');

  const open = useCallback((newContent: ReactNode, newTitle?: string, newContextValue?: DataTableContextType) => {
    setContent(newContent);
    setTitle(newTitle || '');
    setDataTableContextValue(newContextValue || null);
    setIsOpen(true);
  }, []);

  const update = useCallback((newContent: ReactNode, newContextValue?: DataTableContextType) => {
    setContent(newContent);
    if (newContextValue !== undefined) {
      setDataTableContextValue(newContextValue);
    }
  }, []);

  const close = useCallback(() => setIsOpen(false), []);

  const contextValue = useMemo(
    () => ({ isOpen, open, update, close }),
    [isOpen, open, update, close]
  );

  return (
    <FilterSidebarContext.Provider value={contextValue}>
      {children}
      {isOpen && (
        <div className="fixed inset-0 z-50 flex pointer-events-none">
          {/* Overlay com animação de fade */}
          <div 
            className="fixed inset-0 bg-black/40 pointer-events-auto transition-opacity duration-300 ease-in-out animate-in fade-in" 
            onClick={close} 
          />
          {/* Sidebar com animação de slide */}
          <div className="ml-auto w-4/5 max-w-xs h-full bg-background border-l border-border shadow-xl p-4 flex flex-col pointer-events-auto z-10 transition-transform duration-300 ease-in-out animate-in slide-in-from-right">
            <div className="flex items-center justify-between mb-4">
              <span className="font-semibold text-lg">{title || defaultTitle}</span>
              <button
                type="button"
                className="p-2 rounded hover:bg-accent transition-colors cursor-pointer"
                onClick={close}
                aria-label={t('close')}
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>
            <div className="flex-1 overflow-y-auto space-y-3">
              {dataTableContextValue ? (
                <DataTableContext.Provider value={dataTableContextValue}>
                  {content}
                </DataTableContext.Provider>
              ) : content}
            </div>
            {dataTableContextValue && (
              <div className="border-t border-border pt-3 mt-3 flex items-center gap-2 shrink-0">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="w-full flex items-center justify-center gap-1.5 h-10 text-sm font-medium cursor-pointer"
                  onClick={() => {
                    dataTableContextValue.resetFilters?.();
                  }}
                >
                  <RotateCcw className="size-4" />
                  <span>{t('resetFilters')}</span>
                </Button>
              </div>
            )}
          </div>
        </div>
      )}
    </FilterSidebarContext.Provider>
  );
}
