export interface Contact {
  id: string;
  name: string;
  email: string;
  telefone: string;
  text: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateContactDto {
  name: string;
  email: string;
  telefone: string;
  text: string;
}