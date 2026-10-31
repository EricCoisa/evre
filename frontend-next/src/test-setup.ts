import '@testing-library/jest-dom'
import '../i18n'
import { vi } from 'vitest'

// optional: mock window.matchMedia for components that depend on it
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: (query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: () => {},
    removeListener: () => {},
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => false,
  }),
})

// jsdom lacks ResizeObserver (used in Shadcn Tabs / Dialog / Tooltip scroll checks)
if (typeof (globalThis as Record<string, unknown>).ResizeObserver === 'undefined') {
  (globalThis as Record<string, unknown>).ResizeObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
  }
}

// jsdom lacks scrollIntoView
if (typeof window.HTMLElement.prototype.scrollIntoView !== 'function') {
  window.HTMLElement.prototype.scrollIntoView = vi.fn()
}

// jsdom's AbortSignal lags behind Node/browsers and lacks `.any` — polyfill it
// so code that combines a caller signal with an internal timeout can run under test.
if (typeof AbortSignal.any !== 'function') {
  AbortSignal.any = (signals: AbortSignal[]): AbortSignal => {
    const controller = new AbortController()
    for (const signal of signals) {
      if (signal.aborted) {
        controller.abort(signal.reason)
        break
      }
      signal.addEventListener('abort', () => controller.abort(signal.reason), { once: true })
    }
    return controller.signal
  }
}

// jsdom doesn't implement the HTML Drag and Drop or Clipboard Events specs — Lexical's paste
// handler checks `event instanceof DragEvent`/`ClipboardEvent` to tell paste sources apart, and
// an undefined constructor crashes that check with a ReferenceError instead of just being false.
for (const name of ['DragEvent', 'ClipboardEvent'] as const) {
  if (typeof (globalThis as Record<string, unknown>)[name] === 'undefined') {
    (globalThis as Record<string, unknown>)[name] = class extends Event {}
  }
}

// jsdom also has no DataTransfer (https://github.com/jsdom/jsdom/issues/1568). Without it,
// @testing-library/dom's fireEvent.paste/.drop hands Lexical a plain `{ files: [...] }` object
// that has no `.types` — and Lexical's eventFiles() unconditionally reads `dataTransfer.types`,
// crashing instead of just seeing an empty array. A real-shaped stand-in fixes that regardless
// of which DragEvent/ClipboardEvent constructor ends up matching.
if (typeof (globalThis as Record<string, unknown>).DataTransfer === 'undefined') {
  (globalThis as Record<string, unknown>).DataTransfer = class {
    files: unknown[] = []
    items: unknown[] = []
    get types() {
      return this.files.length > 0 ? ['Files'] : []
    }
  }
}

// Mock Next app router hooks used across components
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), prefetch: async () => {}, back: vi.fn(), refresh: vi.fn() }),
  usePathname: () => '/',
  useSearchParams: () => new URLSearchParams(),
  useParams: () => ({}),
}))

// Mock auth/query hooks and auth actions used by many components
vi.mock('@/lib/actions/auth/queries', () => ({
  useMe: () => ({ data: null, isLoading: false, error: null }),
}))

vi.mock('@/lib/actions/auth/auth-action', () => ({
  refresh: async () => {},
}))
