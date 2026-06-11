fetch('https://raw.githubusercontent.com/sunflower-land/sunflower-land/main/src/features/game/types/crops.ts')
  .then(r => r.text())
  .then(t => { 
    const lines = t.split('\n'); 
    let curName = ''; 
    for (const l of lines) { 
      if (l.includes('name: ')) curName = l.split('"')[1] || ''; 
      if (l.includes('harvestSeconds:')) { 
        try {
            const s = l.replace(/[^0-9* ]/g, '').split('*').map(x=>parseInt(x.trim())).filter(x=>!isNaN(x)).reduce((a,b)=>a*b,1); 
            console.log("'" + curName + "': " + (s * 1000) + ","); 
        } catch(e) {}
      } 
    } 
  });
