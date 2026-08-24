import type { InventoryFile, AggregatedInventoryData, ResourceMetadata } from '../types';

export class ResourceAggregator {
  aggregate(inventories: Array<[string, InventoryFile]>): AggregatedInventoryData {
    const uniqueImages = new Set<string>();
    for (const [, inventory] of inventories) {
      for (const item of inventory.data) {
        if (item.image && typeof item.image === 'string' && item.image.length > 0) {
          uniqueImages.add(item.image);
        }
      }
    }
    const resources: ResourceMetadata[] = Array.from(uniqueImages).map((image, index) => ({ image, index }));
    const imageToIndex = new Map<string, number>();
    resources.forEach(resource => imageToIndex.set(resource.image, resource.index));

    const accounts = inventories.map(([accountId]) => accountId).sort((a, b) => a.localeCompare(b));
    const accountToIndex = new Map<string, number>();
    accounts.forEach((account, index) => accountToIndex.set(account, index));

    const data: (number | null)[][] = Array(accounts.length).fill(null).map(() => Array(resources.length).fill(null));

    for (const [accountId, inventory] of inventories) {
      const accountIndex = accountToIndex.get(accountId);
      if (accountIndex === undefined) continue;
      for (const item of inventory.data) {
        if (!item.image || typeof item.image !== 'string' || item.image.length === 0) continue;
        const resourceIndex = imageToIndex.get(item.image);
        if (resourceIndex === undefined) continue;
        const quantity = typeof item.number === 'number' && !isNaN(item.number) ? item.number : 0;
        data[accountIndex][resourceIndex] = Math.round(quantity * 10) / 10;
      }
    }

    return { accounts, resources, data, timestamp: Date.now() };
  }
}
