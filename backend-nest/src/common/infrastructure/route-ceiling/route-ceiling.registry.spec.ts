import { RouteCeilingRegistry } from './route-ceiling.registry';

describe('RouteCeilingRegistry', () => {
  it('path não registrado devolve [] (sem restrição)', () => {
    const registry = new RouteCeilingRegistry();
    expect(registry.allowedRolesFor('/unknown')).toEqual([]);
  });

  it('devolve o teto registrado para o path', () => {
    const registry = new RouteCeilingRegistry();
    registry.register('/logging', ['ADMIN', 'MODERATOR']);
    expect(registry.allowedRolesFor('/logging')).toEqual(['ADMIN', 'MODERATOR']);
  });

  it('register() do mesmo path duas vezes lança', () => {
    const registry = new RouteCeilingRegistry();
    registry.register('/user', ['ADMIN']);
    expect(() => registry.register('/user', ['ADMIN'])).toThrow(
      'Teto de rota duplicado: /user',
    );
  });

  it('a função devolvida por register() desfaz o registro', () => {
    const registry = new RouteCeilingRegistry();
    const unregister = registry.register('/settings', ['ADMIN']);
    unregister();
    expect(registry.allowedRolesFor('/settings')).toEqual([]);
  });
});
