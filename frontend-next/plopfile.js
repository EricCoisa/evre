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
    description: 'Criar um novo módulo Next.js completo',
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
      {
        type: 'list',
        name: 'area',
        message: 'Onde o módulo será criado?',
        choices: [
          { name: 'Admin (área administrativa)', value: 'admin' },
          { name: 'Client (área do cliente)', value: 'client' },
        ],
        default: 'admin',
      },
    ],
    actions: (data) => {
      const actions = [];

      // 1. Types
      actions.push({
        type: 'add',
        path: 'src/lib/actions/{{kebabCase name}}/types.ts',
        templateFile: 'plop-templates/types.ts.hbs',
        skipIfExists: true,
      });

      // 2. API
      actions.push({
        type: 'add',
        path: 'src/lib/actions/{{kebabCase name}}/api.ts',
        templateFile: 'plop-templates/api.ts.hbs',
        skipIfExists: true,
      });

      // 3. Queries (React Query hooks)
      actions.push({
        type: 'add',
        path: 'src/lib/actions/{{kebabCase name}}/queries.ts',
        templateFile: 'plop-templates/queries.ts.hbs',
        skipIfExists: true,
      });

      // 4. Page
      actions.push({
        type: 'add',
        path: 'src/app/(private)/({{area}})/{{kebabCase name}}/page.tsx',
        templateFile: 'plop-templates/page.tsx.hbs',
        skipIfExists: true,
      });

      // 5. Columns component
      actions.push({
        type: 'add',
        path: 'src/app/(private)/({{area}})/{{kebabCase name}}/components/{{kebabCase name}}-columns.tsx',
        templateFile: 'plop-templates/columns.tsx.hbs',
        skipIfExists: true,
      });

      // 6. Edit component
      actions.push({
        type: 'add',
        path: 'src/app/(private)/({{area}})/{{kebabCase name}}/components/{{kebabCase name}}-edit.tsx',
        templateFile: 'plop-templates/edit.tsx.hbs',
        skipIfExists: true,
      });

      // 7. Detail page [id]
      actions.push({
        type: 'add',
        path: 'src/app/(private)/({{area}})/{{kebabCase name}}/[id]/page.tsx',
        templateFile: 'plop-templates/detail-page.tsx.hbs',
        skipIfExists: true,
      });

      // 8. i18n - English
      actions.push({
        type: 'add',
        path: 'src/locales/en/{{camelCase name}}.json',
        templateFile: 'plop-templates/i18n-en.json.hbs',
        skipIfExists: true,
      });

      // 9. i18n - Portuguese
      actions.push({
        type: 'add',
        path: 'src/locales/pt-BR/{{camelCase name}}.json',
        templateFile: 'plop-templates/i18n-pt-BR.json.hbs',
        skipIfExists: true,
      });

      // 10. Adicionar import pt-BR antes do export const resources
      actions.push({
        type: 'modify',
        path: 'src/lib/translation-utils.ts',
        pattern: /(export const resources = \{)/,
        template: `import ptBR{{pascalCase name}} from '../locales/pt-BR/{{camelCase name}}.json';\n$1`,
      });

      // 11. Adicionar import en antes do export const resources
      actions.push({
        type: 'modify',
        path: 'src/lib/translation-utils.ts',
        pattern: /(export const resources = \{)/,
        template: `import en{{pascalCase name}} from '../locales/en/{{camelCase name}}.json';\n$1`,
      });

      // 12. Adicionar referência no resources pt-BR
      actions.push({
        type: 'modify',
        path: 'src/lib/translation-utils.ts',
        pattern: /(\s+'pt-BR': \{)/,
        template: `$1\n		{{camelCase name}}: ptBR{{pascalCase name}},`,
      });

      // 13. Adicionar referência no resources en
      actions.push({
        type: 'modify',
        path: 'src/lib/translation-utils.ts',
        pattern: /(\s+en: \{)/,
        template: `$1\n		{{camelCase name}}: en{{pascalCase name}},`,
      });

      // 14. Adicionar o nome do módulo em performance.config.ts
      actions.push({
        type: 'modify',
        path: 'src/lib/config/performance.config.ts',
        pattern: /(CACHE_TIMES:\s*{[^}]*)(\n\s*},)/,
        template: `$1\n    {{constantCase name}}: 5 * 60 * 1000, // 5 minutos - {{pascalCase name}}\n    {{constantCase name}}S: 5 * 60 * 1000, // 5 minutos - {{pascalCase name}}s\n$2`,
      });
      actions.push({
        type: 'modify',
        path: 'src/lib/config/performance.config.ts',
        pattern: /(GC_TIMES:\s*{[^}]*)(\n\s*},)/,
        template: `$1\n    {{constantCase name}}: 10 * 60 * 1000, // 10 minutos - {{pascalCase name}}\n    {{constantCase name}}S: 10 * 60 * 1000, // 10 minutos - {{pascalCase name}}s\n$2`,
      });

      // 15. Adicionar import do get{{pascalCase name}} no routepages.types.ts
      actions.push({
        type: 'modify',
        path: 'src/lib/types/routepages.types.ts',
        pattern: /(import\s+\{\s*getUser\s*\}\s+from\s+["']\.\.\/actions\/user\/api["'];)/,
        template: `$1\nimport { get{{pascalCase name}} } from "../actions/{{kebabCase name}}/api";`,
      });

      // 16. Adicionar objeto do módulo em RoutePagesList
      actions.push({
        type: 'modify',
        path: 'src/lib/types/routepages.types.ts',
        pattern: /(\s+\}),?(\s*\n\])/,
        template: `$1,\n    {\n        path: '/{{kebabCase name}}',\n        key: 'data.name',\n        getBreadName: (id?: string) => ({\n            queryKey: () => ["{{camelCase name}}", id],\n            queryFn: (id?: string) => get{{pascalCase name}}(id as string),\n        }),\n    }$2`,
      });

      // 17. Adicionar rota no seed.ts do backend
      actions.push({
        type: 'modify',
        path: '../backend-nest/prisma/seed.ts',
        pattern: /(const settingsRoute = await prisma\.route\.upsert\([\s\S]*?\);\s*\n)/,
        template: `$1  const {{camelCase name}}Route = await prisma.route.upsert({\n    where: { path: '/{{kebabCase name}}' },\n    update: {},\n    create: {\n      path: '/{{kebabCase name}}',\n      labelKey: 'ROUTE_{{constantCase name}}',\n      icon: 'Box',\n      ordem: 8,\n      isHome: false,\n      isActive: true,\n    },\n  });\n`,
      });

      // 18. Adicionar permissões por área no seed.ts
      if (data.area === 'admin') {
        // Adicionar aos arrays de ADMIN e MODERATOR
        actions.push({
          type: 'modify',
          path: '../backend-nest/prisma/seed.ts',
          pattern: /(const adminRoleAccesses = \[[\s\S]*?{ roleId: 'ADMIN' as const, routeId: settingsRoute\.id },)\s*\n\s*(\/\/ \{ roleId: 'ADMIN' as const, routeId: systemConfigurationRoute\.id \},)\s*\n\s*\];/,
          template: `$1\n    $2\n    { roleId: 'ADMIN' as const, routeId: {{camelCase name}}Route.id },\n  ];`,
        });
        actions.push({
          type: 'modify',
          path: '../backend-nest/prisma/seed.ts',
          pattern: /(const moderatorRoleAccesses = \[[\s\S]*?{ roleId: 'MODERATOR' as const, routeId: profileRoute\.id },)\s*\];/,
          template: `$1\n    { roleId: 'MODERATOR' as const, routeId: {{camelCase name}}Route.id },\n  ];`,
        });
        actions.push({
          type: 'modify',
          path: '../backend-nest/prisma/seed.ts',
          pattern: /(const adminUserAccesses = \[[\s\S]*?{ userId: adminUser\.id, routeId: settingsRoute\.id },)\s*\n\s*(\/\/ \{ userId: adminUser\.id, routeId: systemConfigurationRoute\.id \},)\s*\n\s*\];/,
          template: `$1\n    $2\n    { userId: adminUser.id, routeId: {{camelCase name}}Route.id },\n  ];`,
        });
      } else if (data.area === 'client') {
        // Adicionar permissão para USER
        actions.push({
          type: 'modify',
          path: '../backend-nest/prisma/seed.ts',
          pattern: /(await prisma\.roleRouteAccess\.upsert\({\s*where:\s*{\s*roleId_routeId:\s*{\s*roleId:\s*'USER',\s*routeId:\s*profileRoute\.id,\s*},\s*},\s*update:\s*{},\s*create:\s*{\s*roleId:\s*'USER',\s*routeId:\s*profileRoute\.id,\s*},\s*}\);)/,
          template: `$1\n\n  await prisma.roleRouteAccess.upsert({\n    where: {\n      roleId_routeId: {\n        roleId: 'USER',\n        routeId: {{camelCase name}}Route.id,\n      },\n    },\n    update: {},\n    create: {\n      roleId: 'USER',\n      routeId: {{camelCase name}}Route.id,\n    },\n  });`,
        });
      }


      // 17. Adicionar labelKey nos arquivos de tradução
      actions.push({
        type: 'modify',
        path: 'src/locales/en/labelKey.json',
        pattern: /({\s*\n)/,
        template: `$1    "ROUTE_{{constantCase name}}": "{{pascalCase name}}",\n`,
      });
      actions.push({
        type: 'modify',
        path: 'src/locales/pt-BR/labelKey.json',
        pattern: /({\s*\n)/,
        template: `$1    "ROUTE_{{constantCase name}}": "{{pascalCase name}}",\n`
      });

      return actions;
    },
  });
};