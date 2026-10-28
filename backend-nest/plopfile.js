module.exports = function (plop) {
  // Helper para converter para snake_case
  plop.setHelper('snakeCase', (text) => {
    return text
      .replace(/([A-Z])/g, '_$1')
      .toLowerCase()
      .replace(/^_/, '');
  });

  // Helper para converter para CONSTANT_CASE
  plop.setHelper('constantCase', (text) => {
    return text
      .replace(/([A-Z])/g, '_$1')
      .toUpperCase()
      .replace(/^_/, '');
  });

  plop.setGenerator('module', {
    description: 'Criar um novo módulo NestJS completo (CRUD)',
    prompts: [
      {
        type: 'input',
        name: 'name',
        message: 'Nome do módulo (ex: Product, Category, Order):',
        validate: (value) => {
          if (!value) return 'Nome é obrigatório';
          if (!/^[A-Z][a-zA-Z0-9]*$/.test(value)) {
            return 'Nome deve começar com letra maiúscula e conter apenas letras e números (PascalCase)';
          }
          return true;
        },
      },
    ],
    actions: (data) => {
      const actions = [];

      // 1. Domain Entity
      actions.push({
        type: 'add',
        path: 'src/domain/{{kebabCase name}}/{{kebabCase name}}.entity.ts',
        templateFile: 'plop-templates/entity.entity.ts.hbs',
        skipIfExists: true,
      });

      // 2. IsActive Status Constant
      actions.push({
        type: 'add',
        path: 'src/domain/{{kebabCase name}}/isActiveStatus.const.ts',
        templateFile: 'plop-templates/isActiveStatus.const.ts.hbs',
        skipIfExists: true,
      });

      // 3. DTOs
      actions.push({
        type: 'add',
        path: 'src/modules/{{kebabCase name}}/dto/create-{{kebabCase name}}.dto.ts',
        templateFile: 'plop-templates/create-dto.ts.hbs',
        skipIfExists: true,
      });

      actions.push({
        type: 'add',
        path: 'src/modules/{{kebabCase name}}/dto/update-{{kebabCase name}}.dto.ts',
        templateFile: 'plop-templates/update-dto.ts.hbs',
        skipIfExists: true,
      });

      actions.push({
        type: 'add',
        path: 'src/modules/{{kebabCase name}}/dto/{{kebabCase name}}.dto.ts',
        templateFile: 'plop-templates/response-dto.ts.hbs',
        skipIfExists: true,
      });

      // 4. Use-cases: um execute() por operação
      for (const uc of ['find-all', 'find-one', 'create', 'update', 'remove']) {
        actions.push({
          type: 'add',
          path: `src/modules/{{kebabCase name}}/use-cases/${uc}.use-case.ts`,
          templateFile: `plop-templates/use-cases/${uc}.use-case.ts.hbs`,
          skipIfExists: true,
        });
      }

      // 5. Controller
      actions.push({
        type: 'add',
        path: 'src/modules/{{kebabCase name}}/{{kebabCase name}}.controller.ts',
        templateFile: 'plop-templates/controller.ts.hbs',
        skipIfExists: true,
      });

      // 6. Module
      actions.push({
        type: 'add',
        path: 'src/modules/{{kebabCase name}}/{{kebabCase name}}.module.ts',
        templateFile: 'plop-templates/module.ts.hbs',
        skipIfExists: true,
      });

      // 6.1. Spec dos use-cases (Unit Test)
      actions.push({
        type: 'add',
        path: 'src/modules/{{kebabCase name}}/use-cases/{{kebabCase name}}.use-cases.spec.ts',
        templateFile: 'plop-templates/use-cases/use-cases.spec.ts.hbs',
        skipIfExists: true,
      });

      // 6.2. RouteCeiling — o controller gerado usa roles: ['ADMIN'] fixo em toda rota; sem o teto,
      // um ADMIN poderia conceder a Route a MODERATOR/USER via RoleRouteAccess e a tela ficaria
      // visível sem acesso ao dado (ver docs/architecture/auth-rbac.md#RouteCeilingRegistry).
      actions.push({
        type: 'add',
        path: 'src/modules/{{kebabCase name}}/{{kebabCase name}}.route-ceiling.ts',
        templateFile: 'plop-templates/route-ceiling.ts.hbs',
        skipIfExists: true,
      });

      // 7. i18n - English
      actions.push({
        type: 'add',
        path: 'src/i18n/en/{{snakeCase name}}.json',
        templateFile: 'plop-templates/i18n-en.json.hbs',
        skipIfExists: true,
      });

      // 8. i18n - Portuguese
      actions.push({
        type: 'add',
        path: 'src/i18n/pt-BR/{{snakeCase name}}.json',
        templateFile: 'plop-templates/i18n-pt-BR.json.hbs',
        skipIfExists: true,
      });

      // 9. Adicionar ao LogModuleConst
      actions.push({
        type: 'modify',
        path: 'src/domain/logging/logModule.const.ts',
        pattern: /(\s*)(};)/,
        template: `\n  {{constantCase name}}: '{{constantCase name}}', // Adicionado pelo Plop\n$2`,
      });

      // 10. Adicionar modelo Prisma em prisma/schema/{{kebabCase name}}.prisma
      actions.push({
        type: 'add',
        path: 'prisma/schema/{{kebabCase name}}.prisma',
        template: `model {{pascalCase name}} {
  id          String   @id @default(uuid())
  name        String
  description String?
  isActive    Boolean  @default(true)
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt

  @@schema("public")
  @@map("{{snakeCase name}}s")
}`,
        skipIfExists: true,
      });

      // 11. Adicionar entrada ao enum LogModule em prisma/schema/base.prisma
      actions.push({
        type: 'modify',
        path: 'prisma/schema/base.prisma',
        pattern: /(enum LogModule \{[\s\S]*?)(\})/,
        template: `$1  {{constantCase name}}\n$2`,
      });

      // 11.1. Adicionar o path ao RoutePathConst (consumido pelo route-ceiling da ação 6.2).
      // Ancorado no fechamento `} as const;`, não no último nome — mesma razão da ação 13.
      // Newline capturado (\r\n|\n) em vez de literal: autocrlf no checkout vira CRLF, \n cru não bate.
      // Sem \s* solto antes do grupo: ele rouba o \r no backtracking e deixa o \n sozinho pro grupo.
      actions.push({
        type: 'modify',
        path: 'src/domain/route/route-path.const.ts',
        pattern: /(const RoutePathConst = \{[\s\S]*?[^\s,]),?(\r\n|\n)(\s*)\} as const;/,
        template: `$1,$2$3  {{constantCase name}}: '/{{kebabCase name}}',$2$3} as const;`,
      });

      // 12. Adicionar import do módulo no AppModule
      actions.push({
        type: 'modify',
        path: 'src/app.module.ts',
        pattern: /(import[^;]*;\s*)$/m,
        template: `$1\nimport { {{pascalCase name}}Module } from './modules/{{kebabCase name}}/{{kebabCase name}}.module';`,
      });

      // 13. Adicionar módulo ao array de imports do AppModule (antes do fechamento do array,
      // não ancorado num módulo específico — a lista cresce e qualquer nome fixo deixa de ser o último).
      // \r\n|\n: o arquivo está em CRLF neste checkout; \n sozinho não bate e o modify falha calado.
      actions.push({
        type: 'modify',
        path: 'src/app.module.ts',
        pattern: /(\r\n|\n)(\s*)\],\1\2providers: \[/,
        template: `$1$2  {{pascalCase name}}Module,$1$2],$1$2providers: [`,
      });

      // 13.1. Import também no AppOpenApiModule (módulo paralelo, só pra gerar o openapi.json —
      // ver scripts/export-openapi.ts). Sem isso o controller nunca aparece no contrato e o Orval
      // nunca gera client pro módulo novo.
      actions.push({
        type: 'modify',
        path: 'src/app-openapi.module.ts',
        pattern: /(import[^;]*;\s*)$/m,
        template: `$1\nimport { {{pascalCase name}}Module } from './modules/{{kebabCase name}}/{{kebabCase name}}.module';`,
      });

      // 13.2. Registrar no array de imports do AppOpenApiModule (fecha em `],\n})`, sem `providers:`).
      actions.push({
        type: 'modify',
        path: 'src/app-openapi.module.ts',
        pattern: /(\r\n|\n)(\s*)\],\1\}\)/,
        template: `$1$2  {{pascalCase name}}Module,$1$2],$1})`,
      });

      // 14. Mensagem de sucesso com próximos passos
      // `append` exige que o arquivo já exista — `add` cria se faltar, sem tocar num já existente.
      actions.push({
        type: 'add',
        path: 'plop-output.log',
        template: '',
        skipIfExists: true,
      });
      actions.push({
        type: 'append',
        path: 'plop-output.log',
        template: `
✅ Módulo {{pascalCase name}} criado com sucesso!

📁 Arquivos criados:
   - src/domain/{{kebabCase name}}/{{kebabCase name}}.entity.ts
   - src/modules/{{kebabCase name}}/{{kebabCase name}}.controller.ts
   - src/modules/{{kebabCase name}}/{{kebabCase name}}.module.ts
   - src/modules/{{kebabCase name}}/{{kebabCase name}}.route-ceiling.ts
   - src/modules/{{kebabCase name}}/use-cases/{find-all,find-one,create,update,remove}.use-case.ts
   - src/modules/{{kebabCase name}}/use-cases/{{kebabCase name}}.use-cases.spec.ts
   - src/modules/{{kebabCase name}}/dto/create-{{kebabCase name}}.dto.ts
   - src/modules/{{kebabCase name}}/dto/update-{{kebabCase name}}.dto.ts
   - src/modules/{{kebabCase name}}/dto/{{kebabCase name}}.dto.ts
   - src/i18n/en/{{snakeCase name}}.json
   - src/i18n/pt-BR/{{snakeCase name}}.json
   - prisma/schema/{{kebabCase name}}.prisma

🔧 PRÓXIMOS PASSOS OBRIGATÓRIOS:

1. Executar migration e generate:
   npx prisma migrate dev --name create_{{snakeCase name}}
   npx prisma generate

2. Adicionar {{pascalCase name}}Module ao AppModule foi feito automaticamente.
   Verificar que o import foi inserido corretamente.

3. Customizar os arquivos gerados conforme necessário:
   - Ajustar campos na Entity e no modelo Prisma
   - Adicionar validações específicas nos DTOs
   - Implementar regras de negócio nos use-cases
   - Preencher o spec gerado em use-cases/
   - Adicionar endpoints customizados no Controller

4. Adicionar use-cases individuais se necessário:
   npm run plop use-case

   Service só quando OUTRO módulo consome a lógica, e aí delega ao use-case.
   Ver docs/backend/use-cases.md.

🚀 Após completar esses passos, seu módulo estará pronto para uso!
`,
      });

      return actions;
    },
  });

  plop.setGenerator('use-case', {
    description: 'Criar um use case standalone em src/modules/<modulo>/use-cases/',
    prompts: [
      {
        type: 'input',
        name: 'name',
        message: 'Nome do use case (ex: create-user, list-orders):',
        validate: (value) => value ? true : 'Nome é obrigatório',
      },
      {
        type: 'input',
        name: 'module',
        message: 'Módulo alvo (ex: user, order):',
        validate: (value) => value ? true : 'Módulo é obrigatório',
      },
    ],
    actions: [
      {
        type: 'add',
        path: 'src/modules/{{kebabCase module}}/use-cases/{{kebabCase name}}.use-case.ts',
        templateFile: 'plop-templates/use-case.ts.hbs',
        skipIfExists: true,
      },
      {
        type: 'add',
        path: 'src/modules/{{kebabCase module}}/use-cases/{{kebabCase name}}.use-case.spec.ts',
        templateFile: 'plop-templates/use-case.spec.ts.hbs',
        skipIfExists: true,
      },
    ],
  });
};
