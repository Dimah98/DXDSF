/**
 * Fast-check arbitraries for property-based testing
 * 
 * These generators create random but valid test data for inventory system components
 */

import fc from 'fast-check';
import type { ResourceItem, InventoryFile } from '../types';

/**
 * Generates random resource image URLs of different types
 * - Absolute URLs (https://)
 * - Relative URLs (/api/images/...)
 * - Data URIs (data:image/png;base64,...)
 */
export const imageUrlArbitrary = fc.oneof(
  // Absolute HTTPS URL
  fc.webUrl({ validSchemes: ['https'] }),
  
  // Relative URL
  fc.string({ minLength: 3, maxLength: 20 })
    .map(s => `/api/images/${s.replace(/[^a-zA-Z0-9]/g, '')}.png`),
  
  // Data URI
  fc.base64String({ minLength: 10, maxLength: 50 })
    .map(s => `data:image/png;base64,${s}`)
);

/**
 * Generates a valid ResourceItem
 */
export const resourceItemArbitrary: fc.Arbitrary<ResourceItem> = fc.record({
  image: imageUrlArbitrary,
  number: fc.float({ 
    min: 0, 
    max: 10000, 
    noNaN: true,
    noDefaultInfinity: true 
  }),
  selector: fc.constant('div.relative:has(img[alt="item"])'),
  coords: fc.record({
    x: fc.integer({ min: 0, max: 1920 }),
    y: fc.integer({ min: 0, max: 1080 })
  })
});

/**
 * Generates a valid account/project name
 * Format: SF followed by 1-3 digits (SF1, SF2, ..., SF910)
 */
export const accountNameArbitrary = fc.oneof(
  fc.integer({ min: 1, max: 999 }).map(n => `SF${n}`),
  fc.constantFrom('SF1', 'SF2', 'SF10', 'SF100', 'SF910')
);

/**
 * Generates metadata for an inventory file
 */
export const inventoryMetadataArbitrary = fc.record({
  selector: fc.constant('div.relative:has(img[alt="item"])'),
  itemCount: fc.integer({ min: 0, max: 100 }),
  scanDuration: fc.integer({ min: 10, max: 5000 })
});

/**
 * Generates a valid InventoryFile
 */
export const inventoryFileArbitrary: fc.Arbitrary<InventoryFile> = fc.record({
  projectName: accountNameArbitrary,
  data: fc.array(resourceItemArbitrary, { minLength: 0, maxLength: 50 }),
  timestamp: fc.integer({ min: 1000000000000, max: 2000000000000 }),
  version: fc.constant('1.0'),
  metadata: inventoryMetadataArbitrary
});

/**
 * Generates an array of [accountId, InventoryFile] tuples
 * Useful for testing InventoryReader output
 */
export const inventoryTuplesArbitrary = (
  minAccounts: number = 1,
  maxAccounts: number = 20
) => fc.array(
  fc.tuple(accountNameArbitrary, inventoryFileArbitrary),
  { minLength: minAccounts, maxLength: maxAccounts }
);

/**
 * Generates an InventoryFile with invalid data for error testing
 */
export const invalidInventoryFileArbitrary = fc.oneof(
  // Missing image field
  fc.record({
    projectName: accountNameArbitrary,
    data: fc.array(
      fc.record({
        image: fc.constant(''),
        number: fc.float({ min: 0, max: 100 }),
        selector: fc.constant('div'),
        coords: fc.record({ x: fc.integer(), y: fc.integer() })
      })
    ),
    timestamp: fc.integer({ min: 1000000000000, max: 2000000000000 }),
    version: fc.constant('1.0'),
    metadata: inventoryMetadataArbitrary
  }),
  
  // Non-numeric number values (will be tested separately as JSON)
  fc.record({
    projectName: accountNameArbitrary,
    data: fc.array(
      fc.record({
        image: imageUrlArbitrary,
        number: fc.constant(NaN),
        selector: fc.constant('div'),
        coords: fc.record({ x: fc.integer(), y: fc.integer() })
      })
    ),
    timestamp: fc.integer({ min: 1000000000000, max: 2000000000000 }),
    version: fc.constant('1.0'),
    metadata: inventoryMetadataArbitrary
  }),
  
  // Wrong version
  fc.record({
    projectName: accountNameArbitrary,
    data: fc.array(resourceItemArbitrary),
    timestamp: fc.integer({ min: 1000000000000, max: 2000000000000 }),
    version: fc.string().filter(v => v !== '1.0'),
    metadata: inventoryMetadataArbitrary
  })
);

/**
 * Generates a search query string for filtering tests
 */
export const searchQueryArbitrary = fc.oneof(
  fc.constant(''),
  fc.stringMatching(/^SF[0-9]*$/),
  fc.string({ minLength: 1, maxLength: 5 }),
  accountNameArbitrary
);
