// Set env BEFORE any imports — modules read this at evaluation time
process.env.OPENAPI_GENERATION = 'true';
process.env.NODE_ENV = 'production';

import * as fs from 'fs';
import * as path from 'path';
import { NestFactory } from '@nestjs/core';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { AppOpenApiModule } from '../src/app-openapi.module';

function sanitizeDocument(document: any): void {
  const schemas = document?.components?.schemas;
  if (!schemas) return;

  for (const schema of Object.values<any>(schemas)) {
    if (!schema.properties) continue;

    for (const [propName, prop] of Object.entries<any>(schema.properties)) {
      if (prop.type === '' && prop['x-nestjs_zod-empty-type'] === true) {
        delete schema.properties[propName];
        if (Array.isArray(schema.required)) {
          const idx = schema.required.indexOf(propName);
          if (idx !== -1) schema.required.splice(idx, 1);
        }
        continue;
      }

      if (prop.type === 'array' && prop.items) {
        if (prop.items.type === 'array' || !prop.items.type) {
          prop.items.type = 'string';
        }
      }

      if (!prop.type && !prop.$ref && !prop.oneOf && !prop.anyOf && !prop.allOf) {
        prop.type = 'string';
      }
    }
  }
}

function stripGlobalPrefix(document: any, prefix: string): void {
  const paths = document?.paths;
  if (!paths) return;

  const stripped: Record<string, any> = {};
  for (const [pathKey, methods] of Object.entries<any>(paths)) {
    const bareKey = pathKey.startsWith(prefix) ? pathKey.slice(prefix.length) : pathKey;
    stripped[bareKey] = methods;
  }
  document.paths = stripped;
  document.servers = [{ url: prefix }];
}

async function exportOpenApi() {
  console.log('Bootstrapping app for OpenAPI export...');
  const app = await NestFactory.create(AppOpenApiModule, {
    logger: ['error', 'warn'],
  });
  const apiPrefix = 'api/v1';
  app.setGlobalPrefix(apiPrefix);

  const config = new DocumentBuilder()
    .setTitle('API')
    .setVersion('1.0')
    .addBearerAuth()
    .build();

  const document = SwaggerModule.createDocument(app, config);

  stripGlobalPrefix(document, `/${apiPrefix}`);
  sanitizeDocument(document);

  const outputPath = path.join(__dirname, '..', 'openapi.json');
  fs.writeFileSync(outputPath, JSON.stringify(document, null, 2));
  console.log(`OpenAPI spec written to ${outputPath}`);

  process.exit(0);
}

exportOpenApi().catch((err) => {
  console.error(err);
  process.exit(1);
});
