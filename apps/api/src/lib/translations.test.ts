import { describe, expect, it } from 'vitest';
import { applyOverrides, languageBase, resolveServeLocale } from './translations';

describe('languageBase', () => {
  it('strips region', () => {
    expect(languageBase('en-US')).toBe('en');
    expect(languageBase('cs-CZ')).toBe('cs');
    expect(languageBase('de')).toBe('de');
  });
});

describe('resolveServeLocale', () => {
  const enabled = ['cs-CZ', 'en-US', 'sk-SK'];
  it('returns default when nothing requested', () => {
    expect(resolveServeLocale(undefined, enabled, 'cs-CZ')).toBe('cs-CZ');
  });
  it('returns exact match when enabled', () => {
    expect(resolveServeLocale('en-US', enabled, 'cs-CZ')).toBe('en-US');
  });
  it('falls back to same language', () => {
    // en-GB not enabled, but en-US is → same base 'en'
    expect(resolveServeLocale('en-GB', enabled, 'cs-CZ')).toBe('en-US');
  });
  it('falls back to default when language unavailable', () => {
    expect(resolveServeLocale('fr-FR', enabled, 'cs-CZ')).toBe('cs-CZ');
  });
});

describe('applyOverrides', () => {
  it('overwrites only present fields', () => {
    const obj = { title: 'Master', desc: 'MasterDesc' };
    const overrides = new Map([['title', 'Translated']]);
    applyOverrides(obj, overrides, { title: 'title', description_html: 'desc' });
    expect(obj).toEqual({ title: 'Translated', desc: 'MasterDesc' });
  });
  it('ignores empty / missing overrides', () => {
    const obj = { title: 'Master' };
    applyOverrides(obj, new Map([['title', '']]), { title: 'title' });
    expect(obj.title).toBe('Master');
    applyOverrides(obj, undefined, { title: 'title' });
    expect(obj.title).toBe('Master');
  });
});
