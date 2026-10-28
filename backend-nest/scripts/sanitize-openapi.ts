import * as fs from 'fs';
import * as path from 'path';

/** Corrige no documento OpenAPI os tipos malformados gerados pelo nestjs-zod. */
function sanitizeDocument(document: any): void {
  const schemas = document?.components?.schemas;
  if (!schemas) return;

  for (const [schemaName, schema] of Object.entries<any>(schemas)) {
    if (!schema.properties) continue;

    for (const [propName, prop] of Object.entries<any>(schema.properties)) {
      // Fix 1: Remove properties with empty type from nestjs-zod
      if (prop.type === '' && prop['x-nestjs_zod-empty-type'] === true) {
        delete schema.properties[propName];
        // Also remove from required array if present
        if (Array.isArray(schema.required)) {
          const idx = schema.required.indexOf(propName);
          if (idx !== -1) {
            schema.required.splice(idx, 1);
          }
        }
        continue;
      }

      // Fix 2: Fix array items with wrong type
      if (prop.type === 'array' && prop.items) {
        if (prop.items.type === 'array' || !prop.items.type) {
          prop.items.type = 'string';
        }
      }

      // Fix 3: Fix property with no type
      if (!prop.type && !prop.$ref && !prop.oneOf && !prop.anyOf && !prop.allOf) {
        prop.type = 'string';
      }
    }
  }
}

// Main: read openapi.json, sanitize, write back
const inputPath = path.join(__dirname, '..', 'openapi.json');
const raw = fs.readFileSync(inputPath, 'utf-8');
const document = JSON.parse(raw);

sanitizeDocument(document);

fs.writeFileSync(inputPath, JSON.stringify(document, null, 2));
console.log(`Sanitized OpenAPI spec written to ${inputPath}`);

// Log what was fixed
let removedCount = 0;
let arrayFixCount = 0;
let typeFixCount = 0;
const schemas = document?.components?.schemas;
if (schemas) {
  for (const [schemaName, schema] of Object.entries<any>(schemas)) {
    if (!schema.properties) continue;
    for (const [propName, prop] of Object.entries<any>(schema.properties)) {
      if (prop.type === '' && prop['x-nestjs_zod-empty-type'] === true) removedCount++;
      if (prop.type === 'array' && prop.items && (prop.items.type === 'array' || !prop.items.type)) arrayFixCount++;
      if (!prop.type && !prop.$ref && !prop.oneOf && !prop.anyOf && !prop.allOf) typeFixCount++;
    }
  }
}
console.log(`Statistics: ${removedCount} empty-zod properties removed, ${arrayFixCount} array items fixed, ${typeFixCount} missing types fixed`);
