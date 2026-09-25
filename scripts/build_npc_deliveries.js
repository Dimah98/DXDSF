const fs = require('fs');
const path = require('path');

const inputPath = 'C:/Users/Dima/.gemini/antigravity/brain/02544cbe-6891-4ea4-a090-bc8e6d95f29f/.system_generated/steps/5246/content.md';
const content = fs.readFileSync(inputPath, 'utf8');

const cards = content.split(/<div class="card m-top-10">/g);
const result = {};

for (let c = 1; c < cards.length; c++) {
  const cardHtml = cards[c];
  const catMatch = cardHtml.match(/<div class="card-header h5">([^<]+)<\/div>/i);
  const category = catMatch ? catMatch[1].trim() : 'OTHER';

  const npcBlocks = cardHtml.split(/<div class="m-right-10">/g);
  for (let i = 1; i < npcBlocks.length; i++) {
    const block = npcBlocks[i];
    const nameMatch = block.match(/<tr><td colspan="2" class="ta-left b">([^<]+)<\/td><\/tr>/i);
    if (!nameMatch) continue;
    const rawName = nameMatch[1].trim();

    const iconMatch = block.match(/<img src="\/img\/(?:plaza|beach|static)\/([^"]+)"/i) || block.match(/<img src="([^"]+)" title="[^"]*" class="img-75"/i);
    let npcIcon = iconMatch ? iconMatch[1].split('/').pop() : rawName.toLowerCase() + '.png';
    if (!npcIcon.endsWith('.png')) {
      npcIcon = npcIcon.replace(/\.[^.]+$/, '') + '.png';
    }

    const avgRewardMatch = block.match(/<tr><td class="ta-left">AVG Reward<\/td><td class="ta-left b">(?:<img[^>]*>)?([\d.]+)<\/td><\/tr>/i);
    const avgReward = avgRewardMatch ? avgRewardMatch[1].trim() : '';

    const avgCostMatch = block.match(/<tr><td class="ta-left">AVG Cost<\/td><td class="ta-left b">(?:<img[^>]*>)?([\d.]+)/i);
    const avgCost = avgCostMatch ? avgCostMatch[1].trim() : '';

    const tbodyMatch = block.match(/<tbody>([\s\S]*?)<\/tbody>/i);
    if (!tbodyMatch) continue;
    const tbody = tbodyMatch[1];

    const rows = [...tbody.matchAll(/<tr>([\s\S]*?)<\/tr>/gi)];
    const deliveries = [];

    rows.forEach((row, rIdx) => {
      const rowHtml = row[1];
      const itemMatches = [...rowHtml.matchAll(/<div><img src="[^"]*\/([^\/"]+\.png)"[^>]*\/>\s*([^:]+):\s*([\d.]+)\s*<\/div>/gi)];
      const items = itemMatches.map(im => ({
        image: im[1],
        name: im[2].trim(),
        amount: parseFloat(im[3])
      }));

      const cells = [...rowHtml.matchAll(/<td class="ta-left">([\s\S]*?)<\/td>/gi)];
      let rewardText = '';
      if (cells.length >= 2) {
        rewardText = cells[1][1].replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
      }
      if (!rewardText && avgReward) {
        rewardText = avgReward;
      }

      let costText = '';
      if (cells.length >= 3) {
        costText = cells[2][1].replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
      }

      const sig = items.map(it => it.name + ':' + it.amount).sort().join(';');

      let rewardType = 'coins';
      let rewardIcon = 'coins.png';
      if (category === 'FLOWER') {
        rewardType = 'flower';
        rewardIcon = 'Flower.png';
      } else if (category === 'TICKETS') {
        rewardType = 'tickets';
        rewardIcon = 'ticket.png';
      }

      if (items.length > 0) {
        deliveries.push({
          id: rawName.toLowerCase().replace(/[^a-z0-9]/g, '') + '_' + rIdx,
          signature: sig,
          items,
          reward: rewardText,
          rewardType,
          rewardIcon,
          cost: costText ? costText + (costText.includes('Flower') ? '' : ' Flower') : ''
        });
      }
    });

    const npcKey = rawName.toUpperCase();
    const displayName = rawName.charAt(0).toUpperCase() + rawName.slice(1).toLowerCase();

    result[npcKey] = {
      id: rawName.toLowerCase().replace(/[^a-z0-9]/g, ''),
      name: npcKey,
      displayName,
      icon: npcIcon,
      category,
      avgReward,
      avgCost: avgCost ? avgCost + ' Flower' : '',
      deliveriesCount: deliveries.length,
      deliveries
    };
  }
}

console.log('Processed', Object.keys(result).length, 'NPCs:');
for (const [k, v] of Object.entries(result)) {
  console.log(`${v.category.padEnd(8)} ${k.padEnd(16)}: ${v.deliveriesCount} deliveries | icon: ${v.icon} | avgReward: ${v.avgReward}`);
}

// Write to backend data
const backendDataDir = path.resolve(__dirname, '../backend/data');
if (!fs.existsSync(backendDataDir)) fs.mkdirSync(backendDataDir, { recursive: true });
fs.writeFileSync(path.join(backendDataDir, 'npcDeliveries.json'), JSON.stringify(result, null, 2), 'utf8');

// Write to frontend data
const frontendDataDir = path.resolve(__dirname, '../frontend/src/data');
if (!fs.existsSync(frontendDataDir)) fs.mkdirSync(frontendDataDir, { recursive: true });
fs.writeFileSync(path.join(frontendDataDir, 'npcDeliveries.json'), JSON.stringify(result, null, 2), 'utf8');

console.log('Saved npcDeliveries.json successfully to backend and frontend!');
