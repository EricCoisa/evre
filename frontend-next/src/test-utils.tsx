import React from 'react'
import { render } from '@testing-library/react'
import { AppProvider } from './contexts/appProvider'
import { ThemeProvider } from './contexts/theme-provider'
import { BreadProvider } from './contexts/bread-context'
import { FilterSidebarProvider } from './contexts/filter-sidebar-context'
import { SidebarProvider } from './components/ui/sidebar'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'

export function TestProviders({ children }: { children: React.ReactNode }) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return (
    <QueryClientProvider client={queryClient}>
      <AppProvider>
        <BreadProvider>
          <FilterSidebarProvider>
            <SidebarProvider>
              <ThemeProvider>{children}</ThemeProvider>
            </SidebarProvider>
          </FilterSidebarProvider>
        </BreadProvider>
      </AppProvider>
    </QueryClientProvider>
  )
}

export const customRender = (ui: React.ReactElement, options = {}) =>
  render(ui, { wrapper: TestProviders, ...options })

export * from '@testing-library/react'
export { customRender as render }
