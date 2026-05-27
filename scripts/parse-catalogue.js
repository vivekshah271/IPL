const fs = require('fs');
const path = require('path');
const pdf = require('pdf-parse');

const ROLES = ['BATTER', 'BOWLER', 'ALL-ROUNDER', 'WICKETKEEPER'];
const COUNTRIES = [
  'India', 'England', 'Australia', 'South Africa', 'New Zealand', 'West Indies',
  'Sri Lanka', 'Bangladesh', 'Afghanistan', 'Pakistan', 'Zimbabwe', 'Ireland',
  'Scotland', 'USA', 'Nepal', 'Netherlands', 'UAE', 'Oman'
];
const TEAM_CODES = ['CSK', 'MI', 'RCB', 'RR', 'KKR', 'SRH', 'GT', 'LSG', 'DC', 'PBKS'];

function parseBasePrice(text) {
  const t = text.replace(/\s+/g, ' ').trim();
  const crMatch = t.match(/([\d.]+)\s*Cr/i);
  if (crMatch) return parseFloat(crMatch[1]);
  const lMatch = t.match(/([\d.]+)\s*L/i);
  if (lMatch) return parseFloat(lMatch[1]) / 100;
  return 0;
}

function extractSetNumber(sectionContext) {
  const m = sectionContext.match(/Set\s*(\d+)/i);
  return m ? parseInt(m[1], 10) : null;
}

function parseMarqueeLine(line) {
  const retained = line.match(/^(.+?)\s+Marquee\s+Retained(?:\s+(\w+))?\s+Yes\s+(.+)$/i);
  if (!retained) {
    const alt = line.match(/^(.+?)\s+Marquee\s+Retained\s+Yes\s+(.+)$/i);
    if (!alt) return null;
    return buildMarqueePlayer(alt[1], null, alt[2]);
  }
  const team = retained[2] && TEAM_CODES.includes(retained[2]) ? retained[2] : null;
  return buildMarqueePlayer(retained[1], team, retained[3]);
}

function buildMarqueePlayer(name, team, priceText) {
  return {
    name: name.trim(),
    country: '',
    role: 'MARQUEE',
    set: 'Marquee',
    setNumber: 0,
    category: 'Marquee',
    capped: true,
    retained: true,
    basePrice: parseBasePrice(priceText),
    soldStatus: 'sold',
    soldTeam: team,
    finalPrice: parseBasePrice(priceText)
  };
}

function parsePlayerLine(line, sectionContext) {
  const roleIdx = ROLES.findIndex((r) => line.includes(` ${r} `));
  if (roleIdx === -1) return null;

  const role = ROLES[roleIdx];
  const beforeRole = line.slice(0, line.indexOf(` ${role} `)).trim();
  const afterRole = line.slice(line.indexOf(` ${role} `) + role.length + 2).trim();

  let country = 'India';
  let name = beforeRole;
  for (const c of COUNTRIES.sort((a, b) => b.length - a.length)) {
    if (beforeRole.endsWith(` ${c}`)) {
      country = c;
      name = beforeRole.slice(0, -(c.length + 1)).trim();
      break;
    }
  }

  const priceMatch = afterRole.match(/(Yes|No)\s+([\d.]+\s*(?:Cr|L)(?:\s*Cr)?|\d+\s*L|2\.0Cr)/i);
  if (!priceMatch) return null;

  const retained = priceMatch[1] === 'Yes';
  const basePrice = parseBasePrice(priceMatch[2]);

  const mid = afterRole.slice(0, afterRole.indexOf(priceMatch[0])).trim();
  const parts = mid.split(/\s+/);
  const setCode = parts[0] || '';
  const capPart = parts.find((p) => /^(Capped|Uncapped|Associate)$/i.test(p)) || 'Capped';
  const capped = capPart.toLowerCase() === 'capped';

  const setNum = extractSetNumber(sectionContext) ?? extractSetNumber(setCode) ?? null;

  return {
    name,
    country,
    role,
    set: setCode,
    setNumber: setNum,
    category: setCode,
    capped,
    retained,
    basePrice,
    soldStatus: retained ? 'sold' : 'pending',
    soldTeam: null,
    finalPrice: retained ? basePrice : null
  };
}

function shouldSkipLine(line) {
  if (!line || line.length < 4) return true;
  if (/^--\s*\d+\s+of\s+\d+\s*--$/i.test(line)) return true;
  if (/^Player Country Role/i.test(line)) return true;
  if (/^■\s*MARQUEE/i.test(line)) return true;
  if (/^IPL AUCTION CATALOGUE/i.test(line)) return true;
  if (/^(Batsman|Bowler|All Rounder|WK)\s+Set\s+\d+$/i.test(line)) return true;
  if (/^(Batsman|Bowler|All Rounder|WK)\s+Set\s+\d+\s*$/i.test(line)) return true;
  return false;
}

function normalizeLines(rawLines) {
  const merged = [];
  for (let i = 0; i < rawLines.length; i++) {
    let line = rawLines[i];
    if (/^Marquee\s+Retained/i.test(line) && merged.length > 0) {
      const prev = merged.pop();
      merged.push(`${prev} ${line.replace(/\s+/g, ' ').trim()}`);
      continue;
    }
    if (
      merged.length > 0 &&
      !/Marquee|Player Country|^(Batsman|Bowler|All Rounder|WK)\s+Set/i.test(line) &&
      !ROLES.some((r) => line.includes(` ${r} `)) &&
      i + 1 < rawLines.length &&
      /^Marquee\s+Retained/i.test(rawLines[i + 1])
    ) {
      const next = rawLines[++i].replace(/\s+/g, ' ').trim();
      merged.push(`${line} ${next}`);
      continue;
    }
    merged.push(line);
  }
  return merged;
}

async function main() {
  const pdfPath = path.join(__dirname, '..', 'catalogue.pdf');
  const buffer = fs.readFileSync(pdfPath);
  const data = await pdf(buffer);
  const lines = normalizeLines(
    data.text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean)
  );

  const players = [];
  let sectionContext = 'Marquee Set';
  const seen = new Set();

  for (const line of lines) {
    if (/Set\s+\d+/i.test(line) && !line.includes('Player Country')) {
      sectionContext = line;
      continue;
    }
    if (shouldSkipLine(line)) continue;

    let player = parseMarqueeLine(line);
    if (!player) player = parsePlayerLine(line, sectionContext);
    if (!player) continue;

    const key = `${player.name}|${player.role}|${player.set}`;
    if (seen.has(key)) continue;
    seen.add(key);

    player.id = `p-${players.length + 1}`;
    players.push(player);
  }

  const outPath = path.join(__dirname, '..', 'data', 'players.json');
  fs.writeFileSync(outPath, JSON.stringify(players, null, 2));
  console.log(`Parsed ${players.length} players → ${outPath}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
