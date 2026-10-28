import { describe, it, expect } from 'vitest';
import { z } from 'zod';
import { buildFieldsFromConfig } from './field-config';

function fieldsFor(schema: z.ZodObject<z.ZodRawShape>, config = {}) {
  const fields = buildFieldsFromConfig(schema, config);
  return Object.fromEntries(fields.map((f) => [f.name, f]));
}

describe('buildFieldsFromConfig — type inference', () => {
  it('infers text for a plain string', () => {
    const fields = fieldsFor(z.object({ name: z.string() }));
    expect(fields.name.type).toBe('text');
    expect(fields.name.label).toBe('Name');
  });

  // BUG (not fixed — zero current blast radius, see note below): inferStringType() reads
  // `check.kind === 'email'`, which was Zod v3's shape. The installed Zod is v4.4.3, where a
  // string-format check instead looks like `{ def: { check: 'string_format', format: 'email' } }`
  // — no top-level `.kind` at all. So `.email()` fields silently infer as 'text', never 'email'.
  // Nothing in this codebase currently feeds an `.email()` field through `buildFieldsFromConfig`
  // (checked: no `z.enum(`/`.email()` schema outside this test file), so it's dormant today —
  // but it will bite the first person who adds one and expects the input `type` to follow.
  it('currently infers text (not email) for a string with .email() — Zod v3→v4 _def shape drift', () => {
    const fields = fieldsFor(z.object({ email: z.string().email() }));
    expect(fields.email.type).toBe('text');
  });

  it('infers number for ZodNumber', () => {
    const fields = fieldsFor(z.object({ age: z.number() }));
    expect(fields.age.type).toBe('number');
  });

  it('infers checkbox for ZodBoolean', () => {
    const fields = fieldsFor(z.object({ active: z.boolean() }));
    expect(fields.active.type).toBe('checkbox');
  });

  it('infers date for ZodDate', () => {
    const fields = fieldsFor(z.object({ birthday: z.date() }));
    expect(fields.birthday.type).toBe('date');
  });

  // BUG (not fixed — same dormant Zod v3→v4 drift as above): extractOptionsFromEnum() reads
  // `_def.values` as an array, Zod v3's shape. Zod v4 stores enum members as `_def.entries`
  // (an object map), so `values` is undefined and this always returns no options — the `type`
  // still correctly infers 'select' (that check only needs `instanceof z.ZodEnum`), but the
  // dropdown would render with an empty option list unless the caller passes `options` explicitly.
  it('infers select for ZodEnum, but currently extracts no options — Zod v3→v4 _def shape drift', () => {
    const fields = fieldsFor(z.object({ role: z.enum(['admin', 'user']) }));
    expect(fields.role.type).toBe('select');
    expect(fields.role.options).toBeUndefined();
  });

  it('falls back to text for an unrecognized zod type', () => {
    const fields = fieldsFor(z.object({ tags: z.array(z.string()) }));
    expect(fields.tags.type).toBe('text');
  });

  it('unwraps optional/nullable/default before inferring the type', () => {
    const fields = fieldsFor(
      z.object({
        nickname: z.string().optional(),
        bio: z.string().nullable(),
        score: z.number().default(0),
      }),
    );
    expect(fields.nickname.type).toBe('text');
    expect(fields.bio.type).toBe('text');
    expect(fields.score.type).toBe('number');
  });
});

describe('buildFieldsFromConfig — explicit config overrides', () => {
  const schema = z.object({ email: z.string().email() });

  it('lets an explicit type override the inferred one', () => {
    const fields = fieldsFor(schema, { email: { type: 'textarea' } });
    expect(fields.email.type).toBe('textarea');
  });

  it('lets an explicit label override the capitalized field name', () => {
    const fields = fieldsFor(schema, { email: { label: 'Work email' } });
    expect(fields.email.label).toBe('Work email');
  });

  it('passes through placeholder/description/disabled/className/preview/accept', () => {
    const fields = fieldsFor(schema, {
      email: {
        placeholder: 'you@x.com',
        description: 'help text',
        disabled: true,
        className: 'col-span-2',
        preview: 'https://x/img.png',
        accept: 'image/*',
      },
    });
    expect(fields.email).toMatchObject({
      placeholder: 'you@x.com',
      description: 'help text',
      disabled: true,
      className: 'col-span-2',
      preview: 'https://x/img.png',
      accept: 'image/*',
    });
  });

  it('lets explicit options override the auto-extracted enum options', () => {
    const roleSchema = z.object({ role: z.enum(['admin', 'user']) });
    const fields = fieldsFor(roleSchema, {
      role: { options: [{ value: 'admin', label: 'Administrator' }] },
    });
    expect(fields.role.options).toEqual([{ value: 'admin', label: 'Administrator' }]);
  });
});
