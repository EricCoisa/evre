export type CompanyStatus = 'DRAFT' | 'INVITED' | 'ACTIVE';

export interface Company {
  id: string;
  name: string;
  status: CompanyStatus;
  createdAt: string;
  updatedAt: string;
}

export interface CreateCompanyDto {
  name: string;
}

export interface UpdateCompanyDto {
  name?: string;
}
