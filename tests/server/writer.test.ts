import { describe, expect, it } from 'vitest';
import { uncitedRecord } from '../../src/server/writer';
describe('uncited record numbers', () => {
  it('flags a record number with no citation', () => {
    expect(uncitedRecord('The listing says 1 unit, but city records show a 20-unit building. Baths have no city record.')).toMatch(/20-unit/);
    expect(uncitedRecord('City records show one legal unit [1]. Records show 1,637 sq ft [1].')).toBeNull();
    expect(uncitedRecord('Three listing claims differ from city records.')).toBeNull();
  });
});
