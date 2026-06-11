/**
 * TypeScript interfaces for Inventory Overview feature
 * 
 * This module defines the core data structures used throughout the inventory
 * aggregation system for Satisfactory Factory game accounts.
 */

/**
 * Represents a single resource item in an inventory
 */
export interface ResourceItem {
  /** URL or data URI of the resource icon (unique identifier) */
  image: string;
  /** Quantity of the resource (can be fractional) */
  number: number;
  /** CSS selector used to locate this element */
  selector: string;
  /** Screen coordinates where the resource was found */
  coords: {
    x: number;
    y: number;
  };
}

/**
 * Represents a complete inventory file as stored on disk
 * Format: {accountId}_inventory.json
 */
export interface InventoryFile {
  /** Name of the project/account (should match filename) */
  projectName: string;
  /** Array of resource items in this inventory */
  data: ResourceItem[];
  /** Unix timestamp when the inventory was created */
  timestamp: number;
  /** Format version (currently "1.0") */
  version: string;
  /** Metadata about the scan operation */
  metadata: {
    /** CSS selector pattern used for scanning */
    selector: string;
    /** Total number of items scanned */
    itemCount: number;
    /** Duration of the scan operation in milliseconds */
    scanDuration: number;
  };
}

/**
 * Metadata for a unique resource in the aggregated view
 */
export interface ResourceMetadata {
  /** URL of the resource icon (unique identifier) */
  image: string;
  /** Index in the resources array for quick lookup */
  index: number;
}

/**
 * Aggregated inventory data across all accounts
 * This is the response format for the API endpoint
 */
export interface AggregatedInventoryData {
  /** Sorted list of account names */
  accounts: string[];
  /** List of unique resources across all accounts */
  resources: ResourceMetadata[];
  /** 
   * 2D matrix of resource quantities
   * data[accountIndex][resourceIndex] = quantity | null
   * null indicates the resource is not present in that account
   */
  data: (number | null)[][];
  /** Unix timestamp when this aggregation was generated */
  timestamp: number;
}

/**
 * Error response format for API endpoints
 */
export interface ErrorResponse {
  success: false;
  error: string;
}

/**
 * Success response format (wrapper for AggregatedInventoryData)
 */
export interface SuccessResponse extends AggregatedInventoryData {
  success?: true;
}
