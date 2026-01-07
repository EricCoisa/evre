export const CompanyStatusConst = {
  DRAFT: 'DRAFT',
  INVITED: 'INVITED',
  ACTIVE: 'ACTIVE',
} as const;

export type CompanyStatus = keyof typeof CompanyStatusConst;
