/**
 * Destaca visualmente o elemento alvo de um `#hash` (scroll + animação).
 * Para botões: adiciona anel pulsante (`ring-4 ring-primary animate-pulse`).
 * Para linhas/contêineres: adiciona realce de fundo (`bg-primary/10`).
 */
export function flashHashTarget() {
  if (typeof window === 'undefined') return;
  const hash = window.location.hash.slice(1);
  if (!hash) return;

  const tryFlash = (attempt = 0) => {
    const el = document.getElementById(hash);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      if (el.tagName === 'BUTTON' || el.getAttribute('role') === 'button' || el.classList.contains('btn')) {
        el.classList.add('ring-4', 'ring-primary', 'ring-offset-2', 'animate-pulse');
        setTimeout(() => el.classList.remove('ring-4', 'ring-primary', 'ring-offset-2', 'animate-pulse'), 1800);
      } else {
        el.classList.add('bg-primary/10', 'transition-colors', 'duration-1000', 'rounded-md');
        setTimeout(() => el.classList.remove('bg-primary/10'), 1200);
      }
    } else if (attempt < 5) {
      setTimeout(() => tryFlash(attempt + 1), 100);
    }
  };

  requestAnimationFrame(() => tryFlash());
}

