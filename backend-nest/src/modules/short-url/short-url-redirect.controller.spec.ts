import { HttpStatus } from '@nestjs/common';
import type { Response } from 'express';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ShortUrlRedirectController } from './short-url-redirect.controller';
import { ResolveShortUrlUseCase } from './use-cases/resolve-short-url.use-case';

describe('ShortUrlRedirectController', () => {
  let controller: ShortUrlRedirectController;
  let resolveUseCase: {
    execute: ReturnType<typeof vi.fn>;
  };
  let response: {
    redirect: ReturnType<typeof vi.fn>;
  };

  beforeEach(() => {
    resolveUseCase = {
      execute: vi.fn(),
    };
    response = {
      redirect: vi.fn(),
    };

    controller = new ShortUrlRedirectController(
      resolveUseCase as unknown as ResolveShortUrlUseCase,
    );
  });

  it('deve redirecionar com status 302 para a URL de destino', async () => {
    resolveUseCase.execute.mockResolvedValueOnce(
      'https://meuapp.com/signup?inviteToken=xyz',
    );

    await controller.redirect('abc12345', response as unknown as Response);

    expect(resolveUseCase.execute).toHaveBeenCalledWith('abc12345');
    expect(response.redirect).toHaveBeenCalledWith(
      HttpStatus.FOUND,
      'https://meuapp.com/signup?inviteToken=xyz',
    );
  });
});
