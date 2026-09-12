import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const validatorPath = fileURLToPath(import.meta.url);
const configPath = process.env.SURGE_CONFIG_PATH || fileURLToPath(new URL('../Beatrice-Surge.conf', import.meta.url));
const text = fs.readFileSync(configPath, 'utf8').replace(/\r\n?/g, '\n');
const errors = [];
const fail = message => errors.push(message);

const REQUIRED_GENERAL = new Map([
  ['dns-server', 'system'], ['use-local-host-item-for-proxy', 'false'], ['compatibility-mode', '3'],
  ['proxy-test-url', 'http://www.gstatic.com/generate_204'], ['test-timeout', '5'],
  ['ipv6', 'false'], ['ipv6-vif', 'disabled'], ['wifi-assist', 'false'], ['all-hybrid', 'false'],
  ['udp-priority', 'true'], ['udp-policy-not-supported-behaviour', 'reject'], ['allow-wifi-access', 'false'],
  ['allow-hotspot-access', 'false'], ['proxy-restricted-to-lan', 'true'], ['include-all-networks', 'true'],
  ['include-local-networks', 'false'], ['include-apns', 'false'], ['include-cellular-services', 'false'],
  ['exclude-simple-hostnames', 'true'], ['icmp-forwarding', 'false'], ['loglevel', 'notify']
]);
const MANUAL = '🚀 手动选择';
const SERVICES = ['🤖 AI', '🌍 流媒体'];
const REMOVED_GROUPS = ['📺 哔哩哔哩', '🍎 苹果服务', '🌐 兜底策略', '🚀 手动切换', '🤖 AI服务', '🌍 国外流媒体'];
const REGIONS = [
  ['🇭🇰 香港节点', '⚡ 香港自动', '(?i)(🇭🇰|香港|Hong Kong|(^|[- _/|()])港($|[- _/|()0-9])|(^|[^A-Za-z])HK([^A-Za-z]|$))', ['香港 01', 'HK-01', 'HK01', 'Hong Kong', '🇭🇰', 'VIP-港-01', ' hk-01 ', 'HK-01_1', 'HK-01=Premium'], ['VIP-港口中转', 'HKG 01', 'BANKHK']],
  ['🇯🇵 日本节点', '⚡ 日本自动', '(?i)(🇯🇵|日本|Japan|(^|[- _/|()])日($|[- _/|()0-9])|(^|[^A-Za-z])JP([^A-Za-z]|$))', ['日本 01', 'JP-01', 'JP01', 'Japan', '🇯🇵', 'VIP-日-01', 'jp-01', 'JP-01_1', 'JP-01=Premium'], ['VIP-日常节点', 'JPG 01', 'JPN 01']],
  ['🇸🇬 新加坡节点', '⚡ 新加坡自动', '(?i)(🇸🇬|新加坡|狮城|Singapore|(^|[- _/|()])新($|[- _/|()0-9])|(^|[^A-Za-z])SG([^A-Za-z]|$))', ['新加坡 01', 'SG-01', 'SG01', 'Singapore', '🇸🇬', 'VIP-新-01', 'sg-01', 'SG-01_1', 'SG-01=Premium'], ['VIP-新节点', 'SGP 01', 'ASGARD 01']],
  ['🇺🇸 美国节点', '⚡ 美国自动', '(?i)(🇺🇸|美国|美國|United States|America|(^|[- _/|()])美($|[- _/|()0-9])|(^|[^A-Za-z])US([^A-Za-z]|$))', ['美国 01', 'US-01', 'US01', 'America', '🇺🇸', 'VIP-美-01', 'us-01', 'US-01_1', 'US-01=Premium'], ['VIP-美化线路', 'USA 01', 'RUS 01', 'USDT 01']],
  ['🇹🇼 台湾节点', '⚡ 台湾自动', '(?i)(🇹🇼|台湾|台灣|Taiwan|(^|[- _/|()])台($|[- _/|()0-9])|(^|[^A-Za-z])TW([^A-Za-z]|$))', ['台湾 01', 'TW-01', 'TW01', 'Taiwan', '🇹🇼', 'VIP-台-01', 'tw-01', 'TW-01_1', 'TW-01=Premium'], ['VIP-台式出口', 'TWN 01', 'TWITTER 01']],
  ['🇰🇷 韩国节点', '⚡ 韩国自动', '(?i)(🇰🇷|韩国|韓國|(^|[^A-Za-z])((South )?Korea|KR)([^A-Za-z]|$)|(^|[- _/|()])韩($|[- _/|()0-9])|(^|[- _/|()])韓($|[- _/|()0-9]))', ['韩国 01', '韓國 01', 'KR-01', 'KR01', 'Korea', 'South Korea', '🇰🇷', 'VIP-韩-01', 'VIP-韓-01', 'kr-01', 'KR-01_1', 'KR-01=Premium'], ['KRAKEN', 'KRW 01', 'KOREAN text', 'South Korean', 'ICN 01', 'SEL 01', 'SEOUL 01']]
];
const REGIONAL = REGIONS.map(([manual]) => manual);
const REQUIRED_VISIBLE = [MANUAL, ...SERVICES, ...REGIONAL];
const BUILTINS = new Set(['DIRECT', 'REJECT', 'REJECT-DROP', 'REJECT-NO-DROP', 'REJECT-TINYGIF', 'CELLULAR', 'CELLULAR-ONLY', 'HYBRID', 'NO-HYBRID', 'PASS']);
const GROUP_TYPES = new Set(['select', 'url-test', 'fallback', 'load-balance', 'smart', 'subnet', 'ssid']);
const GROUP_PARAMS = new Set([
  'no-alert', 'hidden', 'icon-url', 'underlying-proxy', 'policy-path', 'update-interval',
  'policy-regex-filter', 'external-policy-modifier', 'external-policy-name-prefix',
  'include-all-proxies', 'include-other-group', 'interval', 'timeout', 'evaluate-before-use',
  'tolerance', 'persistent'
]);
const RULE_TYPES = new Set([
  'DOMAIN', 'DOMAIN-SUFFIX', 'DOMAIN-KEYWORD', 'DOMAIN-WILDCARD', 'DOMAIN-SET',
  'IP-CIDR', 'IP-CIDR6', 'GEOIP', 'IP-ASN', 'USER-AGENT', 'URL-REGEX', 'PROCESS-NAME',
  'DEST-PORT', 'SRC-PORT', 'IN-PORT', 'SRC-IP', 'DEVICE-NAME', 'MAC-ADDRESS', 'PROTOCOL',
  'HOSTNAME-TYPE', 'SUBNET', 'CELLULAR-RADIO', 'CELLULAR-CARRIER', 'RULE-SET', 'FINAL'
]);
const RULE_FLAGS = new Set(['no-resolve', 'dns-failed', 'extended-matching', 'pre-matching', 'requires-resolve']);
const RULE_KEY_PARAMS = new Set(['notification-text', 'notification-interval', 'update-interval', 'always-capture']);

function stripComment(line) {
  let quoted = false;
  let escaped = false;
  for (let i = 0; i < line.length; i += 1) {
    const char = line[i];
    if (escaped) { escaped = false; continue; }
    if (quoted && char === '\\') { escaped = true; continue; }
    if (char === '"') { quoted = !quoted; continue; }
    if (!quoted && i > 0 && /\s/.test(line[i - 1]) && (char === '#' || char === ';' || (char === '/' && line[i + 1] === '/'))) return line.slice(0, i).trimEnd();
  }
  if (quoted) throw new Error('unterminated quoted value');
  if (escaped) throw new Error('dangling escape in quoted value');
  return line;
}

function csv(value, context) {
  const tokens = [];
  let token = '';
  let quoted = false;
  let escaped = false;
  for (const char of value) {
    if (escaped) {
      if (char !== '"' && char !== '\\') throw new Error(`${context}: unsupported escape \\${char}`);
      token += char;
      escaped = false;
    } else if (quoted && char === '\\') escaped = true;
    else if (char === '"') quoted = !quoted;
    else if (char === ',' && !quoted) { tokens.push(token.trim()); token = ''; }
    else token += char;
  }
  if (quoted) throw new Error(`${context}: unterminated quoted value`);
  if (escaped) throw new Error(`${context}: dangling escape in quoted value`);
  tokens.push(token.trim());
  if (tokens.some(token => !token)) throw new Error(`${context}: empty comma-separated component`);
  return tokens;
}

function active(lines = []) {
  const output = [];
  for (const raw of lines) {
    const trimmed = raw.trim();
    if (!trimmed || trimmed.startsWith('#') || trimmed.startsWith(';') || trimmed.startsWith('//')) continue;
    try { const line = stripComment(raw).trim(); if (line) output.push(line); }
    catch (error) { fail(`line ${JSON.stringify(raw)}: ${error.message}`); }
  }
  return output;
}

function sections(source) {
  const output = new Map();
  let current = null;
  for (const raw of source.split('\n')) {
    const match = raw.trim().match(/^\[([^\]]+)\]$/);
    if (match) {
      const name = match[1].trim();
      if (!name) fail('empty section name');
      if (output.has(name)) fail(`duplicate section [${name}]`);
      else output.set(name, []);
      current = name;
    } else if (current !== null && output.has(current)) output.get(current).push(raw);
  }
  return output;
}

function assignment(line, context) {
  const i = line.indexOf('=');
  if (i < 1) throw new Error(`${context}: missing key/value separator`);
  const key = line.slice(0, i).trim();
  const value = line.slice(i + 1).trim();
  if (!key) throw new Error(`${context}: empty key`);
  if (!value) throw new Error(`${context}: empty value`);
  return [key, value];
}

function parseGeneral(lines) {
  const output = new Map();
  for (const line of active(lines)) {
    try {
      const [rawKey, value] = assignment(line, '[General]');
      const key = rawKey.toLowerCase();
      if (output.has(key)) fail(`duplicate General key ${rawKey}`);
      else output.set(key, value);
    } catch (error) { fail(error.message); }
  }
  return output;
}

function parseGroups(lines) {
  const output = new Map();
  for (const line of active(lines)) {
    try {
      const [name, value] = assignment(line, '[Proxy Group]');
      if (output.has(name)) { fail(`duplicate group ${name}`); continue; }
      const parts = csv(value, `group ${name}`);
      const type = parts.shift().toLowerCase();
      if (!GROUP_TYPES.has(type)) throw new Error(`group ${name}: unsupported group type ${type}`);
      const members = [];
      const params = new Map();
      for (const component of parts) {
        const i = component.indexOf('=');
        if (i < 0) members.push(component);
        else {
          const key = component.slice(0, i).trim().toLowerCase();
          const parameterValue = component.slice(i + 1).trim();
          if (!key || !parameterValue) throw new Error(`group ${name}: malformed parameter ${component}`);
          if (!GROUP_PARAMS.has(key)) throw new Error(`group ${name}: unsupported parameter ${key}`);
          if (params.has(key)) fail(`group ${name}: duplicate parameter ${key}`);
          else params.set(key, parameterValue);
        }
      }
      output.set(name, { type, members, params });
    } catch (error) { fail(error.message); }
  }
  return output;
}

function surgeRegex(source) {
  if (source.startsWith('(?i)')) return new RegExp(source.slice(4), 'i');
  return new RegExp(source);
}
function imported(group, nodes) {
  if (!group || group.params.get('include-all-proxies') !== 'true') return [];
  const filter = group.params.get('policy-regex-filter');
  return filter ? nodes.filter(node => surgeRegex(filter).test(node)) : [...nodes];
}
function detectCycles(groups) {
  const state = new Map();
  const stack = [];
  const visit = name => {
    if (state.get(name) === 1) { fail(`policy cycle: ${[...stack, name].join(' -> ')}`); return; }
    if (state.get(name) === 2) return;
    state.set(name, 1); stack.push(name);
    for (const member of groups.get(name)?.members || []) if (groups.has(member)) visit(member);
    stack.pop(); state.set(name, 2);
  };
  for (const name of groups.keys()) visit(name);
}
function parseRules(lines) {
  const output = [];
  for (const line of active(lines)) {
    try {
      const fields = csv(line, `rule ${line}`);
      const type = fields[0].toUpperCase();
      if (!RULE_TYPES.has(type)) throw new Error(`rule ${line}: unsupported rule type ${type}`);
      if ((type === 'FINAL' && fields.length < 2) || (type !== 'FINAL' && fields.length < 3)) throw new Error(`rule ${line}: missing match value or policy`);
      const parameterStart = type === 'FINAL' ? 2 : 3;
      const parameters = new Set();
      for (const component of fields.slice(parameterStart)) {
        const i = component.indexOf('=');
        const key = (i < 0 ? component : component.slice(0, i)).toLowerCase();
        if ((i < 0 && !RULE_FLAGS.has(key)) || (i >= 0 && !RULE_KEY_PARAMS.has(key))) throw new Error(`rule ${line}: unsupported parameter ${key}`);
        if (i >= 0 && !component.slice(i + 1).trim()) throw new Error(`rule ${line}: empty parameter value for ${key}`);
        if (parameters.has(key)) throw new Error(`rule ${line}: duplicate parameter ${key}`);
        parameters.add(key);
      }
      output.push({ raw: line, fields, type, policy: type === 'FINAL' ? fields[1] : fields[2] });
    } catch (error) { fail(error.message); }
  }
  return output;
}
function subsequence(rules, patterns) {
  let position = -1;
  for (const pattern of patterns) {
    const next = rules.findIndex((rule, index) => index > position && pattern.test(rule.raw));
    if (next < 0) fail(`missing or misordered rule contract ${pattern}`);
    else position = next;
  }
}

const sec = sections(text);
for (const required of ['General', 'Proxy Group', 'Rule']) if (!sec.has(required)) fail(`missing [${required}] section`);
for (const name of sec.keys()) if (!['General', 'Proxy Group', 'Rule'].includes(name)) fail(`unexpected public section [${name}]`);

const general = parseGeneral(sec.get('General'));
for (const [key, expected] of REQUIRED_GENERAL) if (general.get(key)?.toLowerCase() !== expected) fail(`[General] ${key} must remain ${expected}`);

const groups = parseGroups(sec.get('Proxy Group'));
for (const name of REQUIRED_VISIBLE) {
  const group = groups.get(name);
  if (!group) fail(`missing core group ${name}`);
  else if (group.type !== 'select') fail(`${name} must be select`);
  if (group?.params.get('hidden') === 'true') fail(`${name} must remain visible`);
}
for (const name of REMOVED_GROUPS) if (groups.has(name)) fail(`removed user-facing group returned: ${name}`);
const manual = groups.get(MANUAL);
if (manual?.params.get('include-all-proxies') !== 'true') fail(`${MANUAL} must include every real proxy`);
for (const region of REGIONAL) if (!manual?.members.includes(region)) fail(`${MANUAL} must expose ${region}`);

const serviceMembers = new Map([
  ['🤖 AI', ['🇺🇸 美国节点', ...REGIONAL.filter(name => name !== '🇺🇸 美国节点'), MANUAL]],
  ['🌍 流媒体', [...REGIONAL, MANUAL]]
]);
for (const [name, required] of serviceMembers) {
  const group = groups.get(name);
  if (!group) continue;
  for (const parameter of ['include-all-proxies', 'include-other-group', 'policy-path', 'policy-regex-filter']) if (group.params.has(parameter)) fail(`${name} must stay compact (${parameter} is forbidden)`);
  for (const member of required) if (!group.members.includes(member)) fail(`${name} must include ${member}`);
}
if (groups.get('🤖 AI')?.members[0] !== '🇺🇸 美国节点') fail('🤖 AI must default to 🇺🇸 美国节点');
if (groups.get('🌍 流媒体')?.members[0] !== '🇭🇰 香港节点') fail('🌍 流媒体 must default to 🇭🇰 香港节点');
for (const name of SERVICES) if (groups.get(name)?.members.includes('DIRECT')) fail(`${name} must not allow DIRECT`);

for (const [manualName, helperName, regex, positive, negative] of REGIONS) {
  const regional = groups.get(manualName);
  const helper = groups.get(helperName);
  if (!regional || !helper) { fail(`missing regional pair ${manualName} / ${helperName}`); continue; }
  if (regional.type !== 'select' || regional.members[0] !== helperName) fail(`${manualName} must default to ${helperName}`);
  if (regional.params.get('include-all-proxies') !== 'true' || regional.params.get('policy-regex-filter') !== regex) fail(`${manualName} import contract changed`);
  if (regional.params.get('hidden') === 'true') fail(`${manualName} must remain visible`);
  if (helper.type !== 'fallback' || helper.members[0] !== 'REJECT') fail(`${helperName} must be fallback with REJECT first`);
  if (helper.params.get('include-all-proxies') !== 'true' || helper.params.get('policy-regex-filter') !== regex) fail(`${helperName} import contract changed`);
  for (const [key, value] of [['evaluate-before-use', 'true'], ['no-alert', 'true'], ['hidden', 'true']]) if (helper.params.get(key) !== value) fail(`${helperName} must keep ${key}=${value}`);
  try {
    const compiled = surgeRegex(regex);
    for (const name of positive) if (!compiled.test(name)) fail(`${manualName} regex missed ${JSON.stringify(name)}`);
    for (const name of negative) if (compiled.test(name)) fail(`${manualName} regex false-positive ${JSON.stringify(name)}`);
  } catch (error) { fail(`${manualName} invalid regex: ${error.message}`); }
}
for (const [name, group] of groups) {
  if (group.type === 'smart') fail(`${name}: smart cannot preserve this nested fail-closed model`);
  if (!group.members.length && !['smart', 'subnet', 'ssid'].includes(group.type)) fail(`${name}: empty policy group`);
  for (const member of group.members) if (!groups.has(member) && !BUILTINS.has(member)) fail(`${name} references undefined policy ${member}`);
}
detectCycles(groups);

const rules = parseRules(sec.get('Rule'));
if (rules[0]?.raw !== 'RULE-SET,LAN,DIRECT,no-resolve') fail('LAN no-resolve rule must remain first');
const finals = rules.filter(rule => rule.type === 'FINAL');
if (finals.length !== 1) fail('must contain exactly one FINAL');
if (rules.at(-1)?.type !== 'FINAL') fail('FINAL must be the last active rule');
if (finals[0]?.policy !== MANUAL || !finals[0]?.fields.includes('dns-failed')) fail(`FINAL must use ${MANUAL} with dns-failed`);
const uniqueRules = new Set();
for (const rule of rules) {
  const normalized = rule.fields.join(',');
  if (uniqueRules.has(normalized)) fail(`duplicate rule ${rule.raw}`);
  uniqueRules.add(normalized);
  if (rule.type === 'MATCH') fail('MATCH is forbidden; use FINAL');
  if (rule.policy && !groups.has(rule.policy) && !BUILTINS.has(rule.policy)) fail(`undefined rule policy ${rule.policy}`);
  if (rule.type === 'RULE-SET' && /^http:\/\//i.test(rule.fields[1] || '')) fail(`external RULE-SET must use HTTPS: ${rule.raw}`);
  const ipBound = rule.type.startsWith('IP-') || ['GEOIP', 'IP-ASN'].includes(rule.type) || (rule.type === 'RULE-SET' && /\/ip\//i.test(rule.fields[1] || ''));
  if (ipBound && !rule.fields.includes('no-resolve')) fail(`IP-bound rule lost no-resolve: ${rule.raw}`);
}
subsequence(rules, [
  /^RULE-SET,LAN,DIRECT,no-resolve$/,
  /^DOMAIN,api\.github\.com,🚀 手动选择(?:,|$)/,
  /apple_intelligence\.conf,🤖 AI(?:,|$)/,
  /^RULE-SET,SYSTEM,DIRECT(?:,|$)/,
  /apple_services\.conf,DIRECT(?:,|$)/,
  /^DOMAIN-SUFFIX,youtube\.com,🌍 流媒体(?:,|$)/,
  /^DOMAIN-SUFFIX,b23\.tv,🚀 手动选择(?:,|$)/,
  /^DOMAIN-SUFFIX,cn,DIRECT(?:,|$)/,
  /\/ip\/ai\.conf,🤖 AI,no-resolve(?:,|$)/,
  /\/ip\/china_ip\.conf,DIRECT,no-resolve(?:,|$)/,
  /^GEOIP,CN,DIRECT,no-resolve$/,
  /^FINAL,🚀 手动选择,dns-failed$/
]);
const bilibili = rules.filter(rule => /(^|,)(b23\.tv|[^,]*bili[^,]*|upos-bstar[^,]*)/i.test(rule.raw));
if (!bilibili.length) fail('Bilibili must retain its rule corpus');
for (const rule of bilibili) if (rule.policy !== MANUAL) fail(`Bilibili rule must follow ${MANUAL}: ${rule.raw}`);
const appleIntelligenceRule = rules.find(rule => rule.fields[1]?.endsWith('/apple_intelligence.conf'));
const appleCnRule = rules.find(rule => rule.fields[1]?.endsWith('/apple_cn.conf'));
const appleServicesRule = rules.find(rule => rule.fields[1]?.endsWith('/apple_services.conf'));
if (appleIntelligenceRule?.policy !== '🤖 AI') fail('Apple Intelligence must use 🤖 AI');
if (appleCnRule?.policy !== 'DIRECT' || appleServicesRule?.policy !== 'DIRECT') fail('non-AI Apple rule families must remain DIRECT');

const remoteHostContracts = new Map([
  ['https://ruleset.skk.moe/List/non_ip/apple_intelligence.conf', new Set(['apple-relay.apple.com', 'gspe1-ssl.ls.apple.com'])],
  ['https://ruleset.skk.moe/List/non_ip/ai.conf', new Set(['chatgpt.com', 'claude.ai', 'gemini.google', 'api.github.com'])],
  ['https://ruleset.skk.moe/List/non_ip/apple_cn.conf', new Set(['cn.apple.com'])],
  ['https://ruleset.skk.moe/List/non_ip/apple_services.conf', new Set(['music.apple.com'])],
  ['https://ruleset.skk.moe/List/non_ip/domestic.conf', new Set(['baidu.com', 'b23.tv', 'bilibili.com'])]
]);
const systemHosts = new Set(['ls.apple.com']);
const domainMatches = (type, value, host) => {
  const normalized = host.toLowerCase();
  const target = value.toLowerCase();
  if (type === 'DOMAIN') return normalized === target;
  if (type === 'DOMAIN-SUFFIX') return normalized === target || normalized.endsWith(`.${target}`);
  if (type === 'DOMAIN-KEYWORD') return normalized.includes(target);
  return false;
};
function routeHost(host) {
  for (const rule of rules) {
    if (['DOMAIN', 'DOMAIN-SUFFIX', 'DOMAIN-KEYWORD'].includes(rule.type) && domainMatches(rule.type, rule.fields[1], host)) return rule.policy;
    if (rule.type === 'RULE-SET' && rule.fields[1] === 'SYSTEM' && [...systemHosts].some(value => domainMatches('DOMAIN-SUFFIX', value, host))) return rule.policy;
    if (rule.type === 'RULE-SET' && remoteHostContracts.get(rule.fields[1])?.has(host)) return rule.policy;
    if (rule.type === 'FINAL') return rule.policy;
  }
  return null;
}
const routeMatrix = new Map([
  ['chatgpt.com', '🤖 AI'], ['claude.ai', '🤖 AI'], ['gemini.google', '🤖 AI'],
  ['deepseek.com', '🤖 AI'], ['apple-relay.apple.com', '🤖 AI'], ['gspe1-ssl.ls.apple.com', '🤖 AI'],
  ['api.github.com', MANUAL], ['ls.apple.com', 'DIRECT'], ['music.apple.com', 'DIRECT'],
  ['youtube.com', '🌍 流媒体'], ['netflix.com', '🌍 流媒体'], ['disneyplus.com', '🌍 流媒体'],
  ['spotify.com', '🌍 流媒体'], ['tiktok.com', '🌍 流媒体'], ['primevideo.com', '🌍 流媒体'],
  ['bilibili.com', MANUAL], ['b23.tv', MANUAL], ['baidu.com', 'DIRECT'],
  ['representative.cn', 'DIRECT'], ['unrelated-foreign.example', MANUAL]
]);
for (const [host, expected] of routeMatrix) {
  const actual = routeHost(host);
  if (actual !== expected) fail(`known-host routing regression: ${host} -> ${actual}, expected ${expected}`);
}

if (/^\s*#!MANAGED-CONFIG\b/im.test(text)) fail('public shell must not contain managed-config');
if (/^\s*[^#\[\n]+\s*=\s*(ss|vmess|trojan|snell|tuic|hysteria2|anytls|wireguard|http|https|socks5|socks5-tls)\s*,/im.test(text)) fail('public shell contains concrete proxy node');
if (/\b(password|private-key|username|token)\s*=\s*[^\s,#]+/i.test(text)) fail('public shell appears to contain credentials');
for (const line of [...active(sec.get('General')), ...active(sec.get('Proxy Group')), ...active(sec.get('Rule'))]) {
  for (const match of line.matchAll(/https?:\/\/[^\s,"']+/gi)) {
    try {
      const url = new URL(match[0]);
      const trustedRule = url.protocol === 'https:' && url.hostname === 'ruleset.skk.moe' && url.pathname.startsWith('/List/');
      const trustedIcon = url.protocol === 'https:' && url.hostname === 'raw.githubusercontent.com' && (/^\/Aioneas\/Surge\//.test(url.pathname) || /^\/Rabbit-Spec\/Surge\//.test(url.pathname));
      const trustedTest = url.protocol === 'http:' && url.hostname === 'www.gstatic.com' && url.pathname === '/generate_204';
      if (!trustedRule && !trustedIcon && !trustedTest) fail(`untrusted active public URL: ${url.href}`);
    } catch { fail(`malformed active URL: ${match[0]}`); }
  }
}

const scenarios = [
  { name: 'zero nodes', nodes: [], matched: [] },
  { name: 'one region only', nodes: ['香港 01'], matched: ['🇭🇰 香港节点'] },
  { name: 'partial regions', nodes: ['HK-01', 'JP-01', 'US-01'], matched: ['🇭🇰 香港节点', '🇯🇵 日本节点', '🇺🇸 美国节点'] },
  { name: 'all six regions', nodes: ['HK-01', 'JP-01', 'SG-01', 'US-01', 'TW-01', 'KR-01'], matched: REGIONAL },
  { name: 'long-tail only', nodes: ['UK-01', 'DE-01', 'CA-01'], matched: [] },
  { name: 'mixed', nodes: ['香港 01', '日本 01', '新加坡 01', '美国 01', '台湾 01', '韩国 01', 'UK-01', 'Unclassified 01'], matched: REGIONAL },
  { name: 'duplicate names', nodes: ['US-01', 'US-01_1', '香港 01', '香港 01_1'], matched: ['🇭🇰 香港节点', '🇺🇸 美国节点'] },
  { name: 'equals suffix', nodes: ['HK-01=Premium', 'JP-01=Premium', 'SG-01=Premium', 'US-01=Premium', 'TW-01=Premium', 'KR-01=Premium'], matched: REGIONAL },
  { name: 'adversarial names', nodes: ['VIP-港口中转', 'VIP-日常节点', 'VIP-新节点', 'VIP-美化线路', 'VIP-台式出口', 'KRAKEN', 'KRW 01', 'KOREAN text'], matched: [] },
  { name: '126 nodes', nodes: Array.from({ length: 126 }, (_, i) => `${['HK', 'JP', 'SG', 'US', 'TW', 'KR'][i % 6]}-${String(i + 1).padStart(3, '0')}`), matched: REGIONAL }
];
for (const scenario of scenarios) {
  const expected = new Set(scenario.matched);
  if (imported(manual, scenario.nodes).length !== scenario.nodes.length) fail(`${MANUAL} no longer exposes every real proxy in ${scenario.name}`);
  for (const name of SERVICES) if (imported(groups.get(name), scenario.nodes).length) fail(`${name} directly exposes raw proxies`);
  for (const [manualName, helperName] of REGIONS) {
    const helper = groups.get(helperName);
    const importedNodes = imported(helper, scenario.nodes);
    if (helper?.members[0] !== 'REJECT') fail(`${helperName} lost zero-node REJECT safety`);
    if (Boolean(importedNodes.length) !== expected.has(manualName)) fail(`${scenario.name}: unexpected ${manualName} classification`);
    if (!importedNodes.length && helper?.members[0] !== 'REJECT') fail(`${scenario.name}: ${helperName} is not fail-closed`);
    if (groups.get(manualName)?.members[0] !== helperName) fail(`${manualName} no longer defaults to ${helperName}`);
  }
}

try {
  const probe = csv('select, "Node, with comma", external-policy-modifier="test-url=http://example.com/a,b,tfo=true", "escaped \\"quote\\""', 'tokenizer self-test');
  const expected = ['select', 'Node, with comma', 'external-policy-modifier=test-url=http://example.com/a,b,tfo=true', 'escaped "quote"'];
  if (JSON.stringify(probe) !== JSON.stringify(expected)) fail('comma-aware tokenizer self-test failed');
} catch (error) { fail(`comma-aware tokenizer self-test crashed: ${error.message}`); }

if (!errors.length && process.env.SKIP_LEGAL_FIXTURE !== '1') {
  const legal = text
    .replace('/Icon/Global.png', '/Icon/Final.png')
    .replace('[Rule]', '🧪 合法扩展 = select, 🚀 手动选择, hidden=true\n\n[Rule]')
    .replace('# Final\n', '# A non-critical comment may evolve.\nDOMAIN-SUFFIX,legal-evolution.example,🧪 合法扩展,extended-matching\n\n# Final\n');
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'beatrice-surge-legal-'));
  try {
    const fixturePath = path.join(directory, 'legal.conf');
    fs.writeFileSync(fixturePath, legal);
    const result = spawnSync(process.execPath, [validatorPath], {
      env: { ...process.env, SURGE_CONFIG_PATH: fixturePath, SKIP_NEGATIVE_FIXTURES: '1', SKIP_LEGAL_FIXTURE: '1' },
      encoding: 'utf8', timeout: 5_000, killSignal: 'SIGKILL'
    });
    if (result.error || result.signal || result.status !== 0) fail(`legal evolution fixture failed: ${result.error?.message || result.signal || result.stderr.trim() || `status=${result.status}`}`);
  } finally { fs.rmSync(directory, { recursive: true, force: true }); }
}

let negativeFixtureCount = 0;
if (!errors.length && process.env.SKIP_NEGATIVE_FIXTURES !== '1') {
  const fixtures = [
    ['duplicate section', source => `${source}\n[Rule]\nFINAL,DIRECT\n`],
    ['duplicate General key', source => source.replace('ipv6 = false', 'ipv6 = false\nipv6 = false')],
    ['malformed quote', source => source.replace('icon-url=https://raw.githubusercontent.com/Aioneas/Surge/main/Icon/Global.png', 'icon-url="https://example.com/a,b.png')],
    ['empty group component', source => source.replace('🤖 AI = select,', '🤖 AI = select,,')],
    ['duplicate group parameter', source => source.replace('⚡ 美国自动 = fallback, REJECT,', '⚡ 美国自动 = fallback, REJECT, hidden=true,')],
    ['unknown group type', source => source.replace('⚡ 美国自动 = fallback,', '⚡ 美国自动 = typo,')],
    ['unknown group parameter', source => source.replace('⚡ 美国自动 = fallback, REJECT,', '⚡ 美国自动 = fallback, REJECT, hiddden=true,')],
    ['duplicate group', source => source.replace('[Rule]', `${active(sec.get('Proxy Group'))[0]}\n[Rule]`)],
    ['service raw-node flood', source => source.replace(/(🤖 AI = select,[^\n]*?)(, icon-url=)/, '$1, include-all-proxies=true$2')],
    ['manual loses raw import', source => source.replace(', include-all-proxies=true, icon-url=https://raw.githubusercontent.com/Aioneas/Surge/main/Icon/Global.png', ', icon-url=https://raw.githubusercontent.com/Aioneas/Surge/main/Icon/Global.png')],
    ['helper loses REJECT', source => source.replace('⚡ 美国自动 = fallback, REJECT,', '⚡ 美国自动 = fallback, DIRECT,')],
    ['region hidden', source => source.replace('🇺🇸 美国节点 = select, ⚡ 美国自动,', '🇺🇸 美国节点 = select, ⚡ 美国自动, hidden=true,')],
    ['policy cycle', source => source.replace('🚀 手动选择 = select, 🇭🇰 香港节点,', '🚀 手动选择 = select, 🤖 AI, 🇭🇰 香港节点,')],
    ['removed group returned', source => source.replace('[Rule]', '🌐 兜底策略 = select, 🚀 手动选择\n[Rule]')],
    ['AI loses Korea', source => source.replace(', 🇰🇷 韩国节点, 🚀 手动选择, icon-url=https://raw.githubusercontent.com/Aioneas/Surge/main/Icon/ChatGPT.png', ', 🚀 手动选择, icon-url=https://raw.githubusercontent.com/Aioneas/Surge/main/Icon/ChatGPT.png')],
    ['Korea regex false positive', source => source.replace('((South )?Korea|KR)([^A-Za-z]|$)', '((South )?Korea|KR)')],
    ['General changed', source => source.replace('ipv6 = false', 'ipv6 = true')],
    ['GitHub captured by AI', source => source.replace('DOMAIN,api.github.com,🚀 手动选择,extended-matching', 'DOMAIN,api.github.com,🤖 AI,extended-matching')],
    ['Bilibili captured as domestic', source => source.replace('DOMAIN-SUFFIX,b23.tv,🚀 手动选择,extended-matching', 'DOMAIN-SUFFIX,b23.tv,DIRECT,extended-matching')],
    ['Apple services captured by manual', source => source.replace('apple_services.conf,DIRECT,no-resolve', 'apple_services.conf,🚀 手动选择,no-resolve')],
    ['missing no-resolve', source => source.replace('GEOIP,CN,DIRECT,no-resolve', 'GEOIP,CN,DIRECT')],
    ['unknown rule type', source => source.replace('DOMAIN-SUFFIX,youtube.com', 'DOMAIN-SUFIX,youtube.com')],
    ['unknown rule parameter', source => source.replace('DOMAIN-SUFFIX,youtube.com,🌍 流媒体,extended-matching', 'DOMAIN-SUFFIX,youtube.com,🌍 流媒体,extended-matcing')],
    ['duplicate rule parameter', source => source.replace('DOMAIN-SUFFIX,youtube.com,🌍 流媒体,extended-matching', 'DOMAIN-SUFFIX,youtube.com,🌍 流媒体,extended-matching,extended-matching')],
    ['untrusted active URL', source => source.replace('https://ruleset.skk.moe/List/non_ip/ai.conf', 'https://unknown.example/private/random')],
    ['FINAL not last', source => source.replace('FINAL,🚀 手动选择,dns-failed', 'FINAL,🚀 手动选择,dns-failed\nDOMAIN,after-final.example,DIRECT')]
  ];
  negativeFixtureCount = fixtures.length;
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'beatrice-surge-validator-'));
  try {
    for (const [index, [name, mutate]] of fixtures.entries()) {
      const mutated = mutate(text);
      if (mutated === text) { fail(`negative fixture did not mutate: ${name}`); continue; }
      const fixturePath = path.join(directory, `${index}.conf`);
      fs.writeFileSync(fixturePath, mutated);
      const result = spawnSync(process.execPath, [validatorPath], {
        env: { ...process.env, SURGE_CONFIG_PATH: fixturePath, SKIP_NEGATIVE_FIXTURES: '1' },
        encoding: 'utf8', timeout: 5_000, killSignal: 'SIGKILL'
      });
      if (result.error) fail(`negative fixture process failed (${name}): ${result.error.message}`);
      else if (result.signal) fail(`negative fixture was terminated by ${result.signal} (${name})`);
      else if (result.status === null) fail(`negative fixture returned no status (${name})`);
      else if (result.status !== 1 || !result.stderr.includes('Surge profile validation FAILED')) fail(`negative fixture was not a normal validation rejection (${name}, status=${result.status})`);
    }
  } finally { fs.rmSync(directory, { recursive: true, force: true }); }
}

if (errors.length) {
  console.error(`Surge profile validation FAILED (${errors.length} issues):`);
  for (const error of errors) console.error(`- ${error}`);
  process.exit(1);
}
console.log('Surge profile validation PASS');
console.log(`- Required General contracts: ${REQUIRED_GENERAL.size}`);
console.log(`- Required visible policies: ${REQUIRED_VISIBLE.length}`);
console.log(`- Compact service policies: ${SERVICES.length}`);
console.log(`- Regional selectors/helpers: ${REGIONS.length}`);
console.log(`- Dynamic node scenarios: ${scenarios.length}`);
console.log('- Parser/tokenizer, policy graph, regex, rules, public safety: PASS');
console.log(`- Known-host first-match routes: ${routeMatrix.size}`);
console.log(`- Negative fixtures rejected normally: ${negativeFixtureCount}`);
console.log('- Legal evolution fixture accepted: PASS');
