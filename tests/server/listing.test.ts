import { describe, expect, it } from 'vitest';
import { readListing, readListingRegex } from '../../src/server/listing';
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

describe('loose addresses from the model', () => {
  it('accepts a number and street name without a type', async () => {
    const { parseAddressLoose } = await import('../../src/server/address');
    expect(parseAddressLoose('1200 Cole')).toMatchObject({ number: '1200', street: 'COLE', type: null });
    expect(parseAddressLoose('1200 Cole Street')).toMatchObject({ street: 'COLE', type: 'ST' });
    expect(parseAddressLoose('Cole Street')).toBeNull();
  });
});

describe('unit spellings', () => {
  it('reads "#15 A" as unit 15A', () => {
    expect(parseAddress('501 Beale St #15 A, San Francisco')).toMatchObject({ unit: '15A' });
    expect(parseAddress('1 Main St #1504 SF')).toMatchObject({ unit: '1504' });
  });
});

describe('prices without a dollar sign', () => {
  it('reads "asking 799k" and "asking 1.2M"', async () => {
    const { readListingRegex: regexListing } = await import('../../src/server/listing');
    expect(regexListing('450 Vallejo St sf, 1br/1ba condo asking 799k').price).toBe(799000);
    expect(regexListing('1 Main St, SF. 2 bed, asking 1.2M').price).toBe(1200000);
  });
});

describe('agent email', () => {
  it('drops the sentence period after an address', async () => {
    const r = await readListing('Example listing: 57 Carmelita St, San Francisco. 3 bed, 3 bath. Agent: agent@example.com. Offered at $3,295,000.');
    expect(r.ok && r.agentEmail).toBe('agent@example.com');
  });
});

describe('street spellings', () => {
  it("drops apostrophes so O'Farrell matches the city's OFARRELL, and shows it with one", () => {
    expect(parseAddress("631 O'Farrell St, San Francisco")).toMatchObject({ street: 'OFARRELL', display: "631 O'Farrell St" });
    expect(parseAddress('213 06th Ave, San Francisco')?.display).toBe('213 6th Ave');
  });
});

describe('streets without a type', () => {
  it('reads Broadway, Avenue B and Avenue of the Palms before ", San Francisco", never "2 bath, San Francisco"', () => {
    expect(parseAddress('1000 Broadway #503, San Francisco')).toMatchObject({ street: 'BROADWAY', type: null, unit: '503' });
    expect(parseAddress('901 Avenue B, San Francisco')).toMatchObject({ street: 'AVENUE B', type: null });
    expect(parseAddress('336 Avenue of the Palms, SF')?.display).toBe('336 Avenue of the Palms');
    expect(parseAddress('3 bed 2 bath, San Francisco')).toBeNull();
  });
});

describe('price among other dollar amounts', () => {
  it('skips HOA dues and monthly estimates', () => {
    expect(readListingRegex('1 Main St, San Francisco. Condo, HOA $500. $899,000.').price).toBe(899000);
    expect(readListingRegex('1 Main St, SF. Est. $8,912/mo. $1,349,000').price).toBe(1349000);
  });
});

describe('living area, not the lot', () => {
  it('skips lot square footage', () => {
    expect(readListingRegex('1 Main St, SF. Lot: 2,500 sq ft. Living area 1,200 sq ft.').sqft).toBe(1200);
    expect(readListingRegex('1 Main St, SF. 2,500 sq ft lot, 1,200 sq ft of living space.').sqft).toBe(1200);
  });
});

describe('bed and bath phrasing', () => {
  it('reads words, half baths and studios', () => {
    expect(readListingRegex('1 Main St, SF. 3 bedrooms, 2 full baths and 1 half bath.')).toMatchObject({ beds: 3, baths: 2.5 });
    expect(readListingRegex('1 Main St, SF. Three bedrooms, two baths.')).toMatchObject({ beds: 3, baths: 2 });
    expect(readListingRegex('1 Main St, SF. Studio, 1 bath.')).toMatchObject({ beds: 0, baths: 1 });
  });
});

describe('address number ranges', () => {
  it('takes the first number and keeps the second as a fallback', () => {
    expect(parseAddress('1214-1216 Fell St, San Francisco')).toMatchObject({ number: '1214', alts: ['1216'], display: '1214 Fell St' });
    expect(parseAddress('1207-09 Fell St, SF')).toMatchObject({ number: '1207', alts: ['1209'] });
    expect(parseAddress('Built 1900-1910. 57 Carmelita St, SF')?.alts).toBeUndefined();
  });
});

describe('other cities vs SF streets that share their names', () => {
  it('keeps SF streets and districts, rejects other cities in city position', async () => {
    for (const t of ['2400 Sacramento St. 3 bed 2 bath $2M', 'Inner Richmond Edwardian. 600 Clement St, 2 bed 1 bath $1.2M', '2000 San Jose Ave, 2 bed 1 bath $1M', '345 Fremont St #2201, 1 bed $900k'])
      expect((await readListing(t)).ok).toBe(true);
    for (const t of ['123 Main St, Oakland CA 94607. 2 bed 1 bath $1M', '123 Main St, Berkeley, CA. 2 bed 1 bath $1M', '12 Elm St, South San Francisco, CA 94080. 2 bed 1 bath $1M'])
      expect(await readListing(t)).toEqual({ ok: false, kind: 'outside_sf' });
  });
});

describe('listing prose that looks like an address', () => {
  it('skips "5 min walk" and "10 minute drive" for the real address', () => {
    expect(parseAddress('Sunny home, 5 min walk to BART. 600 Clement St, SF')?.display).toBe('600 Clement St');
    expect(parseAddress('Just a 10 minute drive to downtown! 600 Clement St')?.display).toBe('600 Clement St');
    expect(parseAddress('Laundry in unit, 2 car parking lane. 600 Clement St')?.display).toBe('600 Clement St');
    expect(parseAddress('12 Miles St, SF')?.display).toBe('12 Miles St');
  });
});

describe('price in a pasted listing page', () => {
  it('skips Zestimates and past sales', () => {
    const page = '$1,295,000\n3 bd 2 ba 1,520 sqft\n1214 Fell St, San Francisco, CA 94117\nEst.: $8,204/mo\n$852/sqft  Zestimate®: $1,402,300\nPrice history\n3/1/2008 Sold $1,510,000';
    expect(readListingRegex(page)).toMatchObject({ price: 1295000, beds: 3, baths: 2, sqft: 1520, address: '1214 Fell St' });
    expect(readListingRegex('Zestimate: $1,402,300. 1214 Fell St SF. $1,295,000').price).toBe(1295000);
  });
});

describe('Redfin layout', () => {
  it('reads counts on their own line', () => {
    const page = '1214 Fell St, San Francisco, CA 94117\nRedfin Estimate $1,380,000\n$1,295,000\nPrice\n3\nBeds\n2.5\nBaths\n1,520\nSq Ft\nLot Size: 2,495 Sq. Ft.';
    expect(readListingRegex(page)).toMatchObject({ price: 1295000, beds: 3, baths: 2.5, sqft: 1520 });
  });
});
