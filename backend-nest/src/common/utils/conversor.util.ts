import { BadRequestException } from '@nestjs/common';
import { I18nService } from 'nestjs-i18n';

export function validateValueType(
  value: string,
  type: string,
  i18n: I18nService<Record<string, unknown>>,
  options?: string[],
) {
  switch (type.toUpperCase()) {
    // ENUM só é validável quando a definição declara `options` — sem elas, qualquer
    // string passa, que era o comportamento de todos os tipos antes deste caso existir.
    case 'ENUM':
      if (options?.length && !options.includes(value)) {
        throw new BadRequestException(
          i18n.t('user_configuration.value_must_be_one_of', {
            args: { options: options.join(', ') },
          }),
        );
      }
      break;
    case 'NUMBER':
      if (isNaN(Number(value))) {
        throw new BadRequestException(
          i18n.t('user_configuration.value_must_be_number'),
        );
      }
      break;
    case 'BOOLEAN':
      if (value !== 'true' && value !== 'false') {
        throw new BadRequestException(
          i18n.t('user_configuration.value_must_be_boolean'),
        );
      }
      break;
    case 'JSON':
      try {
        JSON.parse(value);
      } catch {
        throw new BadRequestException(
          i18n.t('user_configuration.value_must_be_json'),
        );
      }
      break;
  }
}

export function convertValueByType(
  value: unknown,
  valueType: string,
): string | number | boolean | object | null {
  if (value == null) return value as null;
  switch (valueType.toUpperCase()) {
    case 'NUMBER':
      return Number(value);
    case 'BOOLEAN':
      return value === 'true' || value === true;
    case 'JSON':
      try {
        return typeof value === 'string'
          ? (JSON.parse(value) as object)
          : value;
      } catch {
        return value;
      }
    default:
      return value;
  }
}
