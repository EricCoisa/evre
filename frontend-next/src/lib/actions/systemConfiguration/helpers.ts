/**
 * Verifica se um valor de configuração do sistema está preenchido e não é um placeholder padrão de seed.
 */
export function isConfigValuePresent(val: unknown): boolean {
  if (val === null || val === undefined) return false;
  const str = String(val).trim();
  if (!str) return false;

  // Placeholders padrões inseridos por seeds que não representam configurações válidas/reais
  const seedPlaceholders = [
    'sk-placeholder',
    'sk-ant-placeholder',
    'aaaaaaaa-bbbb-cccc-dddd-aaaaaaaaaaaa',
    'smtp.example.com',
    'user@example.com',
    'pass123',
    'minioadmin',
    'http://localhost:8333',
    'http://localhost:8333/template',
    'http://localhost:3000',
    '000-000-000',
  ];

  return !seedPlaceholders.includes(str);
}
