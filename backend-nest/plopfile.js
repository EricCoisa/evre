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

      // 4. Service
      actions.push({
        type: 'add',
        path: 'src/modules/{{kebabCase name}}/{{kebabCase name}}.service.ts',
        templateFile: 'plop-templates/service.ts.hbs',
        skipIfExists: true,
      });

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

      // 9. Adicionar modelo Prisma no schema.prisma
      actions.push({
        type: 'append',
        path: 'prisma/schema.prisma',
        template: `\n\nmodel {{pascalCase name}} {
  id          String   @id @default(uuid())
  name        String
  description String?
  isActive    Boolean  @default(true)
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt
  
  @@map("{{snakeCase name}}s")
}`,
      });

      // 10. Adicionar ao enum LogModule no schema.prisma
      actions.push({
        type: 'modify',
        path: 'prisma/schema.prisma',
        pattern: /(enum LogModule \{[\s\S]*?)(\})/,
        template: `$1  {{constantCase name}}\n$2`,
      });

      // 11. Adicionar import do módulo no AppModule
      actions.push({
        type: 'modify',
        path: 'src/app.module.ts',
        pattern: /(import[^;]*;\s*)$/m,
        template: `$1\nimport { {{pascalCase name}}Module } from './modules/{{kebabCase name}}/{{kebabCase name}}.module';`,
      });

      // 12. Adicionar módulo ao array de imports do AppModule
      actions.push({
        type: 'modify',
        path: 'src/app.module.ts',
        pattern: /(ClientLogModule,)(\s*\n\s*])(,?)/,
        template: `$1\n    {{pascalCase name}}Module,$2$3`,
      });

      // 13. Mensagem de sucesso com próximos passos
      actions.push({
        type: 'append',
        path: 'plop-output.log',
        template: `
✅ Módulo {{pascalCase name}} criado com sucesso!

📁 Arquivos criados:
   - src/domain/{{kebabCase name}}/{{kebabCase name}}.entity.ts
   - src/modules/{{kebabCase name}}/{{kebabCase name}}.controller.ts
   - src/modules/{{kebabCase name}}/{{kebabCase name}}.service.ts
   - src/modules/{{kebabCase name}}/{{kebabCase name}}.module.ts
   - src/modules/{{kebabCase name}}/dto/create-{{kebabCase name}}.dto.ts
   - src/modules/{{kebabCase name}}/dto/update-{{kebabCase name}}.dto.ts
   - src/modules/{{kebabCase name}}/dto/{{kebabCase name}}.dto.ts
   - src/i18n/en/{{snakeCase name}}.json
   - src/i18n/pt-BR/{{snakeCase name}}.json

🔧 PRÓXIMOS PASSOS OBRIGATÓRIOS:

1. Executar migration e generate:
   npx prisma migrate dev --name create_{{snakeCase name}}
   npx prisma generate

2. Customizar os arquivos gerados conforme necessário:
   - Ajustar campos na Entity e no modelo Prisma
   - Adicionar validações específicas nos DTOs
   - Implementar regras de negócio no Service
   - Adicionar endpoints customizados no Controller

🚀 Após completar esses passos, seu módulo estará pronto para uso!
`,
      });

      return actions;
    },
  });
};