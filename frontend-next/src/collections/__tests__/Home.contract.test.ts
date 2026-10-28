import { Home } from '../Home';

describe('Home collection contract', () => {
  it('has slug "home"', () => {
    expect(Home.slug).toBe('home');
  });

  it('has public read access', () => {
    // Read is () => true; calling with no args is safe per Media pattern
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    expect(Home.access?.read?.({} as any)).toBe(true);
  });

  it('has at least 2 fields in the content tab', () => {
    const fields = Home.fields ?? [];
    // Home uses a single tabs field; content fields live inside tabs[0]
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const tabsField = fields.find((f: any) => f.type === 'tabs') as any;
    expect(tabsField).toBeDefined();
    const contentTab = tabsField.tabs[0];
    expect(contentTab.fields.length).toBeGreaterThanOrEqual(2);
  });

  it('has access config defined', () => {
    expect(Home.access).toBeDefined();
  });
});
