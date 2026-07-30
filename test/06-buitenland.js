const { chromium } = require('playwright');
const fs=require('fs');
const UIT=(process.env.KB_UIT||'/tmp/kb-testbeelden/')
if(!fs.existsSync(UIT))fs.mkdirSync(UIT,{recursive:true});
const bestand='/home/user/redactie-kaartenbouwer-Overijssel/dist/kaartenbouwer-overijssel.html';
async function schiet(page,naam){const b64=await page.evaluate(()=>document.getElementById('doek').toDataURL('image/png').split(',')[1]);fs.writeFileSync(UIT+naam,Buffer.from(b64,'base64'));}
// kleur op een plek net oostelijk van Twente, in doekcoordinaten
async function kleur(page,x,y){
  return page.evaluate(([x,y])=>{
    const d=document.getElementById('doek');
    const c=d.getContext('2d').getImageData(Math.round(x),Math.round(y),1,1).data;
    return '#'+[c[0],c[1],c[2]].map(v=>v.toString(16).padStart(2,'0')).join('').toUpperCase()+' a'+c[3];
  },[x,y]);
}
(async()=>{
  const browser=await chromium.launch();
  const page=await browser.newPage({viewport:{width:1600,height:950}});
  const fouten=[];
  page.on('console',m=>{if(m.type()==='error')fouten.push('CONSOLE: '+m.text());});
  page.on('pageerror',e=>fouten.push('PAGEERROR: '+e.message+'\n'+(e.stack||'').split('\n').slice(0,4).join('\n')));
  await page.goto('file://'+bestand); await page.waitForTimeout(600);

  await page.selectOption('#in-weergave','beeldvullend');           // beeldvullend, dan ligt Duitsland ruim in beeld
  await page.waitForTimeout(500);
  const P = [1780, 260];               // ruim in Duitsland, noordoostelijk van Twente
  console.log('buitenland aan          :', await kleur(page,...P));
  await schiet(page,'bl-01-aan.png');

  await page.click('.paneel[data-paneel="basiskaart"] .paneel-kop');
  await page.uncheck('input[data-laag="context"]');
  await page.waitForTimeout(400);
  console.log('context uit             :', await kleur(page,...P));
  await schiet(page,'bl-02-context-uit.png');
  await page.check('input[data-laag="context"]');

  await page.uncheck('input[data-laag="water"]');
  await page.waitForTimeout(400);
  console.log('water uit, context aan  :', await kleur(page,...P));
  await schiet(page,'bl-03-water-uit.png');
  await page.check('input[data-laag="water"]');

  await page.click('#kaartsoortkeuze .keuze[data-waarde="nederland"]');
  await page.waitForTimeout(500);
  console.log('Nederlandkaart          :', await kleur(page,...P));
  await schiet(page,'bl-04-nederland.png');
  await page.click('#kaartsoortkeuze .keuze[data-waarde="overijssel"]');
  await page.waitForTimeout(400);

  // geen waterstreepje tussen gemeente en Duitsland: scan dwars over de grens
  const scan = await page.evaluate(()=>{
    const d=document.getElementById('doek');
    const g=d.getContext('2d');
    const treffers={};
    for (const y of [380,520,700,860]) {
      const r=g.getImageData(1000,y,700,1).data;
      for (let i=0;i<700;i++){
        const h='#'+[r[i*4],r[i*4+1],r[i*4+2]].map(v=>v.toString(16).padStart(2,'0')).join('').toUpperCase();
        treffers[h]=(treffers[h]||0)+1;
      }
    }
    return treffers;
  });
  const water = scan['#1361FF']||0;
  console.log('waterpixels op de scanlijnen door de oostgrens:', water);
  console.log('gevonden kleuren:', Object.entries(scan).sort((a,b)=>b[1]-a[1]).slice(0,6).map(([k,v])=>k+':'+v).join(' '));

  console.log('--- fouten ---'); console.log(fouten.length?fouten.join('\n'):'(geen)');
  await browser.close();
})();
