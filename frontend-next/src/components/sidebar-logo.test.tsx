import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { SidebarProvider } from './ui/sidebar';
import { SidebarLogo } from './sidebar-logo';
import { siteInitials } from '@/lib/site';

describe('SidebarLogo', () => {
  it('centraliza e reduz o ícone no collapsed com padding simétrico', () => {
    render(
      <SidebarProvider>
        <SidebarLogo />
      </SidebarProvider>
    );

    const iconBox = screen.getByText(siteInitials()).closest('div')!;
    expect(iconBox.className).toContain('justify-center');
    expect(iconBox.className).not.toMatch(/collapsible=icon\]:justify-start/);
    expect(iconBox.className).not.toMatch(/collapsible=icon\]:pl-/);
    expect(iconBox.className).toContain('shrink-0');
    expect(iconBox.className).toContain('size-10');
    expect(iconBox.className).toContain('group-data-[collapsible=icon]:size-8');
    expect(iconBox.className).toContain('group-data-[collapsible=icon]:rounded-lg');
  });

  it('remove o padding forçado do botão no collapsed para preservar o tamanho do ícone', () => {
    render(
      <SidebarProvider>
        <SidebarLogo />
      </SidebarProvider>
    );

    const logoLink = screen.getByRole('link');
    expect(logoLink.className).toContain('group-data-[collapsible=icon]:!p-0');
    expect(logoLink.className).toContain('group-data-[collapsible=icon]:!w-full');
  });

  it('esconde o bloco de nome/versão no collapsed (único filho do flex, evita empurrar o ícone)', () => {
    render(
      <SidebarProvider>
        <SidebarLogo />
      </SidebarProvider>
    );

    const versionText = screen.getByText(/^v/);
    const textBlock = versionText.closest('div')!;
    expect(textBlock.className).toMatch(/collapsible=icon\]:hidden/);
  });
});
