const fs = require('fs');
const content = fs.readFileSync('d:/SF/consumables.ts', 'utf8');
const lines = content.split('\n');

let recipes = {};
let current = null;
let capture = false;

for (let i = 0; i < lines.length; i++) {
  const line = lines[i];
  const nameMatch = line.match(/^\s+"([^"]+)":\s*\{/);
  if (nameMatch) {
    current = { name: nameMatch[1], ingredients: {} };
  }
  
  if (current && line.includes('ingredients: {')) {
    capture = true;
    continue;
  }
  
  if (capture && current) {
    if (line.includes('}')) {
      capture = false;
    } else {
      const parts = line.split(':');
      if (parts.length === 2) {
        let ingName = parts[0].replace(/"/g, '').trim();
        let qtyStr = parts[1].split(',')[0].replace(/new Decimal\(([^)]+)\)/, '$1').trim();
        let qty = Number(qtyStr.replace(/"/g, '').replace(/'/g, ''));
        if (!isNaN(qty)) current.ingredients[ingName] = qty;
      }
    }
  }
  
  if (current && line.includes('building: "Fire Pit"')) {
    recipes[current.name] = current.ingredients;
  }
}
console.log(JSON.stringify(recipes, null, 2));
