/** Máscara para SystemLog/telemetria — não usar para resposta de API. */
export function maskIfSecret<T>(secret: boolean, value: T): T | '***' {
  return secret ? '***' : value;
}
