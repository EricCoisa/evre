import { BadRequestException } from '@nestjs/common';
import { I18nService } from 'nestjs-i18n';

export function validateValueType(
  value: string,
  type: string,
  i18n: I18nService<Record<string, unknown>>,
) {
  switch (type) {
    case 'number':
      if (isNaN(Number(value))) {
        throw new BadRequestException(
          i18n.t('user_configuration.value_must_be_number'),
        );
      }
      break;
    case 'boolean':
      if (value !== 'true' && value !== 'false') {
        throw new BadRequestException(
          i18n.t('user_configuration.value_must_be_boolean'),
        );
      }
      break;
    case 'json':
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
// Utilitário para converter o valor conforme o tipo
export function convertValueByType(
  value: unknown,
  valueType: string,
): string | number | boolean | object | null {
  if (value == null) return value as null;
  switch (valueType) {
    case 'number':
      return Number(value);
    case 'boolean':
      return value === 'true' || value === true;
    case 'json':
      try {
        return typeof value === 'string'
          ? (JSON.parse(value) as object)
          : value;
      } catch {
        return value as object;
      }
    default:
      return value as string;
  }
}
