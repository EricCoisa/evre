"use client";
import React, { createContext, useContext, useState } from 'react';
import { DataTableContext } from '@/components/data-table';
import type { ReactNode } from 'react';
type DataTableContextType = React.ContextType<typeof DataTableContext>;

interface FilterSidebarContextProps {
  open: (content: ReactNode, title?: string, dataTableContextValue?: DataTableContextType) => void;
  close: () => void;
}

const FilterSidebarContext = createContext<FilterSidebarContextProps | undefined>(undefined);

export function useFilterSidebar() {
  const ctx = useContext(FilterSidebarContext);
  if (!ctx) throw new Error('useFilterSidebar must be used within a FilterSidebarProvider');
  return ctx;
}

export function FilterSidebarProvider({ children }: { children: ReactNode }) {

  const [isOpen, setIsOpen] = useState(false);
  const [content, setContent] = useState<ReactNode>(null);
  const [title, setTitle] = useState<string>('Filtros');
  const [dataTableContextValue, setDataTableContextValue] = useState<DataTableContextType | null>(null);

  const open = (content: ReactNode, title?: string, dataTableContextValue?: DataTableContextType) => {
    setContent(content);
    setTitle(title || 'Filtros');
    setDataTableContextValue(dataTableContextValue || null);
    setIsOpen(true);
  };
  const close = () => setIsOpen(false);

  return (
    <FilterSidebarContext.Provider value={{ open, close }}>
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
              <span className="font-semibold text-lg">{title}</span>
              <button
                type="button"
                className="p-2 rounded hover:bg-accent transition-colors"
                onClick={close}
                aria-label="Fechar filtros"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>
            <div className="flex-1 overflow-y-auto">
              {dataTableContextValue ? (
                <DataTableContext.Provider value={dataTableContextValue}>
                  {content}
                </DataTableContext.Provider>
              ) : content}
            </div>
          </div>
        </div>
      )}
    </FilterSidebarContext.Provider>
  );
}
