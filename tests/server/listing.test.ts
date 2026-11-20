import { describe, expect, it } from 'vitest';
import { readListingRegex } from '../../src/server/listing';
import { parseAddress } from '../../src/server/address';

const SAMPLES: Array<[string, Partial<ReturnType<typeof readListingRegex>>]> = [
  ['Example listing: 2055 42nd Ave, San Francisco. Fully remodeled Sunset home with a legal in-law. 2 units, 3 bed, 4 bath, about 2,000 sq ft. Offered at $1,595,000.', { address: '2055 42nd Ave', price: 1_595_000, units: 2, beds: 3, baths: 4, sqft: 2000, adu: 'legal' }],
  ['57 Carmelita St, San Francisco. 3 bed, 3 bath, about 2,700 sq ft, garden in-law. Offered at $3,295,000.', { address: '57 Carmelita St', price: 3_295_000, beds: 3, baths: 3, sqft: 2700, adu: 'claimed' }],
  ['1665 North Point Street #3, SF. 2BR/2BA condo, 1,150 sqft. List price $1.2M', { address: '1665 North Point St', price: 1_200_000, beds: 2, baths: 2, sqft: 1150 }],
  ['998 Burnett Avenue. Two bedrooms, 2 baths. Asking $1,295,000', { address: '998 Burnett Ave', price: 1_295_000, baths: 2 }],
  ['63 Jules Ave San Francisco CA 94112 | 3 beds | 2 baths | 1,250 sq ft | $1,149,000', { address: '63 Jules Ave', price: 1_149_000, beds: 3, baths: 2, sqft: 1250 }],
  ['686 Colby St: single-family home, 2 bd 1 ba, $999,000', { address: '686 Colby St', price: 999_000, units: 1, beds: 2, baths: 1 }],
  ['Duplex at 120 Hancock Street, San Francisco. 4 bed 3 bath. $2,100,000', { address: '120 Hancock St', units: 2, beds: 4, baths: 3 }],
  ['3327 Quintara St. New construction, 3 bed 2.5 bath, 1,800 sq ft. Offered at $1.85 million', { address: '3327 Quintara St', price: 1_850_000, baths: 2.5 }],
  ['Victorian at 501 Haight Street with ADU. 5 bedrooms, 3 bathrooms. Price: $2,995,000', { address: '501 Haight St', adu: 'claimed', beds: 5, baths: 3 }],
  ['Remodeled 2 unit building, 450 Frederick St, SF. Offered at $2,400,000. New roof 2023.', { address: '450 Frederick St', units: 2, price: 2_400_000 }],
];

describe('listing parser (regex path)', () => {
  it.each(SAMPLES)('%s', (text, want) => {
    expect(readListingRegex(text)).toMatchObject(want);
  });

  it('never splits a parcel by position: address parsing keeps suffix letters', () => {
    expect(parseAddress('2055A 42nd Ave')).toMatchObject({ number: '2055', suffix: 'A', street: '42ND', type: 'AVE' });
  });
});

describe('unit numbers', () => {
  it('reads a condo unit after the street type', () => {
    expect(parseAddress('301 Mission St #45E, San Francisco')).toMatchObject({ number: '301', street: 'MISSION', type: 'ST', unit: '45E' });
    expect(parseAddress('1665 North Point St, Unit 3, SF')).toMatchObject({ unit: '3' });
    expect(parseAddress('2055 42nd Ave, San Francisco')).toMatchObject({ unit: null });
  });
});
