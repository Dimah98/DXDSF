# Test Fixtures

This directory contains sample data and fixtures for testing the inventory overview system.

## Structure

- `sample-inventories/` - Sample inventory JSON files for testing
- `arbitraries.ts` - Fast-check arbitraries (generators) for property-based tests

## Sample Inventories

Sample inventory files follow the format `{accountId}_inventory.json` and contain realistic test data representing various scenarios:

- Normal inventories with multiple resources
- Empty inventories
- Inventories with edge cases (very large numbers, fractional quantities)
- Malformed files for error testing
