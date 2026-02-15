import { readFileSync, writeFileSync } from 'fs';

const f = 'C:/Users/Amir/Desktop/Guardio/guardio-v2/apps/mobile/src/App.tsx';
let text = readFileSync(f, 'utf8');

// CP-1251 byte 0x98 is undefined, so it was left as raw U+0098 control char
// Original: И (U+0418) → UTF-8: D0 98 → CP-1251: Р(D0) + raw 0x98 → Р + U+0098
// Fix: Р + U+0098 → И

// Also check if there are other control chars from undefined CP-1251 slots
// CP-1251 has 0x98 undefined. Let's also check 0x88, 0x90, etc.
// Actually only 0x98 is undefined in CP-1251 (maps to null in standard)

const fixes = [
  ['\u0420\u0098', 'И'],  // Р + raw 0x98 → И (U+0418 = D0 98)
];

let fixCount = 0;
for (const [from, to] of fixes) {
  const count = (text.match(new RegExp(from.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g')) || []).length;
  if (count > 0) {
    text = text.replaceAll(from, to);
    fixCount += count;
    console.log(`Fixed "${to}" (${count}x)`);
  }
}

// Also scan for any remaining C1 control chars (U+0080-U+009F) that shouldn't be there
const controlChars = text.match(/[\u0080-\u009F]/g);
if (controlChars) {
  console.log(`Found ${controlChars.length} C1 control chars remaining`);
  const counts = {};
  for (const c of controlChars) {
    const hex = 'U+' + c.codePointAt(0).toString(16).padStart(4, '0');
    counts[hex] = (counts[hex] || 0) + 1;
  }
  console.log('  Breakdown:', counts);
}

writeFileSync(f, text, 'utf8');
console.log(`Total fixes: ${fixCount}`);

// Verify line 748
const verify = readFileSync(f, 'utf8');
console.log('\nLine 748:', verify.split('\n')[747]?.trim().substring(0, 120));
