const fs = require('fs'); 
const data = JSON.parse(fs.readFileSync('d:/SF/SF.json')); 
const crops = data.visitedFarmState.crops; 
const baseTimes = { 'Carrot': 3600000, 'Cabbage': 7200000, 'Soybean': 10800000 }; 
const now = 1780702746608; 
for (const id in crops) { 
  const c = crops[id].crop; 
  const base = baseTimes[c.name] || 0; 
  const readyAt = c.plantedAt + base - c.boostedTime; 
  const timeLeftMs = readyAt - now; 
  console.log(c.name + ' planted ' + Math.round((now - c.plantedAt)/60000) + 'm ago. Base ' + base/60000 + 'm, boost ' + c.boostedTime/60000 + 'm. Time left: ' + Math.round(timeLeftMs/60000) + 'm'); 
}
