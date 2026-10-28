import { Media } from '../Media';

describe('Media collection contract', () => {
  it('has slug "media"', () => {
    expect(Media.slug).toBe('media');
  });

  it('has public read access', () => {
    expect(Media.access?.read?.()).toBe(true);
  });

  it('has upload config', () => {
    expect(Media.upload).toBeDefined();
  });

  it('has alt text field', () => {
    const fields = Media.fields ?? [];
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const altField = fields.find((f: any) => f.name === 'alt');
    expect(altField).toBeDefined();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    expect((altField as any).required).toBe(true);
  });
});
