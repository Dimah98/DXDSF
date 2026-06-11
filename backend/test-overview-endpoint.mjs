/**
 * Manual test script for /api/inventory/overview endpoint
 * 
 * This script tests the endpoint with actual inventory files
 * from the projects directory.
 */

import { InventoryReader } from './src/inventory-overview/InventoryReader.js';
import { ResourceAggregator } from './src/inventory-overview/ResourceAggregator.js';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function testEndpoint() {
  try {
    console.log('🧪 Testing /api/inventory/overview endpoint logic...\n');
    
    const PROJECTS_DIR = path.join(__dirname, 'projects');
    console.log(`📁 Reading from: ${PROJECTS_DIR}\n`);
    
    // Create instances
    const reader = new InventoryReader();
    const aggregator = new ResourceAggregator();
    
    // Measure performance
    const startTime = Date.now();
    
    // Read all inventories
    console.log('📖 Reading inventory files...');
    const inventories = await reader.readAllInventories(PROJECTS_DIR);
    console.log(`   Found ${inventories.length} inventory files\n`);
    
    // Aggregate data
    console.log('🔄 Aggregating resources...');
    const result = aggregator.aggregate(inventories);
    
    const duration = Date.now() - startTime;
    
    // Display results
    console.log('\n✅ Success!\n');
    console.log('📊 Results:');
    console.log(`   - Accounts: ${result.accounts.length}`);
    console.log(`   - Resources: ${result.resources.length}`);
    console.log(`   - Data matrix: ${result.accounts.length} × ${result.resources.length}`);
    console.log(`   - Timestamp: ${new Date(result.timestamp).toISOString()}`);
    console.log(`   - Processing time: ${duration}ms\n`);
    
    if (result.accounts.length > 0) {
      console.log('👥 Accounts (first 10):');
      result.accounts.slice(0, 10).forEach(account => {
        console.log(`   - ${account}`);
      });
      console.log();
    }
    
    if (result.resources.length > 0) {
      console.log('🎨 Resources (first 5):');
      result.resources.slice(0, 5).forEach(resource => {
        const imagePreview = resource.image.length > 50 
          ? resource.image.substring(0, 50) + '...' 
          : resource.image;
        console.log(`   - [${resource.index}] ${imagePreview}`);
      });
      console.log();
    }
    
    // Sample data
    if (result.accounts.length > 0 && result.resources.length > 0) {
      console.log('📈 Sample data (first account):');
      const firstAccount = result.accounts[0];
      const firstAccountData = result.data[0];
      console.log(`   Account: ${firstAccount}`);
      firstAccountData.slice(0, 5).forEach((value, idx) => {
        if (value !== null) {
          console.log(`   - Resource ${idx}: ${value}`);
        }
      });
      console.log();
    }
    
    console.log('✨ Test completed successfully!');
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

testEndpoint();
