import React from 'react'
import { z } from 'zod'
import { render } from '@/test-utils'
import { FormBuilder } from '@/components/form/form-builder'

// Import components (exclude components/ui)
import * as AsyncBoundary from '@/components/async-boundary'
import * as Banner from '@/components/banner'
import * as BaseConfiguration from '@/components/base-configuration'
import * as BreadcrumbNav from '@/components/breadcrumb-nav'
import * as ChartAreaInteractive from '@/components/chart-area-interactive'
import * as CmsLayoutWrapper from '@/components/cms-layout-wrapper'
import * as ConditionalBreadcrumb from '@/components/conditional-breadcrumb'
import * as Container from '@/components/container'
import * as DataTable from '@/components/data-table'
import * as DevTools from '@/components/devTools'
import * as Header from '@/components/header'
import * as IsDev from '@/components/isDev'
import * as Modal from '@/components/modal'
import * as NavDocuments from '@/components/nav-documents'
import * as NavMain from '@/components/nav-main'
import * as NavSecondary from '@/components/nav-secondary'
import * as NavUser from '@/components/nav-user'
import * as PageTitle from '@/components/page-title'
import * as SectionCards from '@/components/section-cards'
import * as Seo from '@/components/seo'
import * as SidebarLogo from '@/components/sidebar-logo'
import * as SidebarNav from '@/components/sidebar-nav'
import * as SiteHeader from '@/components/site-header'
import * as SystemConfiguration from '@/components/system-configuration'
import * as PanelSkeleton from '@/components/panel-skeleton'
import * as TableSkeleton from '@/components/table-skeleton'
import * as TableUtils from '@/components/table-utils'
import * as ThemeToggle from '@/components/theme-toggle'
import * as Tour from '@/components/tour'
import * as Tree from '@/components/tree'
import * as Upload from '@/components/upload'
import * as UserConfiguration from '@/components/user-configuration'
import * as UserMenu from '@/components/user-menu'
import * as UserSystemDefinitions from '@/components/user-system-definitions'
import * as WindowComp from '@/components/window'
import * as AppSidebar from '@/components/app-sidebar'
import * as ConfigRow from '@/components/config-row'

const modules = [
  AsyncBoundary,
  Banner,
  BaseConfiguration,
  BreadcrumbNav,
  ChartAreaInteractive,
  CmsLayoutWrapper,
  ConditionalBreadcrumb,
  Container,
  DataTable,
  DevTools,
  Header,
  IsDev,
  Modal,
  NavDocuments,
  NavMain,
  NavSecondary,
  NavUser,
  PageTitle,
  SectionCards,
  Seo,
  SidebarLogo,
  SidebarNav,
  SiteHeader,
  SystemConfiguration,
  PanelSkeleton,
  TableSkeleton,
  TableUtils,
  ThemeToggle,
  Tour,
  Tree,
  Upload,
  UserConfiguration,
  UserMenu,
  UserSystemDefinitions,
  WindowComp,
  AppSidebar,
  ConfigRow,
]

// FormBuilder fica fora da varredura acima: `schema` é obrigatório, e renderizá-lo com
// `{}` estoura dentro do zod. Ganha um teste próprio, que cobre mais que o smoke.
describe('FormBuilder', () => {
  test('renders with a schema', () => {
    const schema = z.object({ email: z.string() })
    const { container } = render(
      <FormBuilder schema={schema} onSubmit={async () => {}} />,
    )
    expect(container.querySelector('form')).toBeTruthy()
  })
})

describe('Smoke test: render components (excluding components/ui)', () => {
  modules.forEach((mod) => {
    const name = Object.keys(mod).find((k) => k.toLowerCase().includes('default')) || Object.keys(mod)[0] || 'module'
    test(`renders ${name}`, () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const Component = (mod as any).default || (mod as any)[name] || Object.values(mod)[0]
      // If module export is not a component (string/number/etc.), skip
      if (!Component || (typeof Component !== 'function' && typeof Component !== 'object')) {
        expect(true).toBeTruthy()
        return
      }

      // Try rendering; many components can accept no props
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { container } = render(React.createElement(Component as any, {}))
      expect(container).toBeTruthy()
    })
  })
})
