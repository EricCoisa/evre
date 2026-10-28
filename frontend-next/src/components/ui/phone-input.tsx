'use client';

import * as React from 'react';
import {
  AsYouType,
  getCountries,
  getCountryCallingCode,
  isValidPhoneNumber,
  parsePhoneNumberFromString,
  type CountryCode,
} from 'libphonenumber-js';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { cn } from '@/lib/cn';

/** Bandeira a partir do ISO 3166-1 alfa-2: cada letra vira seu Regional Indicator Symbol. */
function flagOf(country: string): string {
  return String.fromCodePoint(
    ...country.toUpperCase().split('').map((c) => 0x1f1a5 + c.charCodeAt(0)),
  );
}

const COUNTRIES = getCountries();

/** Dígitos nacionais de um E.164, sem depender de o número estar completo. */
function splitE164(value: string, fallback: CountryCode): { country: CountryCode; national: string } {
  const parsed = value ? parsePhoneNumberFromString(value) : undefined;
  if (parsed?.country) {
    return { country: parsed.country, national: parsed.nationalNumber };
  }
  // Número ainda incompleto: o parse falha, mas o DDI já é conhecido pelo país corrente.
  const ddi = getCountryCallingCode(fallback);
  const digits = value.replace(/\D/g, '');
  return {
    country: fallback,
    national: digits.startsWith(ddi) ? digits.slice(ddi.length) : digits,
  };
}

export interface PhoneInputProps {
  /** E.164 (`+5511999999999`) — é o que entra e o que sai. */
  value?: string;
  onChange?: (value: string) => void;
  defaultCountry?: CountryCode;
  disabled?: boolean;
  placeholder?: string;
  className?: string;
  id?: string;
}

/** Seletor de país com bandeira + número formatado enquanto digita. Emite sempre E.164. */
export function PhoneInput({
  value = '',
  onChange,
  defaultCountry = 'BR',
  disabled,
  placeholder,
  className,
  id,
}: PhoneInputProps) {
  const initial = splitE164(value, defaultCountry);
  const [country, setCountry] = React.useState<CountryCode>(initial.country);
  // Os dígitos digitados vivem aqui: derivar de `value` esconderia o número enquanto
  // ele está incompleto, porque `parsePhoneNumberFromString` só resolve número válido.
  const [national, setNational] = React.useState(initial.national);
  const [prevProp, setPrevProp] = React.useState(value);

  // Compara prop com prop ANTERIOR, não com o que emitimos: um pai que demore a devolver
  // o valor (ou nem devolva) não pode apagar o que a pessoa acabou de digitar.
  if (value !== prevProp) {
    setPrevProp(value);
    const next = splitE164(value, country);
    setNational(next.national);
    if (next.country !== country) setCountry(next.country);
  }

  const emit = (nextCountry: CountryCode, digits: string) => {
    onChange?.(digits ? `+${getCountryCallingCode(nextCountry)}${digits}` : '');
  };

  return (
    <div className={cn('flex gap-2', className)}>
      <Select
        value={country}
        disabled={disabled}
        onValueChange={(next) => {
          setCountry(next as CountryCode);
          emit(next as CountryCode, national);
        }}
      >
        <SelectTrigger className="w-28 shrink-0" aria-label="country">
          <SelectValue>
            {flagOf(country)} +{getCountryCallingCode(country)}
          </SelectValue>
        </SelectTrigger>
        <SelectContent className="max-h-72">
          {COUNTRIES.map((c) => (
            <SelectItem key={c} value={c}>
              {flagOf(c)} {c} +{getCountryCallingCode(c)}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Input
        id={id}
        type="tel"
        inputMode="tel"
        disabled={disabled}
        placeholder={placeholder}
        value={national ? new AsYouType(country).input(national) : ''}
        onChange={(e) => {
          const digits = e.target.value.replace(/\D/g, '');
          setNational(digits);
          emit(country, digits);
        }}
      />
    </div>
  );
}

/** Validação por país — use em schemas Zod via `.refine`. */
export function isValidPhone(value: string): boolean {
  return Boolean(value) && isValidPhoneNumber(value);
}
