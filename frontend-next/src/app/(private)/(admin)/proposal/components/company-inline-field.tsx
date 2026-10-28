"use client";

import type { ControllerRenderProps } from "react-hook-form";
import { Input } from "@/components/ui/input";
import type { Company } from "@/lib/actions/company/types";

const DATALIST_ID = "proposal-company-options";

/** Combobox de empresa: `<input list>` nativo — sugere empresas existentes e aceita texto novo.
 * Resolver o texto para id (existente ou recém-criado) é responsabilidade de quem submete o
 * formulário (`resolveOrCreateCompanyId`), não deste campo. */
export function CompanyInlineField({
  field,
  companies,
  placeholder,
}: {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  field: ControllerRenderProps<any, any>;
  companies: Company[];
  placeholder?: string;
}) {
  return (
    <>
      <Input
        list={DATALIST_ID}
        value={(field.value as string) ?? ""}
        onChange={(e) => field.onChange(e.target.value)}
        onBlur={field.onBlur}
        placeholder={placeholder}
        autoComplete="off"
      />
      <datalist id={DATALIST_ID}>
        {companies.map((company) => (
          <option key={company.id} value={company.name} />
        ))}
      </datalist>
    </>
  );
}
