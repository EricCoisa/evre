import type { ContractSchema } from './contract-schema';

export const exampleContract1: ContractSchema = {
  version: '1.0',
  components: [
    {
      object: 'Title',
      value: 'CONTRATO DE PRESTAÇÃO DE SERVIÇOS',
      level: 1,
    },
    {
      object: 'Container',
      value: [
        {
          object: 'Title',
          value: 'Partes Contratantes',
          level: 3,
        },
        {
          object: 'Party',
          value: {
            role: 'contractor',
            name: 'ACME Tecnologia Ltda',
            document: 'CNPJ 12.345.678/0001-90',
            address: 'Rua das Flores, 123, São Paulo - SP',
          },
        },
        {
          object: 'Party',
          value: {
            role: 'contracted',
            name: 'João da Silva',
            document: 'CPF 123.456.789-00',
            address: 'Av. Paulista, 1000, São Paulo - SP',
          },
        },
      ],
    },
    {
      object: 'Container',
      value: [
        {
          object: 'Title',
          value: 'Objeto do Contrato',
          level: 3,
        },
        {
          object: 'Text',
          value:
            'O presente contrato tem por objeto a prestação de serviços de consultoria em tecnologia da informação, conforme especificações técnicas anexas.',
        },
      ],
    },
    {
      object: 'Clause',
      value: {
        number: 1,
        title: 'Do Escopo dos Serviços',
        content:
          'Os serviços prestados compreendem análise de sistemas, desenvolvimento de software, manutenção corretiva e evolutiva.',
        subclauses: [
          'Desenvolvimento de aplicações web responsivas',
          'Integração com sistemas legados',
          'Treinamento de usuários finais',
          'Suporte técnico durante 90 dias após entrega',
        ],
      },
    },
    {
      object: 'Clause',
      value: {
        number: 2,
        title: 'Do Prazo de Vigência',
        content:
          'O presente contrato terá vigência de 12 (doze) meses, podendo ser prorrogado mediante acordo entre as partes.',
      },
    },
    {
      object: 'Clause',
      value: {
        number: 3,
        title: 'Do Valor e Forma de Pagamento',
        content:
          'O valor total dos serviços é de R$ 50.000,00 (cinquenta mil reais), a ser pago em 5 (cinco) parcelas mensais de R$ 10.000,00.',
        subclauses: [
          'Pagamento até o 5º dia útil de cada mês',
          'Mediante apresentação de nota fiscal',
          'Via transferência bancária ou boleto',
        ],
      },
    },
    {
      object: 'Container',
      value: [
        {
          object: 'Title',
          value: 'Termos e Condições',
          level: 3,
        },
        {
          object: 'Term',
          value: [
            'As partes se comprometem a manter sigilo sobre informações confidenciais',
            'O contratado não poderá transferir o contrato sem anuência da contratante',
            'Eventuais alterações devem ser formalizadas por meio de aditivo',
            'O foro da comarca de São Paulo é eleito para dirimir controvérsias',
          ],
        },
      ],
    },
    {
      object: 'Container',
      value: [
        {
          object: 'Title',
          value: 'Data e Assinaturas',
          level: 3,
        },
        {
          object: 'Date',
          value: '2024-01-15',
          label: 'Data de Assinatura',
        },
        {
          object: 'Text',
          value: 'As partes assinam o presente contrato em duas vias de igual teor e forma.',
        },
        {
          object: 'Party',
          value: {
            role: 'witness',
            name: 'Maria Santos',
            document: 'CPF 987.654.321-00',
          },
        },
      ],
    },
  ],
};

export const exampleContract2: ContractSchema = {
  version: '1.0',
  components: [
    {
      object: 'Title',
      value: 'CONTRATO DE COMPRA E VENDA',
      level: 1,
    },
    {
      object: 'Text',
      value:
        'Pelo presente instrumento particular, as partes abaixo qualificadas celebram o seguinte contrato:',
    },
    {
      object: 'Party',
      value: {
        role: 'contractor',
        name: 'Vendedor SA',
        document: 'CNPJ 98.765.432/0001-10',
        address: 'Rua do Comércio, 456, Rio de Janeiro - RJ',
      },
    },
    {
      object: 'Party',
      value: {
        role: 'contracted',
        name: 'Comprador Ltda',
        document: 'CNPJ 11.222.333/0001-44',
        address: 'Av. Brasil, 2000, Rio de Janeiro - RJ',
      },
    },
    {
      object: 'Clause',
      value: {
        number: 1,
        title: 'Do Objeto',
        content:
          'O vendedor vende ao comprador os seguintes bens: 100 unidades do produto X, conforme especificação técnica anexa.',
      },
    },
    {
      object: 'Clause',
      value: {
        number: 2,
        title: 'Do Preço',
        content: 'O valor total da venda é de R$ 100.000,00, a ser pago em parcela única.',
      },
    },
    {
      object: 'Clause',
      value: {
        number: 3,
        title: 'Da Entrega',
        content: 'A entrega será realizada no endereço do comprador em até 30 dias.',
      },
    },
    {
      object: 'Date',
      value: '2024-02-20',
      label: 'Assinado em',
    },
  ],
};
