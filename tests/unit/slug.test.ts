import { describe, expect, it } from 'vitest';
import { normalizeName, politicianSlug, slugify } from '../../src/lib/slug';

describe('name normalization', () => {
  it('is diacritic- and punctuation-insensitive', () => {
    expect(normalizeName('Dr. A.B.C. Déshmukh')).toBe('dr a b c deshmukh');
  });
  it('collapses whitespace', () => {
    expect(normalizeName('  Rahul   Gandhi ')).toBe('rahul gandhi');
  });
  it('does NOT merge different people', () => {
    expect(normalizeName('Ram Kumar')).not.toBe(normalizeName('Ram Kumari'));
  });
});

describe('politician slug', () => {
  it('combines name and constituency', () => {
    expect(politicianSlug('Narendra Modi', 'Varanasi')).toBe('narendra-modi-varanasi');
  });
  it('same name in different constituencies never collides', () => {
    expect(politicianSlug('Ajay Kumar', 'Patna Sahib')).not.toBe(politicianSlug('Ajay Kumar', 'Karakat'));
  });
  it('collision suffix keeps identical name+constituency pairs distinct', () => {
    const a = politicianSlug('Ajay Kumar', 'Patna Sahib', 'a1b2');
    const b = politicianSlug('Ajay Kumar', 'Patna Sahib', 'c3d4');
    expect(a).not.toBe(b);
    expect(a).toBe('ajay-kumar-patna-sahib-a1b2');
  });
  it('handles Devanagari names without emptying the slug', () => {
    expect(slugify('अजय कुमार').length).toBeGreaterThan(0);
  });
});
