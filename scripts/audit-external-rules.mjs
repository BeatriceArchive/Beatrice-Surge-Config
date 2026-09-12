import crypto from 'node:crypto';
import fs from 'node:fs';

const config = fs.readFileSync(new URL('../Beatrice-Surge.conf', import.meta.url), 'utf8');
const externalResources = [...config.matchAll(/^(RULE-SET|DOMAIN-SET),(https:\/\/[^,]+)/gm)].map(match => ({ kind: match[1], url: match[2] }));
const urls = [...new Set(externalResources.map(resource => resource.url))];
const resourceKinds = new Map(externalResources.map(resource => [resource.url, resource.kind]));
const failures = [];
const downloadedRules = new Map();

const expectations = new Map([
  ['non_ip/apple_intelligence.conf', { min: 4, max: 100, contains: ['DOMAIN,apple-relay.apple.com', 'DOMAIN,gspe1-ssl.ls.apple.com'] }],
  ['non_ip/ai.conf', { min: 20, max: 1_000, contains: ['DOMAIN-SUFFIX,chatgpt.com', 'DOMAIN-SUFFIX,claude.ai', 'DOMAIN,api.github.com'] }],
  ['non_ip/apple_cn.conf', { min: 5, max: 200, contains: ['DOMAIN-SUFFIX,cn.apple.com'] }],
  ['non_ip/apple_services.conf', { min: 10, max: 500, contains: ['DOMAIN-SUFFIX,apple.com'] }],
  ['domainset/apple_cdn.conf', { kind: 'DOMAIN-SET', min: 100, max: 500, contains: ['.s.mzstatic.com', '.apps.mzstatic.com', '.is1-ssl.mzstatic.com'] }],
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

function csv(value, context) {
  const tokens = [];
  let token = '';
  let quote = null;
  let escaped = false;
  for (const char of value) {
    if (escaped) {
      if (char !== quote && char !== '\\') throw new Error(`${context}: unsupported escape \\${char}`);
      token += char;
      escaped = false;
    } else if (quote && char === '\\') escaped = true;
    else if (char === '"' || char === "'") {
      if (quote === char) quote = null;
      else if (!quote) quote = char;
      else token += char;
    } else if (char === ',' && !quote) { tokens.push(token.trim()); token = ''; }
    else token += char;
  }
  if (quote) throw new Error(`${context}: unterminated quoted value`);
  if (escaped) throw new Error(`${context}: dangling escape in quoted value`);
  tokens.push(token.trim());
  if (tokens.some(value => !value)) throw new Error(`${context}: empty comma-separated component`);
  return tokens;
}

function parseExternalRule(line, key) {
  const fields = csv(line, `${key}: ${line}`);
  const type = fields[0].toUpperCase();
  if (!allowedTypes.has(type)) throw new Error(`${key}: unsupported rule type in ${line}`);
  if (fields.length < 2) throw new Error(`${key}: missing match value in ${line}`);
  for (const parameter of fields.slice(2)) {
    if (!['no-resolve', 'extended-matching'].includes(parameter.toLowerCase())) throw new Error(`${key}: unsupported rule parameter ${parameter} in ${line}`);
  }
  return { type, value: fields[1], fields };
}

function parseDomainEntry(line, key) {
  if (line.includes(',')) throw new Error(`${key}: DOMAIN-SET entry must not contain commas: ${line}`);
  const suffix = line.startsWith('.');
  const value = suffix ? line.slice(1) : line;
  if (!value || !/^[A-Za-z0-9_.-]+$/.test(value) || value.startsWith('.') || value.endsWith('.')) throw new Error(`${key}: malformed DOMAIN-SET entry ${line}`);
  return { type: suffix ? 'DOMAIN-SUFFIX' : 'DOMAIN', value };
}

for (const url of urls) {
  const key = new URL(url).pathname.replace(/^\/List\//, '');
  const expected = expectations.get(key);
  if (!expected) {
    failures.push(`${url}: no explicit drift contract`);
    continue;
  }
  const expectedKind = expected.kind || 'RULE-SET';
  if (resourceKinds.get(url) !== expectedKind) failures.push(`${key}: expected ${expectedKind}, profile uses ${resourceKinds.get(url)}`);
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
    const parsed = [];
    for (const line of lines) {
      try { parsed.push(expectedKind === 'DOMAIN-SET' ? parseDomainEntry(line, key) : parseExternalRule(line, key)); }
      catch (error) { failures.push(error.message); }
      if (expectedKind === 'RULE-SET' && /(?:^|,)pre-matching(?:,|$)/.test(line)) failures.push(`${key}: forbidden rule-set entry ${line}`);
    }
    downloadedRules.set(url, parsed);
    for (const contract of expected.contains || []) if (!lines.includes(contract)) failures.push(`${key}: missing critical contract ${contract}`);
    const nonSentinel = lines.filter(line => line !== 'DOMAIN,7h15.ru1353t.1s.m4d3.by.5ukk4w.skk.moe');
    if (expected.family === 'ip' && nonSentinel.some(line => !/^(IP-CIDR6?|IP-ASN),/.test(line))) failures.push(`${key}: expected an IP-only rule family`);
  } catch (error) {
    failures.push(`${key}: fetch or parse failed: ${error.message}`);
  }
}

if (urls.length !== expectations.size) failures.push(`profile exposes ${urls.length} external RULE-SET URLs but ${expectations.size} contracts are defined`);

const normalizeHost = host => host.toLowerCase().replace(/\.$/, '');
function domainMatches(type, value, host) {
  const normalized = normalizeHost(host);
  const target = normalizeHost(value);
  if (type === 'DOMAIN') return normalized === target;
  if (type === 'DOMAIN-SUFFIX') return normalized === target || normalized.endsWith(`.${target}`);
  if (type === 'DOMAIN-KEYWORD') return normalized.includes(target);
  if (type === 'DOMAIN-WILDCARD') {
    const pattern = target.replace(/[.+^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*').replace(/\?/g, '.');
    return new RegExp(`^${pattern}$`, 'i').test(normalized);
  }
  if (type === 'URL-REGEX') {
    try {
      const regex = value.startsWith('(?i)') ? new RegExp(value.slice(4), 'i') : new RegExp(value);
      return regex.test(`https://${normalized}/`) || regex.test(`http://${normalized}/`);
    } catch (error) {
      failures.push(`invalid URL-REGEX ${JSON.stringify(value)}: ${error.message}`);
      return false;
    }
  }
  return false;
}

const localRuleLines = activeLines(config.slice(config.indexOf('[Rule]') + '[Rule]'.length));
const localRules = [];
for (const line of localRuleLines) {
  try {
    const fields = csv(line, `local rule ${line}`);
    const type = fields[0].toUpperCase();
    localRules.push({ type, value: fields[1], policy: type === 'FINAL' ? fields[1] : fields[2] });
  } catch (error) { failures.push(error.message); }
}
const systemHosts = new Set(['ls.apple.com']);
function routeHost(host) {
  for (const rule of localRules) {
    if (domainMatches(rule.type, rule.value, host)) return rule.policy;
    if (rule.type === 'RULE-SET' && rule.value === 'SYSTEM' && [...systemHosts].some(value => domainMatches('DOMAIN-SUFFIX', value, host))) return rule.policy;
    if (['RULE-SET', 'DOMAIN-SET'].includes(rule.type) && downloadedRules.get(rule.value)?.some(entry => domainMatches(entry.type, entry.value, host))) return rule.policy;
    if (rule.type === 'FINAL') return rule.policy;
  }
  return null;
}

const liveRouteMatrix = new Map([
  ['chatgpt.com', '🤖 AI'], ['claude.ai', '🤖 AI'], ['gemini.google', '🤖 AI'],
  ['api.github.com', '🚀 手动选择'], ['apple-relay.apple.com', '🤖 AI'], ['gspe1-ssl.ls.apple.com', '🤖 AI'],
  ['ls.apple.com', 'DIRECT'], ['cn.apple.com', 'DIRECT'], ['gateway.icloud.com.cn', 'DIRECT'],
  ['music.apple.com', '🍎 Apple'], ['sandbox.itunes.apple.com', '🍎 Apple'],
  ['icloud.com', '🍎 Apple'], ['appstore.com', '🍎 Apple'],
  ['apps.mzstatic.com', '🍎 Apple'], ['s.mzstatic.com', '🍎 Apple'], ['is1-ssl.mzstatic.com', '🍎 Apple'],
  ['afs.ampaeservices.com', '🍎 Apple'],
  ['youtube.com', '🌍 流媒体'], ['netflix.com', '🌍 流媒体'], ['disneyplus.com', '🌍 流媒体'],
  ['spotify.com', '🌍 流媒体'], ['tiktok.com', '🌍 流媒体'], ['primevideo.com', '🌍 流媒体'],
  ['bilibili.com', '🚀 手动选择'], ['b23.tv', '🚀 手动选择'],
  ['baidu.com', 'DIRECT'], ['representative.cn', 'DIRECT'], ['unrelated-foreign.example', '🚀 手动选择']
]);
for (const [host, expected] of liveRouteMatrix) {
  const actual = routeHost(host);
  if (actual !== expected) failures.push(`live first-match routing collision: ${host} -> ${actual}, expected ${expected}`);
}
if (failures.length) {
  console.error(`External RULE-SET drift audit FAILED (${failures.length} issues):`);
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}
console.log(`External rule resource drift audit PASS (${urls.length} resources)`);
console.log(`Live upstream first-match routes PASS (${liveRouteMatrix.size} hosts)`);
