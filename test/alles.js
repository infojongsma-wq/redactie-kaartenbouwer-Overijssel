/* Draait alle testscripts achter elkaar en vat samen wat eruit komt.
   Een script dat een console- of paginafout meldt, of dat zelf omvalt, telt
   als mislukt; de rest is leeswerk. */
const { execFileSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const map = __dirname;
const scripts = fs.readdirSync(map)
  .filter(f => /^\d\d-.*\.js$/.test(f))
  .sort();

if (!fs.existsSync(path.join(map, '..', 'dist', 'kaartenbouwer-overijssel.html'))) {
  console.error('dist/kaartenbouwer-overijssel.html ontbreekt — draai eerst: python3 build/build_app.py');
  process.exit(1);
}

let mislukt = 0;
for (const s of scripts) {
  console.log('\n=== ' + s + ' ' + '='.repeat(Math.max(0, 60 - s.length)));
  try {
    const uit = execFileSync('node', [path.join(map, s)], { encoding: 'utf8', timeout: 180000 });
    process.stdout.write(uit);
    if (!/--- fouten ---\s*\(geen\)/.test(uit)) { console.log('>>> MELDT FOUTEN'); mislukt++; }
  } catch (e) {
    process.stdout.write(String(e.stdout || ''));
    console.log('>>> OMGEVALLEN: ' + String(e.message).split('\n')[0]);
    mislukt++;
  }
}

console.log('\n' + '='.repeat(64));
console.log(mislukt ? mislukt + ' van de ' + scripts.length + ' scripts meldt iets' : 'alle ' + scripts.length + ' scripts schoon');
process.exit(mislukt ? 1 : 0);
