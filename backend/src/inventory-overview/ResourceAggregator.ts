/**
 * ResourceAggregator - Aggregates resource data across multiple inventory files
 * 
 * This component processes inventory data from multiple game accounts and creates
 * a unified view showing which resources are available in which accounts.
 */

import type { InventoryFile, AggregatedInventoryData, ResourceMetadata } from './types';

/**
 * Aggregates inventory data from multiple accounts into a unified structure
 */
export class ResourceAggregator {
  /**
   * Aggregates resources from multiple inventory files
   * 
   * @param inventories - Array of [accountId, inventoryFile] tuples
   * @returns Aggregated data structure with accounts, resources, and data matrix
   * 
   * Algorithm:
   * 1. Collect all unique image URLs from all inventories
   * 2. Create mapping from image URL to resource index
   * 3. Sort accounts alphabetically
   * 4. Build data matrix where data[accountIndex][resourceIndex] = quantity | null
   * 5. Round all numbers to 1 decimal place
   */
  aggregate(inventories: Array<[string, InventoryFile]>): AggregatedInventoryData {
    // Step 1: Collect all unique image URLs
    const uniqueImages = new Set<string>();
    
    for (const [, inventory] of inventories) {
      for (const item of inventory.data) {
        // Filter out invalid resources (missing or empty image field)
        if (item.image && typeof item.image === 'string' && item.image.length > 0) {
          uniqueImages.add(item.image);
        }
      }
    }
    
    // Step 2: Create resource metadata with indices
    const resources: ResourceMetadata[] = Array.from(uniqueImages)
      .map((image, index) => ({
        image,
        index
      }));
    
    // Create mapping for quick lookup: image URL → resource index
    const imageToIndex = new Map<string, number>();
    resources.forEach(resource => {
      imageToIndex.set(resource.image, resource.index);
    });
    
    // Step 3: Sort accounts alphabetically
    const accounts = inventories
      .map(([accountId]) => accountId)
      .sort((a, b) => a.localeCompare(b));
    
    // Create mapping for account name to sorted position
    const accountToIndex = new Map<string, number>();
    accounts.forEach((account, index) => {
      accountToIndex.set(account, index);
    });
    
    // Step 4: Initialize data matrix with null values
    const data: (number | null)[][] = Array(accounts.length)
      .fill(null)
      .map(() => Array(resources.length).fill(null));
    
    // Step 5: Fill the data matrix with resource quantities
    for (const [accountId, inventory] of inventories) {
      const accountIndex = accountToIndex.get(accountId);
      
      if (accountIndex === undefined) {
        continue; // Skip if account not found (shouldn't happen)
      }
      
      for (const item of inventory.data) {
        // Skip invalid items
        if (!item.image || typeof item.image !== 'string' || item.image.length === 0) {
          continue;
        }
        
        const resourceIndex = imageToIndex.get(item.image);
        
        if (resourceIndex === undefined) {
          continue; // Skip if resource not found (shouldn't happen)
        }
        
        // Handle non-numeric values by using 0
        let quantity: number;
        if (typeof item.number !== 'number' || isNaN(item.number)) {
          quantity = 0;
        } else {
          quantity = item.number;
        }
        
        // Round to 1 decimal place
        const rounded = Math.round(quantity * 10) / 10;
        
        data[accountIndex][resourceIndex] = rounded;
      }
    }
    
    // Step 6: Return aggregated data with timestamp
    return {
      accounts,
      resources,
      data,
      timestamp: Date.now()
    };
  }
}
