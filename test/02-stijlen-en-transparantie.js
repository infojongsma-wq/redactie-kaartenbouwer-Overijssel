const { chromium } = require('playwright');
const fs=require('fs');
const UIT=(process.env.KB_UIT||'/tmp/kb-testbeelden/')
if(!fs.existsSync(UIT))fs.mkdirSync(UIT,{recursive:true});
const bestand='/home/user/redactie-kaartenbouwer-Overijssel/dist/kaartenbouwer-overijssel.html';
async function schiet(page,naam){const b64=await page.evaluate(()=>document.getElementById('doek').toDataURL('image/png').split(',')[1]);fs.writeFileSync(UIT+naam,Buffer.from(b64,'base64'));}
(async()=>{
  const browser=await chromium.launch();
  const page=await browser.newPage({viewport:{width:1600,height:950}});
  const fouten=[];
  page.on('console',m=>{if(m.type()==='error')fouten.push('CONSOLE: '+m.text());});
  page.on('pageerror',e=>fouten.push('PAGEERROR: '+e.message+'\n'+(e.stack||'').split('\n').slice(0,4).join('\n')));
  await page.goto('file://'+bestand); await page.waitForTimeout(500);

  await page.click('.paneel[data-paneel="basiskaart"] .paneel-kop');
  const stijlen = await page.$$eval('#basiskaart-stijlen .keuze', b=>b.map(x=>x.textContent));
  console.log('stijlen:', JSON.stringify(stijlen));

  // 1. drie stijlvarianten
  for (let i=0;i<3;i++){
    await page.click(`#basiskaart-stijlen .keuze:nth-child(${i+1})`);
    await page.waitForTimeout(300);
    await schiet(page, `v-stijl-${i+1}.png`);
  }

  // 2+3. plaatsvarianten
  for (const [w,naam] of [['steden','steden'],['hoofd','hoofd11'],['groot','vanaf10k'],['middel','vanaf5k'],['klein','vanaf2.5k']]) {
    await page.selectOption('#in-basisplaatsen', w);
    await page.waitForTimeout(350);
    await schiet(page, `v-plaats-${naam}.png`);
    const n = await page.evaluate(w2 => {
      const f = window.__basis || null; return null;
    });
  }

  // 5. uitlijning
  await page.selectOption('#in-basisplaatsen','hoofd');
  await page.fill('#in-titel','Uitlijning rechts');
  await page.selectOption('#in-uitlijning','rechts');
  await page.waitForTimeout(350); await schiet(page,'v-uitlijn-rechts.png');
  await page.fill('#in-titel','Uitlijning links');
  await page.selectOption('#in-uitlijning','links');
  await page.waitForTimeout(350); await schiet(page,'v-uitlijn-links.png');
  await page.selectOption('#in-uitlijning','midden');

  // 6. transparant
  await page.fill('#in-titel','');
  await page.selectOption('#in-achtergrond','transparant');
  await page.click('.paneel[data-paneel="basiskaart"] .paneel-kop');
  await page.click('.paneel[data-paneel="basiskaart"] .paneel-kop');
  await page.uncheck('#basiskaart-lagen input[data-laag="water"]');
  await page.uncheck('#basiskaart-lagen input[data-laag="context"]');
  await page.waitForTimeout(400);
  await schiet(page,'v-transparant.png');
  // alfa controleren in de hoek
  const alfa = await page.evaluate(()=>{
    const c=document.getElementById('doek'); const k=c.getContext('2d');
    const d=k.getImageData(5,5,1,1).data; return {r:d[0],g:d[1],b:d[2],a:d[3]};
  });
  console.log('hoekpixel bij transparant:', JSON.stringify(alfa));

  // 7. lijndikte 0
  await page.selectOption('#in-achtergrond','wit');
  await page.check('#basiskaart-lagen input[data-laag="water"]');
  await page.check('#basiskaart-lagen input[data-laag="context"]');
  await page.evaluate(()=>{ const r=document.getElementById('in-grensdikte'); r.value='0'; r.dispatchEvent(new Event('input',{bubbles:true})); });
  await page.waitForTimeout(350);
  console.log('diktemelding:', (await page.textContent('#dikte-melding')).trim());
  await schiet(page,'v-grens-uit.png');

  console.log('--- fouten ---'); console.log(fouten.length?fouten.join('\n'):'(geen)');
  await browser.close();
})();
