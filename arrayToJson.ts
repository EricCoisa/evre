/**
 * Converte um array em string JSON
 * @param array - Array a ser convertido
 * @param pretty - Se true, formata o JSON com indentação (padrão: false)
 * @returns String JSON
 */
export function arrayToJson<T>(array: T[], pretty = false): string {
  return JSON.stringify(array, null, pretty ? 2 : 0);
}

/**
 * Converte um array em string JSON e exibe no console
 * @param array - Array a ser convertido
 * @param pretty - Se true, formata o JSON com indentação (padrão: true)
 */
export function arrayToJsonLog<T>(array: T[], pretty = true): void {
  console.log(arrayToJson(array, pretty));
}

// Exemplo de uso
function main() {
 const steps: any[] = [
  {
    content: 'Aqui é a Home',
    selectorId: "tour-nav-0",
    position: "right"
  },
  {
    content: 'Aqui é a DashBoard',
    selectorId: "tour-nav-1",
    position: "right",
  },
  {
    content: 'Aqui são os Acessos',
    selectorId: "tour-nav-3",
    position: "right"
  }
];

  // Formato compacto
  const compact = arrayToJson(steps);
  console.log('Compact:', compact);

  // Formato formatado
  const formatted = arrayToJson(steps, true);
  console.log('Formatted:', formatted);

  // Usando o helper de log
  arrayToJsonLog(steps);
}

main();
