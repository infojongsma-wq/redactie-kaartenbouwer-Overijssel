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

  // punten met groepen -> legenda met kleurvlakken, zoals in het voorbeeld
  await page.click('.paneel[data-paneel="puntlaag"] .paneel-kop');
  await page.check('#in-punt-actief');
  await page.click('.paneel[data-paneel="puntlaag"] details.invoer > summary');
  await page.fill('#in-punt-plak','Zwolle\t\tLorem ipsum\nEnschede\t\tSander\nDeventer\t\tRTV Oost');
  await page.click('#knop-punt-plak');
  await page.click('.paneel[data-paneel="puntlaag"] .paneel-kop');
  await page.waitForTimeout(300);

  await page.fill('#in-titel','Deze titel hoort weg te vallen');
  await page.selectOption('#in-weergave','beeldvullend');
  await page.waitForTimeout(500);

  await schiet(page,'tv13-01-rechts.png');

  await page.click('.paneel[data-paneel="legenda"] .paneel-kop');
  for (const plek of ['rechtsboven','rechtsonder','linksboven','linksonder','geen']) {
    await page.selectOption('#in-legenda-plaats', plek);
    await page.waitForTimeout(350);
    await schiet(page,'tv13-'+plek+'.png');
  }
  await page.selectOption('#in-legenda-plaats','rechts');
  await page.fill('#in-legenda-titel','Waar het gebeurde');
  await page.waitForTimeout(350);
  await schiet(page,'tv13-02-kop.png');

  // vierkant/staand moeten ook werken met kaal aan
  await page.click('.paneel[data-paneel="legenda"] .paneel-kop');
  await page.click('#formaatkeuze .keuze[data-waarde="1:1"]');
  await page.waitForTimeout(400); await schiet(page,'tv13-03-vierkant.png');
  await page.click('#formaatkeuze .keuze[data-waarde="9:16"]');
  await page.waitForTimeout(400); await schiet(page,'tv13-04-staand.png');
  await page.click('#formaatkeuze .keuze[data-waarde="16:9"]');
  await page.waitForTimeout(300);

  // Nederland kaal met legenda
  await page.click('.paneel[data-paneel="basiskaart"] .paneel-kop');
  await page.click('#kaartsoortkeuze .keuze[data-waarde="nederland"]');
  await page.waitForTimeout(500);
  await schiet(page,'tv13-05-nederland.png');

  // opslaan/openen: tvplaats moet de ronde overleven
  await page.click('.paneel[data-paneel="basiskaart"] .paneel-kop');
  const heen = await page.evaluate(()=>{
    const s = JSON.parse(JSON.stringify(window.__staat || {}));
    return s.legenda ? s.legenda.plaats : '(geen __staat)';
  });
  console.log('legendaplaats in staat:', heen);

  await page.selectOption('#in-weergave','kader');
  await page.waitForTimeout(400);
  await schiet(page,'tv13-06-terug.png');

  console.log('--- fouten ---'); console.log(fouten.length?fouten.join('\n'):'(geen)');
  await browser.close();
})();
