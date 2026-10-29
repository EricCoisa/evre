import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { PublicProposalHeader } from './public-proposal-header';

describe('PublicProposalHeader — nome e descritor vêm de prop, nunca de literal', () => {
  it('renderiza o nome e o descritor recebidos por prop', () => {
    render(<PublicProposalHeader name="Qualquer Empresa" tagline="Qualquer Descritor" />);

    expect(screen.getByText('Qualquer Empresa')).toBeInTheDocument();
    expect(screen.getByText('Qualquer Descritor')).toBeInTheDocument();
    expect(screen.queryByText('EVRE')).not.toBeInTheDocument();
  });

  it('omite o descritor quando a tagline vem vazia', () => {
    render(<PublicProposalHeader name="Qualquer Empresa" tagline="" />);

    expect(screen.getByText('Qualquer Empresa')).toBeInTheDocument();
    expect(screen.queryByText('Qualquer Descritor')).not.toBeInTheDocument();
  });
});
