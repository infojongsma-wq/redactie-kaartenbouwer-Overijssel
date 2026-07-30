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
  await page.goto('file://'+bestand); await page.waitForTimeout(600);
  await page.click('.paneel[data-paneel="basiskaart"] .paneel-kop');
  await page.click('#kaartsoortkeuze .keuze[data-waarde="nederland"]');
  await page.waitForTimeout(400);
  const stijlen = await page.$$eval('#basiskaart-stijlen .keuze', b=>b.map(x=>x.textContent));
  console.log('NL-stijlen:', JSON.stringify(stijlen));
  console.log('actief    :', await page.$$eval('#basiskaart-stijlen .keuze.aan', b=>b.map(x=>x.textContent)));
  await page.click('#formaatkeuze .keuze[data-waarde="1:1"]');
  for (let i=0;i<4;i++){
    await page.click(`#basiskaart-stijlen .keuze:nth-child(${i+1})`);
    await page.waitForTimeout(350);
    await schiet(page, `nlv-${i+1}.png`);
  }
  // terug naar Overijssel: stijlrij moet weer 3 knoppen tonen
  await page.click('#kaartsoortkeuze .keuze[data-waarde="overijssel"]');
  await page.waitForTimeout(400);
  console.log('OV-stijlen:', await page.$$eval('#basiskaart-stijlen .keuze', b=>b.map(x=>x.textContent)));
  console.log('--- fouten ---'); console.log(fouten.length?fouten.join('\n'):'(geen)');
  await browser.close();
})();
