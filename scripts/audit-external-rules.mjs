import crypto from 'node:crypto';
import fs from 'node:fs';

const config = fs.readFileSync(new URL('../Beatrice-Surge.conf', import.meta.url), 'utf8');
const urls = [...new Set([...config.matchAll(/^RULE-SET,(https:\/\/[^,]+)/gm)].map(match => match[1]))];
const failures = [];

const expectations = new Map([
  ['non_ip/apple_intelligence.conf', { min: 4, max: 100, contains: ['DOMAIN,apple-relay.apple.com', 'DOMAIN,gspe1-ssl.ls.apple.com'] }],
  ['non_ip/ai.conf', { min: 20, max: 1_000, contains: ['DOMAIN-SUFFIX,chatgpt.com', 'DOMAIN-SUFFIX,claude.ai', 'DOMAIN,api.github.com'] }],
  ['non_ip/apple_cn.conf', { min: 5, max: 200, contains: ['DOMAIN-SUFFIX,cn.apple.com'] }],
  ['non_ip/apple_services.conf', { min: 10, max: 500, contains: ['DOMAIN-SUFFIX,apple.com'] }],
  ['non_ip/domestic.conf', { min: 300, max: 20_000, contains: ['DOMAIN,b23.tv', 'DOMAIN-SUFFIX,bilibili.com'] }],
  ['ip/ai.conf', { min: 5, max: 5_000, family: 'ip' }],
  ['ip/china_ip.conf', { min: 1_000, max: 100_000, family: 'ip' }]
]);
const allowedTypes = new Set([
  'DOMAIN', 'DOMAIN-SUFFIX', 'DOMAIN-KEYWORD', 'DOMAIN-WILDCARD', 'URL-REGEX',
  'IP-CIDR', 'IP-CIDR6', 'IP-ASN', 'GEOIP', 'DEST-PORT', 'PROTOCOL',
  'PROCESS-NAME', 'USER-AGENT'
]);

function activeLines(body) {
  return body.split(/\r?\n/).map(line => line.trim()).filter(line => line && !line.startsWith('#') && !line.startsWith(';') && !line.startsWith('//'));
}

for (const url of urls) {
  const key = new URL(url).pathname.replace(/^\/List\//, '');
  const expected = expectations.get(key);
  if (!expected) {
    failures.push(`${url}: no explicit drift contract`);
    continue;
  }
  try {
    const response = await fetch(url, {
      headers: { 'user-agent': 'Beatrice-Surge-Config drift audit' },
      signal: AbortSignal.timeout(20_000)
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const body = await response.text();
    const lines = activeLines(body);
    const hash = crypto.createHash('sha256').update(lines.join('\n')).digest('hex');
    console.log(`${key}: ${lines.length} rules, sha256=${hash}`);
    if (lines.length < expected.min || lines.length > expected.max) failures.push(`${key}: abnormal size ${lines.length}, expected ${expected.min}..${expected.max}`);
    for (const line of lines) {
      const type = line.split(',', 1)[0].toUpperCase();
      if (!allowedTypes.has(type)) failures.push(`${key}: unsupported or malformed rule type in ${line}`);
      if (type === 'FINAL' || /(?:^|,)pre-matching(?:,|$)/.test(line)) failures.push(`${key}: forbidden rule-set entry ${line}`);
    }
    for (const contract of expected.contains || []) if (!lines.includes(contract)) failures.push(`${key}: missing critical contract ${contract}`);
    const nonSentinel = lines.filter(line => line !== 'DOMAIN,7h15.ru1353t.1s.m4d3.by.5ukk4w.skk.moe');
    if (expected.family === 'ip' && nonSentinel.some(line => !/^(IP-CIDR6?|IP-ASN),/.test(line))) failures.push(`${key}: expected an IP-only rule family`);
  } catch (error) {
    failures.push(`${key}: fetch or parse failed: ${error.message}`);
  }
}

if (urls.length !== expectations.size) failures.push(`profile exposes ${urls.length} external RULE-SET URLs but ${expectations.size} contracts are defined`);
if (failures.length) {
  console.error(`External RULE-SET drift audit FAILED (${failures.length} issues):`);
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}
console.log(`External RULE-SET drift audit PASS (${urls.length} resources)`);
