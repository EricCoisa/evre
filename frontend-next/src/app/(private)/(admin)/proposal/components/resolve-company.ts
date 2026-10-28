import type { Company } from "@/lib/actions/company/types";

/** Resolve o texto digitado para o id de uma empresa existente (match exato, sem caixa) ou cria
 * uma nova via `createCompany`. `undefined` quando o texto é vazio OU a criação falha — nada é
 * porta: a proposta segue sem empresa (`companyId` é opcional). */
export async function resolveOrCreateCompanyId(
  name: string,
  companies: Company[],
  createCompany: (name: string) => Promise<{ success: boolean; data: Company | null }>,
): Promise<string | undefined> {
  const trimmed = name.trim();
  if (!trimmed) return undefined;

  const match = companies.find((c) => c.name.trim().toLowerCase() === trimmed.toLowerCase());
  if (match) return match.id;

  const result = await createCompany(trimmed);
  return result.success && result.data ? result.data.id : undefined;
}
