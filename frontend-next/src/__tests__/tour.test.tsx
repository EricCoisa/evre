/** Testa o sistema de tours nomeados: registro, abertura pelo HelpButton e ausência de auto-open. */
import React, { useEffect } from 'react'
import { render, screen, fireEvent, act } from '@/test-utils'
import {
  TourProvider,
  HelpButton,
  TourAlertDialog,
  useTour,
  ignoreTourInteraction,
  type TourStep,
  isTourStepVisible,
  filterTourSteps,
  filterStepsBySubNavSections,
} from '@/components/tour'
import type { SubNavSection } from '@/components/sub-nav-layout'
import { resources } from '@/lib/translation-utils'
import { vi } from 'vitest'

window.HTMLElement.prototype.scrollIntoView = vi.fn()

const originalGetBoundingClientRect = HTMLElement.prototype.getBoundingClientRect

/** Faz `document.getElementById(id)` responder com um rect não-zero (simula um elemento visível com layout real). */
function mockElementRect(id: string, rect: Partial<DOMRect>) {
  HTMLElement.prototype.getBoundingClientRect = function (this: HTMLElement) {
    if (this.id === id) {
      return {
        top: 0, left: 0, width: 100, height: 40, right: 0, bottom: 0, x: 0, y: 0,
        toJSON() { return this },
        ...rect,
      } as DOMRect
    }
    return originalGetBoundingClientRect.call(this)
  }
}

function restoreElementRect() {
  HTMLElement.prototype.getBoundingClientRect = originalGetBoundingClientRect
}

// Minimal consumer that registers a tour and exposes controls via data-testid
function TourConsumer({ steps, tourId }: { steps: TourStep[]; tourId: string }) {
  const { registerTour, startTour, isActive, currentStep, nextStep } = useTour()

  useEffect(() => {
    registerTour(tourId, steps)
  }, [registerTour, tourId, steps])

  return (
    <div>
      <button data-testid="start" onClick={() => startTour(tourId)}>
        start
      </button>
      <button data-testid="next" onClick={nextStep}>
        next
      </button>
      <span data-testid="active">{String(isActive)}</span>
      <span data-testid="step">{currentStep}</span>
      {/* target element so overlay can position */}
      <div id="step-1">Step target 1</div>
      <div id="step-2">Step target 2</div>
      <div id="mobile-step-1">Mobile Step target 1</div>
    </div>
  )
}

const STEPS: TourStep[] = [
  { content: 'First step content', selectorId: 'step-1', position: 'bottom' },
  { content: 'Second step content', selectorId: 'step-2', position: 'bottom' },
]

describe('TourProvider — named tours', () => {
  it('is not active on boot (no auto-open)', () => {
    render(
      <TourProvider>
        <TourConsumer steps={STEPS} tourId="test-tour" />
      </TourProvider>,
    )
    expect(screen.getByTestId('active').textContent).toBe('false')
    expect(screen.getByTestId('step').textContent).toBe('-1')
  })

  it('starts the named tour when startTour(tourId) is called', () => {
    render(
      <TourProvider>
        <TourConsumer steps={STEPS} tourId="test-tour" />
      </TourProvider>,
    )
    act(() => {
      fireEvent.click(screen.getByTestId('start'))
    })
    expect(screen.getByTestId('active').textContent).toBe('true')
    expect(screen.getByTestId('step').textContent).toBe('0')
    expect(screen.getByText('First step content')).toBeTruthy()
  })

  it('registers multiple tours independently', () => {
    function MultiConsumer() {
      const { registerTour, startTour, currentStep } = useTour()
      useEffect(() => {
        registerTour('tour-a', STEPS)
        registerTour('tour-b', [{ content: 'B', selectorId: 'step-1' }])
      }, [registerTour])
      return (
        <div>
          <button data-testid="start-a" onClick={() => startTour('tour-a')} />
          <button data-testid="start-b" onClick={() => startTour('tour-b')} />
          <span data-testid="step">{currentStep}</span>
          <div id="step-1" />
        </div>
      )
    }
    render(
      <TourProvider>
        <MultiConsumer />
      </TourProvider>,
    )
    act(() => { fireEvent.click(screen.getByTestId('start-b')) })
    // tour-b has 1 step, so currentStep is 0
    expect(screen.getByTestId('step').textContent).toBe('0')
  })

  it('triggers onEnter callback when a step is activated', () => {
    const onEnterStep0 = vi.fn()
    const onEnterStep1 = vi.fn()
    const stepsWithOnEnter: TourStep[] = [
      { content: 'Step 0', selectorId: 'step-1', onEnter: onEnterStep0 },
      { content: 'Step 1', selectorId: 'step-2', onEnter: onEnterStep1 },
    ]
    render(
      <TourProvider>
        <TourConsumer steps={stepsWithOnEnter} tourId="callback-tour" />
      </TourProvider>,
    )
    act(() => {
      fireEvent.click(screen.getByTestId('start'))
    })
    expect(onEnterStep0).toHaveBeenCalledTimes(1)
    expect(onEnterStep1).not.toHaveBeenCalled()

    act(() => {
      fireEvent.click(screen.getByTestId('next'))
    })
    expect(onEnterStep1).toHaveBeenCalledTimes(1)
  })

  it('renders tour content gracefully when element is not found or hidden', () => {
    const hiddenSteps: TourStep[] = [
      { content: 'Step for nonexistent element', selectorId: 'nonexistent-id' },
    ]
    render(
      <TourProvider>
        <TourConsumer steps={hiddenSteps} tourId="hidden-tour" />
      </TourProvider>,
    )
    act(() => {
      fireEvent.click(screen.getByTestId('start'))
    })
    expect(screen.getByTestId('active').textContent).toBe('true')
    expect(screen.getByText('Step for nonexistent element')).toBeTruthy()
  })

  it('supports mobileSelectorId and renders mobile-adapted card in mobile viewport', () => {
    const originalWidth = window.innerWidth
    window.innerWidth = 400

    const mobileSteps: TourStep[] = [
      {
        content: 'Mobile responsive content',
        selectorId: 'step-1',
        mobileSelectorId: 'mobile-step-1',
      },
    ]

    render(
      <TourProvider>
        <TourConsumer steps={mobileSteps} tourId="mobile-tour" />
      </TourProvider>,
    )

    act(() => {
      window.dispatchEvent(new Event('resize'))
      fireEvent.click(screen.getByTestId('start'))
    })
    expect(screen.getByText('Mobile responsive content')).toBeTruthy()

    act(() => {
      window.innerWidth = originalWidth
      window.dispatchEvent(new Event('resize'))
    })
  })
})

describe('HelpButton', () => {
  it('renders a button and opens the dialog on click', () => {
    render(
      <TourProvider>
        <TourConsumer steps={STEPS} tourId="help-tour" />
        <HelpButton tourId="help-tour" />
      </TourProvider>,
    )
    // Dialog should not be visible before clicking
    expect(screen.queryByRole('alertdialog')).toBeNull()

    act(() => {
      fireEvent.click(screen.getByRole('button', { name: /tour/i }))
    })
    expect(screen.getByRole('alertdialog')).toBeTruthy()
  })

  it('does not auto-open on mount (no dialog without click)', () => {
    render(
      <TourProvider>
        <TourConsumer steps={STEPS} tourId="no-auto" />
        <HelpButton tourId="no-auto" />
      </TourProvider>,
    )
    expect(screen.queryByRole('alertdialog')).toBeNull()
  })
})

describe('tour namespace — resources registration', () => {
  it('welcomeTitle resolves to translated text (not raw key)', () => {
    const ptBR = resources['pt-BR'] as Record<string, Record<string, string>>
    const en = resources['en'] as Record<string, Record<string, string>>
    expect(ptBR.tour?.welcomeTitle).toBe('Bem-vindo ao Tour')
    expect(en.tour?.welcomeTitle).toBe('Welcome to the Tour')
  })
})

describe('Capability-aware and visibility-aware tour filtering', () => {
  it('isTourStepVisible filters steps by hidden flag', () => {
    expect(isTourStepVisible({ content: 'A', selectorId: 'a', hidden: true })).toBe(false)
    expect(isTourStepVisible({ content: 'A', selectorId: 'a', hidden: false })).toBe(true)
  })

  it('isTourStepVisible evaluates dynamic condition', () => {
    expect(isTourStepVisible({ content: 'A', selectorId: 'a', condition: () => false })).toBe(false)
    expect(isTourStepVisible({ content: 'A', selectorId: 'a', condition: () => true })).toBe(true)
    expect(isTourStepVisible({ content: 'A', selectorId: 'a', condition: false })).toBe(false)
    expect(isTourStepVisible({ content: 'A', selectorId: 'a', condition: true })).toBe(true)
  })

  it('isTourStepVisible evaluates backend capability status (available flag)', () => {
    const capabilities = {
      MESSAGING: { available: false, operational: false },
      EMAIL: { available: true, operational: true },
    }

    expect(isTourStepVisible({ content: 'A', selectorId: 'a', capability: 'MESSAGING' }, capabilities)).toBe(false)
    expect(isTourStepVisible({ content: 'B', selectorId: 'b', capability: 'EMAIL' }, capabilities)).toBe(true)
    // Se a capability não está no dicionário (carregando ou desconhecida), não bloqueia
    expect(isTourStepVisible({ content: 'C', selectorId: 'c', capability: 'UNKNOWN' }, capabilities)).toBe(true)
  })

  it('filterTourSteps filters out hidden steps and unavailable capabilities', () => {
    const capabilities = {
      MESSAGING: { available: false, operational: false },
      EMAIL: { available: true, operational: true },
    }
    const steps: TourStep[] = [
      { content: 'Step 1', selectorId: 's1', capability: 'MESSAGING' },
      { content: 'Step 2', selectorId: 's2', capability: 'EMAIL' },
      { content: 'Step 3', selectorId: 's3', hidden: true },
    ]
    const filtered = filterTourSteps(steps, capabilities)
    expect(filtered.map((s) => s.content)).toEqual(['Step 2'])
  })

  it('filterStepsBySubNavSections excludes steps for hidden tabs in sections', () => {
    const sections: SubNavSection[] = [
      {
        id: 'general',
        title: 'General',
        items: [
          { id: 'tab-1', idAttr: 'tab-trigger-1', label: 'Tab 1' },
          { id: 'tab-2', idAttr: 'tab-trigger-2', label: 'Tab 2', hidden: true },
        ],
      },
    ]

    const steps: TourStep[] = [
      { content: 'Step 1', tabId: 'tab-1', selectorId: 'tab-trigger-1' },
      { content: 'Step 2', tabId: 'tab-2', selectorId: 'tab-trigger-2' },
      { content: 'Step 3', selectorId: 'tab-trigger-2' }, // matches hidden item's idAttr
      { content: 'Step 4', selectorId: 'other-element' },
    ]

    const filtered = filterStepsBySubNavSections(steps, sections)
    expect(filtered.map((s) => s.content)).toEqual(['Step 1', 'Step 4'])
  })

  it('TourProvider starts tour with only visible steps', () => {
    const customSteps: TourStep[] = [
      { content: 'Visible Step 1', selectorId: 'step-1' },
      { content: 'Hidden Step', selectorId: 'step-2', hidden: true },
      { content: 'Visible Step 2', selectorId: 'step-2' },
    ]

    render(
      <TourProvider>
        <TourConsumer steps={customSteps} tourId="filtered-tour" />
      </TourProvider>,
    )

    act(() => {
      fireEvent.click(screen.getByTestId('start'))
    })

    expect(screen.getByText('Visible Step 1')).toBeTruthy()
    expect(screen.getByText('1 / 2')).toBeTruthy() // Total is 2 steps, not 3!

    act(() => {
      fireEvent.click(screen.getByTestId('next'))
    })

    expect(screen.getByText('Visible Step 2')).toBeTruthy()
    expect(screen.getByText('2 / 2')).toBeTruthy()
  })
})

describe('TourProvider — navegação pelos botões do overlay (Anterior/Próximo/Concluir)', () => {
  it('botão Anterior volta um passo e Concluir finaliza o tour (currentStep volta a -1)', () => {
    render(
      <TourProvider>
        <TourConsumer steps={STEPS} tourId="nav-tour" />
      </TourProvider>,
    )

    act(() => {
      fireEvent.click(screen.getByTestId('start'))
    })
    expect(screen.getByText('1 / 2')).toBeTruthy()

    act(() => {
      fireEvent.click(screen.getByRole('button', { name: 'Próximo' }))
    })
    expect(screen.getByText('2 / 2')).toBeTruthy()
    expect(screen.queryByRole('button', { name: 'Próximo' })).toBeNull()

    act(() => {
      fireEvent.click(screen.getByRole('button', { name: 'Anterior' }))
    })
    expect(screen.getByText('1 / 2')).toBeTruthy()
    expect(screen.queryByRole('button', { name: 'Anterior' })).toBeNull()

    act(() => {
      fireEvent.click(screen.getByRole('button', { name: 'Próximo' }))
    })
    act(() => {
      fireEvent.click(screen.getByRole('button', { name: 'Concluir' }))
    })
    expect(screen.getByTestId('active').textContent).toBe('false')
    expect(screen.getByTestId('step').textContent).toBe('-1')
  })
})

describe('useTour — uso fora do TourProvider', () => {
  it('lança erro explicativo quando chamado fora do TourProvider', () => {
    function Consumer() {
      useTour()
      return null
    }
    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    expect(() => render(<Consumer />)).toThrow('useTour must be used within a TourProvider')
    consoleErrorSpy.mockRestore()
  })
})

describe('ignoreTourInteraction', () => {
  it('previne o evento quando o alvo está dentro de um elemento marcado com data-tour-ui', () => {
    const container = document.createElement('div')
    container.setAttribute('data-tour-ui', '')
    const button = document.createElement('button')
    container.appendChild(button)
    document.body.appendChild(container)

    const event = new Event('pointerdown', { cancelable: true })
    Object.defineProperty(event, 'target', { value: button })
    const preventDefault = vi.spyOn(event, 'preventDefault')

    ignoreTourInteraction(event)

    expect(preventDefault).toHaveBeenCalledTimes(1)
    document.body.removeChild(container)
  })

  it('não previne o evento quando o alvo está fora da UI do tour', () => {
    const button = document.createElement('button')
    document.body.appendChild(button)

    const event = new Event('pointerdown', { cancelable: true })
    Object.defineProperty(event, 'target', { value: button })
    const preventDefault = vi.spyOn(event, 'preventDefault')

    ignoreTourInteraction(event)

    expect(preventDefault).not.toHaveBeenCalled()
    document.body.removeChild(button)
  })

  it('não lança quando o alvo do evento não é um Element', () => {
    const event = new Event('pointerdown', { cancelable: true })
    Object.defineProperty(event, 'target', { value: null })
    expect(() => ignoreTourInteraction(event)).not.toThrow()
  })
})

describe('HelpButton — startDirect', () => {
  it('startDirect=true inicia o tour direto no clique, sem diálogo de confirmação', () => {
    render(
      <TourProvider>
        <TourConsumer steps={STEPS} tourId="direct-tour" />
        <HelpButton tourId="direct-tour" startDirect />
      </TourProvider>,
    )

    act(() => {
      fireEvent.click(screen.getByRole('button', { name: 'Abrir tour de ajuda' }))
    })

    expect(screen.queryByRole('alertdialog')).toBeNull()
    expect(screen.getByTestId('active').textContent).toBe('true')
  })
})

describe('TourAlertDialog', () => {
  it('"Pular Tour" fecha o diálogo sem iniciar o tour', () => {
    render(
      <TourProvider>
        <TourConsumer steps={STEPS} tourId="skip-tour" />
        <HelpButton tourId="skip-tour" />
      </TourProvider>,
    )

    act(() => {
      fireEvent.click(screen.getByRole('button', { name: 'Abrir tour de ajuda' }))
    })
    expect(screen.getByRole('alertdialog')).toBeTruthy()

    act(() => {
      fireEvent.click(screen.getByRole('button', { name: 'Pular Tour' }))
    })

    expect(screen.queryByRole('alertdialog')).toBeNull()
    expect(screen.getByTestId('active').textContent).toBe('false')
  })

  it('"Iniciar Tour" fecha o diálogo e inicia o tour', () => {
    render(
      <TourProvider>
        <TourConsumer steps={STEPS} tourId="start-from-dialog-tour" />
        <HelpButton tourId="start-from-dialog-tour" />
      </TourProvider>,
    )

    act(() => {
      fireEvent.click(screen.getByRole('button', { name: 'Abrir tour de ajuda' }))
    })

    act(() => {
      fireEvent.click(screen.getByRole('button', { name: 'Iniciar Tour' }))
    })

    expect(screen.queryByRole('alertdialog')).toBeNull()
    expect(screen.getByTestId('active').textContent).toBe('true')
  })

  it('oculta-se (retorna null) quando o tour já está ativo, mesmo com isOpen=true', () => {
    render(
      <TourProvider>
        <TourConsumer steps={STEPS} tourId="dialog-active-tour" />
        <TourAlertDialog tourId="dialog-active-tour" isOpen={true} setIsOpen={() => {}} />
      </TourProvider>,
    )

    // currentStep ainda é -1: o diálogo aparece normalmente.
    expect(screen.getByRole('alertdialog')).toBeTruthy()

    act(() => {
      fireEvent.click(screen.getByTestId('start'))
    })

    // Após iniciar, currentStep >= 0: o diálogo se oculta mesmo com isOpen=true.
    expect(screen.queryByRole('alertdialog')).toBeNull()
  })
})

describe('TourProvider — elemento alvo com layout real (hasTarget=true)', () => {
  afterEach(() => {
    restoreElementRect()
  })

  it('com rect visível, posiciona o backdrop/card no elemento e chama scrollIntoView', () => {
    mockElementRect('step-1', { top: 100, left: 100, width: 200, height: 50 })

    const steps: TourStep[] = [
      { content: 'Positioned step', selectorId: 'step-1', position: 'bottom' },
    ]

    render(
      <TourProvider>
        <TourConsumer steps={steps} tourId="positioned-tour" />
      </TourProvider>,
    )

    act(() => {
      fireEvent.click(screen.getByTestId('start'))
    })
    act(() => {
      window.dispatchEvent(new Event('resize'))
    })

    expect(screen.getByText('Positioned step')).toBeTruthy()
    expect(window.HTMLElement.prototype.scrollIntoView).toHaveBeenCalled()
  })

  it('respeita width/height explícitos do passo para a área recortada do backdrop', () => {
    mockElementRect('step-1', { top: 50, left: 50, width: 10, height: 10 })

    const steps: TourStep[] = [
      { content: 'Sized step', selectorId: 'step-1', width: 300, height: 120 },
    ]

    render(
      <TourProvider>
        <TourConsumer steps={steps} tourId="sized-tour" />
      </TourProvider>,
    )

    act(() => {
      fireEvent.click(screen.getByTestId('start'))
    })
    act(() => {
      window.dispatchEvent(new Event('resize'))
    })

    const clipped = document.querySelector('[style*="clip-path"]') as HTMLElement | null
    expect(clipped).not.toBeNull()
    // left(50) + width(300) = 350; top(50) + height(120) = 170
    expect(clipped?.getAttribute('style')).toContain('350px')
    expect(clipped?.getAttribute('style')).toContain('170px')
  });

  it('getElementPosition: elemento com display:none é tratado como não visível mesmo com rect não-zero', () => {
    mockElementRect('hidden-el', { top: 10, left: 10, width: 50, height: 50 })

    function HiddenTargetConsumer({ steps, tourId }: { steps: TourStep[]; tourId: string }) {
      const { registerTour, startTour, isActive } = useTour()
      useEffect(() => { registerTour(tourId, steps) }, [registerTour, tourId, steps])
      return (
        <div>
          <button data-testid="start" onClick={() => startTour(tourId)}>start</button>
          <span data-testid="active">{String(isActive)}</span>
          <div id="hidden-el" style={{ display: 'none' }}>Hidden target</div>
        </div>
      )
    }

    const steps: TourStep[] = [{ content: 'Step over hidden element', selectorId: 'hidden-el' }]

    render(
      <TourProvider>
        <HiddenTargetConsumer steps={steps} tourId="hidden-el-tour" />
      </TourProvider>,
    )

    act(() => {
      fireEvent.click(screen.getByTestId('start'))
    })
    act(() => {
      window.dispatchEvent(new Event('resize'))
    })

    // Sem alvo visível, o card centralizado é usado (sem clip-path recortado no backdrop).
    expect(screen.getByText('Step over hidden element')).toBeTruthy()
    expect(document.querySelector('[style*="clip-path"]')).toBeNull()
  })

  it('percorre posições top/left/right sem lançar e renderizando cada passo', () => {
    mockElementRect('step-1', { top: 300, left: 300, width: 100, height: 40 })

    const steps: TourStep[] = [
      { content: 'Top position', selectorId: 'step-1', position: 'top' },
      { content: 'Left position', selectorId: 'step-1', position: 'left' },
      { content: 'Right position', selectorId: 'step-1', position: 'right' },
    ]

    render(
      <TourProvider>
        <TourConsumer steps={steps} tourId="position-tour" />
      </TourProvider>,
    )

    act(() => {
      fireEvent.click(screen.getByTestId('start'))
      window.dispatchEvent(new Event('resize'))
    })
    expect(screen.getByText('Top position')).toBeTruthy()

    act(() => {
      fireEvent.click(screen.getByTestId('next'))
      window.dispatchEvent(new Event('resize'))
    })
    expect(screen.getByText('Left position')).toBeTruthy()

    act(() => {
      fireEvent.click(screen.getByTestId('next'))
      window.dispatchEvent(new Event('resize'))
    })
    expect(screen.getByText('Right position')).toBeTruthy()
  })
})

describe('TourProvider — clique dentro da área do passo (onClickWithinArea)', () => {
  afterEach(() => {
    restoreElementRect()
  })

  it('chama onClickWithinArea quando o clique ocorre dentro dos limites do elemento alvo', () => {
    mockElementRect('step-1', { top: 100, left: 100, width: 200, height: 50 })
    const onClickWithinArea = vi.fn()
    const steps: TourStep[] = [{ content: 'Clickable step', selectorId: 'step-1', onClickWithinArea }]

    render(
      <TourProvider>
        <TourConsumer steps={steps} tourId="click-in-tour" />
      </TourProvider>,
    )

    act(() => {
      fireEvent.click(screen.getByTestId('start'))
    })
    act(() => {
      window.dispatchEvent(new Event('resize'))
    })

    act(() => {
      window.dispatchEvent(new MouseEvent('click', { bubbles: true, clientX: 150, clientY: 120 }))
    })

    expect(onClickWithinArea).toHaveBeenCalledTimes(1)
  })

  it('não chama onClickWithinArea quando o clique ocorre fora dos limites do elemento alvo', () => {
    mockElementRect('step-1', { top: 100, left: 100, width: 200, height: 50 })
    const onClickWithinArea = vi.fn()
    const steps: TourStep[] = [{ content: 'Clickable step', selectorId: 'step-1', onClickWithinArea }]

    render(
      <TourProvider>
        <TourConsumer steps={steps} tourId="click-out-tour" />
      </TourProvider>,
    )

    act(() => {
      fireEvent.click(screen.getByTestId('start'))
    })
    act(() => {
      window.dispatchEvent(new Event('resize'))
    })

    act(() => {
      window.dispatchEvent(new MouseEvent('click', { bubbles: true, clientX: 900, clientY: 900 }))
    })

    expect(onClickWithinArea).not.toHaveBeenCalled()
  })

  it('não lança ao clicar quando o passo atual não define onClickWithinArea', () => {
    mockElementRect('step-1', { top: 100, left: 100, width: 200, height: 50 })

    render(
      <TourProvider>
        <TourConsumer steps={STEPS} tourId="click-noop-tour" />
      </TourProvider>,
    )

    act(() => {
      fireEvent.click(screen.getByTestId('start'))
      window.dispatchEvent(new Event('resize'))
    })

    expect(() => {
      act(() => {
        window.dispatchEvent(new MouseEvent('click', { bubbles: true, clientX: 150, clientY: 120 }))
      })
    }).not.toThrow()
  })

  it('clique antes de iniciar o tour (currentStep=-1) não lança nem chama callback', () => {
    mockElementRect('step-1', { top: 100, left: 100, width: 200, height: 50 })
    const onClickWithinArea = vi.fn()
    const steps: TourStep[] = [{ content: 'Clickable step', selectorId: 'step-1', onClickWithinArea }]

    render(
      <TourProvider>
        <TourConsumer steps={steps} tourId="click-before-start-tour" />
      </TourProvider>,
    )

    expect(() => {
      act(() => {
        window.dispatchEvent(new MouseEvent('click', { bubbles: true, clientX: 150, clientY: 120 }))
      })
    }).not.toThrow()
    expect(onClickWithinArea).not.toHaveBeenCalled()
  })
})
