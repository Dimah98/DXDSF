/**
 * TypeScript interfaces for Sunflower Land Inventory feature
 */

export interface ResourceItem {
  image: string;
  number: number;
  selector: string;
  coords: { x: number; y: number };
}

export interface InventoryFile {
  projectName: string;
  data: ResourceItem[];
  timestamp: number;
  version: string;
  metadata: {
    selector: string;
    itemCount: number;
    scanDuration: number;
  };
}

export interface ResourceMetadata {
  image: string;
  index: number;
}

export interface AggregatedInventoryData {
  accounts: string[];
  resources: ResourceMetadata[];
  data: (number | null)[][];
  timestamp: number;
}

export interface ErrorResponse {
  success: false;
  error: string;
}

export interface SuccessResponse extends AggregatedInventoryData {
  success?: true;
}
