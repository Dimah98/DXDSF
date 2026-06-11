# Inventory Overview System

## Overview

This module implements a comprehensive inventory overview system for Satisfactory Factory game accounts. The system scans inventory JSON files, aggregates resource data across all accounts, and provides a REST API endpoint for viewing, filtering, and exporting the aggregated data.

## Architecture

The system consists of the following components:

1. **InventoryReader** - Scans and reads inventory JSON files from the filesystem
2. **ResourceAggregator** - Aggregates unique resources and creates data matrices
3. **API Endpoint** - Express route handler at `/api/inventory/overview`
4. **Frontend UI** - React component for displaying and interacting with the data
5. **CSV Exporter** - Utility for exporting data in CSV format

## Directory Structure

```
inventory-overview/
├── types.ts                       # Core TypeScript interfaces
├── InventoryReader.ts             # File scanning and reading logic
├── ResourceAggregator.ts          # Data aggregation logic
├── api.ts                         # Express API endpoint
├── README.md                      # This file
├── __tests__/
│   ├── unit/                      # Unit tests for specific behaviors
│   │   ├── InventoryReader.test.ts
│   │   ├── ResourceAggregator.test.ts
│   │   └── csvExport.test.ts
│   ├── properties/                # Property-based tests
│   │   ├── InventoryReader.properties.test.ts
│   │   ├── ResourceAggregator.properties.test.ts
│   │   ├── api.properties.test.ts
│   │   └── filters.properties.test.ts
│   └── integration/               # Integration tests
│       ├── api.integration.test.ts
│       └── endToEnd.test.ts
└── __fixtures__/                  # Test fixtures and sample data
    └── sample-inventories/
```

## Testing Strategy

The system employs a dual testing approach:

### Unit Tests
- Test specific examples and edge cases
- Test error conditions and validation logic
- Test integration with external systems (filesystem, localStorage)
- Located in `__tests__/unit/`

### Property-Based Tests
- Test universal properties that should hold across all valid inputs
- Use fast-check library with minimum 100 iterations per property
- Cover all 21 correctness properties from the design document
- Located in `__tests__/properties/`

### Integration Tests
- Test complete flows through multiple components
- Test API endpoints with real HTTP requests using Supertest
- Test end-to-end scenarios
- Located in `__tests__/integration/`

## Running Tests

```bash
# Run all tests
npm test

# Run tests in watch mode
npm run test:watch

# Run specific test file
npm test -- InventoryReader.test.ts

# Run property tests only
npm test -- properties
```

## Key Interfaces

See `types.ts` for complete interface definitions:

- `InventoryFile` - Structure of inventory JSON files on disk
- `ResourceItem` - Individual resource with image, quantity, and metadata
- `AggregatedInventoryData` - API response format with accounts, resources, and data matrix
- `ResourceMetadata` - Metadata for unique resources in aggregated view

## API Endpoint

**GET** `/api/inventory/overview`

Returns aggregated inventory data across all accounts.

**Authentication:** Required (JWT token via authMiddleware)

**Response:** `AggregatedInventoryData`

```json
{
  "accounts": ["SF1", "SF2", "SF910"],
  "resources": [
    { "image": "https://example.com/corn.png", "index": 0 },
    { "image": "https://example.com/wheat.png", "index": 1 }
  ],
  "data": [
    [29, 70],      // SF1: 29 corn, 70 wheat
    [15, null],    // SF2: 15 corn, no wheat
    [null, 100]    // SF910: no corn, 100 wheat
  ],
  "timestamp": 1780900000000
}
```

## Development Notes

- All numeric values are rounded to 1 decimal place
- Missing resources in an account are represented as `null` in the data matrix
- Accounts are always sorted alphabetically
- The system handles up to 100 accounts efficiently (target response time: <2 seconds)
- All file reading errors are logged but don't stop the aggregation process
