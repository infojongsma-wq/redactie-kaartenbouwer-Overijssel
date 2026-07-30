const { chromium } = require('playwright');
const fs=require('fs');
const UIT=(process.env.KB_UIT||'/tmp/kb-testbeelden/')
if(!fs.existsSync(UIT))fs.mkdirSync(UIT,{recursive:true});
const bestand='/home/user/redactie-kaartenbouwer-Overijssel/dist/kaartenbouwer-overijssel.html';
async function schiet(page,naam){const b64=await page.evaluate(()=>document.getElementById('doek').toDataURL('image/png').split(',')[1]);fs.writeFileSync(UIT+naam,Buffer.from(b64,'base64'));}
// hoogte van de provincie in doekpixels: tel rijen met gemeentevulling
async function provinciehoogte(page){
  return page.evaluate(()=>{
    const d=document.getElementById('doek'), g=d.getContext('2d');
    const r=g.getImageData(0,0,d.width,d.height).data;
    let boven=-1, onder=-1;
    for(let y=0;y<d.height;y++){
      let raak=false;
      for(let x=0;x<d.width;x+=4){
        const i=(y*d.width+x)*4;
        if(r[i]===143&&r[i+1]===184&&r[i+2]===255){raak=true;break;}
      }
      if(raak){ if(boven<0)boven=y; onder=y; }
    }
    return onder-boven;
  });
}
(async()=>{
  const browser=await chromium.launch();
  const page=await browser.newPage({viewport:{width:1600,height:950}});
  const fouten=[];
  page.on('console',m=>{if(m.type()==='error')fouten.push('CONSOLE: '+m.text());});
  page.on('pageerror',e=>fouten.push('PAGEERROR: '+e.message+'\n'+(e.stack||'').split('\n').slice(0,5).join('\n')));
  await page.goto('file://'+bestand); await page.waitForTimeout(700);

  // --- A. beeldvullend: hoe groot is de provincie? ----------------------
  await page.selectOption('#in-weergave','beeldvullend');
  await page.waitForTimeout(500);
  console.log('beeldvullend, geen titel   : hoogte', await provinciehoogte(page), 'px  (was 972)');

  await page.fill('#in-titel','Zonnepanelen op daken groeit hard in Twente');
  await page.fill('#in-ondertitel','Nieuwe installaties per gemeente, eerste helft 2026');
  await page.waitForTimeout(500);
  console.log('beeldvullend, met titel    : hoogte', await provinciehoogte(page), 'px');
  await schiet(page,'b4-01-vol-titel.png');

  // met legenda ernaast
  await page.click('.paneel[data-paneel="puntlaag"] .paneel-kop');
  await page.check('#in-punt-actief');
  await page.click('.paneel[data-paneel="puntlaag"] details.invoer > summary');
  await page.fill('#in-punt-plak','Zwolle\t\tGeopend\nEnschede\t\tIn aanbouw\nDeventer\t\tGepland');
  await page.click('#knop-punt-plak');
  await page.click('.paneel[data-paneel="puntlaag"] .paneel-kop');
  await page.waitForTimeout(500);
  console.log('beeldvullend, titel+legenda: hoogte', await provinciehoogte(page), 'px');
  await schiet(page,'b4-02-vol-titel-legenda.png');

  // --- E. legendaplaatsen in het kader ---------------------------------
  await page.selectOption('#in-weergave','kader');
  await page.click('.paneel[data-paneel="legenda"] .paneel-kop');
  console.log('plaatskeuzes:', await page.evaluate(()=>[...document.querySelectorAll('#in-legenda-plaats option')].map(o=>o.textContent).join(' | ')));
  for (const plek of ['rechtsboven','linksonder','links','onder','geen']) {
    await page.selectOption('#in-legenda-plaats', plek);
    await page.waitForTimeout(400);
    await schiet(page,'b4-kader-'+plek+'.png');
  }
  await page.selectOption('#in-legenda-plaats','rechts');
  await page.click('.paneel[data-paneel="legenda"] .paneel-kop');

  // --- B. vlak vullen zonder waarde ------------------------------------
  await page.click('.paneel[data-paneel="vlaklaag"] .paneel-kop');
  await page.check('#in-vlak-actief');
  await page.waitForTimeout(300);
  const kolommen = await page.evaluate(()=>[...document.querySelectorAll('#vlak-tabel th')].map(t=>t.textContent));
  console.log('kolommen vlaktabel:', JSON.stringify(kolommen));
  // eerste gemeente een eigen kleur geven, zonder waarde
  await page.click('#vlak-tabel tr:nth-child(2) .kleurknop');
  await page.waitForTimeout(300);
  const stalen = await page.evaluate(()=>document.querySelectorAll('.kleurpopup .kleurkiezer button').length);
  console.log('kleuren in de popup:', stalen);
  await page.evaluate(()=>{ document.querySelectorAll('.kleurpopup .kleurkiezer button')[4].click(); });
  await page.waitForTimeout(450);
  console.log('kleur zonder waarde gezet:', await page.evaluate(()=>{
    const k=document.querySelector('#vlak-tabel tr:nth-child(2) .kleurknop');
    return k.classList.contains('aan') ? k.style.background : 'NEE';
  }));
  await schiet(page,'b4-03-vlak-zonder-waarde.png');

  // --- D. ankerveld met suggesties -------------------------------------
  await page.evaluate(()=>{ document.querySelectorAll('.kleurpopup').forEach(p=>p.remove()); });
  await page.evaluate(()=>{
    document.querySelectorAll('.paneel').forEach(p=>p.classList.remove('open'));
    document.querySelector('.paneel[data-paneel="tekstlaag"]').classList.add('open');
  });
  await page.waitForTimeout(200);
  await page.check('#in-tekst-actief');
  await page.waitForTimeout(200);
  await page.click('#knop-tekst-nieuw');
  await page.waitForTimeout(300);
  await page.evaluate(()=>{
    const b=[...document.querySelectorAll('#tekstblokken .schakel')].find(l=>l.textContent.includes('Verbindingslijn'));
    b.querySelector('input').click();
  });
  await page.waitForTimeout(300);
  const ankerveld = await page.$('#tekstblokken .zoekhouder input');
  console.log('ankerveld met zoekhouder:', !!ankerveld);
  if (ankerveld) {
    await ankerveld.fill('Ommen');
    await page.waitForTimeout(400);
    const sug = await page.evaluate(()=>[...document.querySelectorAll('#tekstblokken .suggesties button')].map(b=>b.textContent.trim()).slice(0,3));
    console.log('suggesties bij anker:', JSON.stringify(sug));
    if (sug.length) { await page.click('#tekstblokken .suggesties button'); await page.waitForTimeout(400); }
  }
  await schiet(page,'b4-04-anker.png');

  console.log('--- fouten ---'); console.log(fouten.length?fouten.join('\n'):'(geen)');
  await browser.close();
})();
