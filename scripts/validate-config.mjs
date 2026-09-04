import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');
const configPath = path.join(root, 'Beatrice-Surge.conf');
const text = fs.readFileSync(configPath, 'utf8').replace(/\r\n/g, '\n');

const EXPECTED_SECTIONS = ['General', 'Proxy Group', 'Rule'];
const GENERAL_BASELINE = new Map([
  ['dns-server', 'system'],
  ['use-local-host-item-for-proxy', 'false'],
  ['compatibility-mode', '3'],
  ['ipv6', 'false'],
  ['ipv6-vif', 'disabled'],
  ['wifi-assist', 'false'],
  ['all-hybrid', 'false'],
  ['udp-priority', 'true'],
  ['udp-policy-not-supported-behaviour', 'reject'],
  ['allow-wifi-access', 'false'],
  ['allow-hotspot-access', 'false'],
  ['proxy-restricted-to-lan', 'true'],
  ['include-all-networks', 'true'],
  ['include-local-networks', 'false'],
  ['include-apns', 'false'],
  ['include-cellular-services', 'false'],
  ['exclude-simple-hostnames', 'true'],
  ['icmp-forwarding', 'false'],
  ['loglevel', 'notify']
]);

const CORE_GROUPS = [
  '🚀 手动切换',
  '🤖 AI服务',
  '🌍 国外流媒体',
  '📺 哔哩哔哩',
  '🍎 苹果服务',
  '🌐 兜底策略'
];

const REGION_SPECS = [
  {
    manual: '🇭🇰 香港节点', auto: '⚡ 香港自动',
    regex: '(?i)(🇭🇰|香港|Hong Kong|(^|[- _/|()])港($|[- _/|()0-9])|(^|[^A-Za-z])HK([^A-Za-z]|$))',
    positive: ['香港 01', '香港-专线', 'HK-01', 'HK01', 'HK_01', '(HK) 01', 'Hong Kong', '🇭🇰', 'VIP-港-01', '港_02', '(港)3'],
    negative: ['VIP-港口中转', 'HKG 01', 'HKG-01', 'BANKHK', 'CHKG 01']
  },
  {
    manual: '🇯🇵 日本节点', auto: '⚡ 日本自动',
    regex: '(?i)(🇯🇵|日本|Japan|(^|[- _/|()])日($|[- _/|()0-9])|(^|[^A-Za-z])JP([^A-Za-z]|$))',
    positive: ['日本 01', 'JP-01', 'JP01', 'JP_01', '(JP) 01', 'Japan', '🇯🇵', 'VIP-日-01', '日/02'],
    negative: ['VIP-日常节点', 'JPG 01', 'JPN 01', 'AJPB', 'PROJECT-JPTEST']
  },
  {
    manual: '🇸🇬 新加坡节点', auto: '⚡ 新加坡自动',
    regex: '(?i)(🇸🇬|新加坡|狮城|Singapore|(^|[- _/|()])新($|[- _/|()0-9])|(^|[^A-Za-z])SG([^A-Za-z]|$))',
    positive: ['新加坡 01', '狮城 01', 'SG-01', 'SG01', 'SG_01', '(SG) 01', 'Singapore', '🇸🇬', 'VIP-新-01', '新/02'],
    negative: ['VIP-新节点', 'SGP 01', 'ASGARD 01', 'SGET 01', 'NEWSGROUP']
  },
  {
    manual: '🇺🇸 美国节点', auto: '⚡ 美国自动',
    regex: '(?i)(🇺🇸|美国|美國|United States|America|(^|[- _/|()])美($|[- _/|()0-9])|(^|[^A-Za-z])US([^A-Za-z]|$))',
    positive: ['美国 01', '美國 01', 'US-01', 'US01', 'US_01', '(US) 01', 'United States', 'America', '🇺🇸', 'VIP-美-01', '美/02'],
    negative: ['VIP-美化线路', 'USA 01', 'RUS 01', 'BUS 01', 'USDT 01', 'MUSIC-USAGE']
  },
  {
    manual: '🇹🇼 台湾节点', auto: '⚡ 台湾自动',
    regex: '(?i)(🇹🇼|台湾|台灣|Taiwan|(^|[- _/|()])台($|[- _/|()0-9])|(^|[^A-Za-z])TW([^A-Za-z]|$))',
    positive: ['台湾 01', '台灣 01', 'TW-01', 'TW01', 'TW_01', '(TW) 01', 'Taiwan', '🇹🇼', 'VIP-台-01', '台/02'],
    negative: ['VIP-台式出口', 'TWN 01', 'TWITTER 01', 'NETWORK 01', 'ATWIST']
  }
];

const REGION_GROUPS = REGION_SPECS.map(x => x.manual);
const AUTO_GROUPS = REGION_SPECS.map(x => x.auto);
const EXPECTED_GROUP_ORDER = [...CORE_GROUPS, ...REGION_GROUPS, ...AUTO_GROUPS];

const EXPECTED_CORE_MEMBERS = new Map([
  ['🚀 手动切换', ['🇭🇰 香港节点', '🇯🇵 日本节点', '🇸🇬 新加坡节点', '🇺🇸 美国节点', '🇹🇼 台湾节点']],
  ['🤖 AI服务', ['🇺🇸 美国节点', '🇯🇵 日本节点', '🇸🇬 新加坡节点', '🚀 手动切换']],
  ['🌍 国外流媒体', ['🇭🇰 香港节点', '🇸🇬 新加坡节点', '🇯🇵 日本节点', '🇺🇸 美国节点', '🇹🇼 台湾节点', '🚀 手动切换']],
  ['📺 哔哩哔哩', ['🇭🇰 香港节点', '🇹🇼 台湾节点', '🇯🇵 日本节点', '🚀 手动切换']],
  ['🍎 苹果服务', ['DIRECT', '🇭🇰 香港节点', '🇯🇵 日本节点', '🇺🇸 美国节点', '🚀 手动切换']],
  ['🌐 兜底策略', ['🚀 手动切换', 'DIRECT', '🇭🇰 香港节点', '🇯🇵 日本节点', '🇸🇬 新加坡节点', '🇺🇸 美国节点', '🇹🇼 台湾节点']]
]);

const BUILTINS = new Set([
  'DIRECT', 'REJECT', 'REJECT-DROP', 'REJECT-NO-DROP', 'REJECT-TINYGIF',
  'CELLULAR', 'CELLULAR-ONLY', 'HYBRID', 'NO-HYBRID', 'PASS'
]);

// Update only in the same commit as an intentional [Rule] semantic change.
const EXPECTED_RULE_SHA256 = '995f5cbbca7a477f758360580549ebb431e6a35be43eb576d273081e4b9705d6';

function splitCsv(line) {
  return line.split(',').map(x => x.trim()).filter(Boolean);
}

function parseSections(profileText) {
  const sections = [];
  const lines = profileText.split('\n');
  let current = null;
  for (let i = 0; i < lines.length; i += 1) {
    const raw = lines[i];
    const match = raw.match(/^\s*\[([^\]]+)\]\s*$/);
    if (match) {
      current = { name: match[1].trim(), startLine: i + 1, lines: [] };
      sections.push(current);
    } else if (current) {
      current.lines.push({ raw, line: i + 1 });
    }
  }
  return sections;
}

function activeLines(section) {
  return section.lines
    .map(({ raw, line }) => ({ raw: raw.trim(), line }))
    .filter(({ raw }) => raw && !raw.startsWith('#'));
}

function parseGeneral(section, errors) {
  const values = new Map();
  for (const { raw, line } of activeLines(section)) {
    const idx = raw.indexOf('=');
    if (idx < 1) {
      errors.push(`[General] line ${line} is not key=value: ${raw}`);
      continue;
    }
    const key = raw.slice(0, idx).trim();
    const value = raw.slice(idx + 1).trim();
    if (values.has(key)) errors.push(`[General] duplicate key: ${key}`);
    values.set(key, value);
  }
  return values;
}

function parseGroups(section, errors) {
  const groups = new Map();
  const order = [];
  for (const { raw, line } of activeLines(section)) {
    const idx = raw.indexOf('=');
    if (idx < 1) {
      errors.push(`[Proxy Group] line ${line} is not name=definition: ${raw}`);
      continue;
    }
    const name = raw.slice(0, idx).trim();
    const rhs = raw.slice(idx + 1).trim();
    const parts = splitCsv(rhs);
    if (!parts.length) {
      errors.push(`[Proxy Group] ${name} has an empty definition`);
      continue;
    }
    if (groups.has(name)) errors.push(`[Proxy Group] duplicate group: ${name}`);
    const type = parts[0].toLowerCase();
    const members = [];
    const params = new Map();
    for (const token of parts.slice(1)) {
      const eq = token.indexOf('=');
      if (eq > 0) {
        const key = token.slice(0, eq).trim();
        const value = token.slice(eq + 1).trim();
        if (params.has(key)) errors.push(`[Proxy Group] ${name} duplicate parameter: ${key}`);
        params.set(key, value);
      } else {
        members.push(token);
      }
    }
    const group = { name, line, type, members, params, raw };
    groups.set(name, group);
    order.push(name);
  }
  return { groups, order };
}

function compileSurgeRegex(source) {
  let pattern = source;
  let flags = '';
  if (pattern.startsWith('(?i)')) {
    pattern = pattern.slice(4);
    flags += 'i';
  }
  return new RegExp(pattern, flags);
}

function sameArray(a, b) {
  return a.length === b.length && a.every((v, i) => v === b[i]);
}

function parseRules(section) {
  return activeLines(section).map(({ raw, line }) => {
    const fields = splitCsv(raw);
    const type = (fields[0] || '').toUpperCase();
    const policy = type === 'FINAL' ? fields[1] : fields[2];
    return { raw, line, fields, type, policy };
  });
}

function findCycles(groups) {
  const cycles = [];
  const state = new Map();
  const stack = [];
  function visit(name) {
    const s = state.get(name) || 0;
    if (s === 1) {
      const idx = stack.indexOf(name);
      cycles.push([...stack.slice(idx), name]);
      return;
    }
    if (s === 2) return;
    state.set(name, 1);
    stack.push(name);
    for (const member of groups.get(name)?.members || []) {
      if (groups.has(member)) visit(member);
    }
    stack.pop();
    state.set(name, 2);
  }
  for (const name of groups.keys()) visit(name);
  return cycles;
}

function includedProxyNames(group, proxyNames) {
  if (!group) return [];
  if (group.params.get('include-all-proxies') !== 'true') return [];
  const filter = group.params.get('policy-regex-filter');
  if (!filter) return [...proxyNames];
  const re = compileSurgeRegex(filter);
  return proxyNames.filter(name => re.test(name));
}

function effectiveMembers(group, proxyNames) {
  if (!group) return [];
  return [...group.members, ...includedProxyNames(group, proxyNames)];
}

function resolveTerminals(name, groups, proxyNames, stack = []) {
  if (BUILTINS.has(name)) return new Set([name]);
  if (!groups.has(name)) return new Set([`PROXY:${name}`]);
  if (stack.includes(name)) return new Set(['CYCLE']);
  const group = groups.get(name);
  const members = effectiveMembers(group, proxyNames);
  if (members.length === 0) return new Set(['SUBSTITUTE:DIRECT']);
  const result = new Set();
  for (const member of members) {
    if (groups.has(member) || BUILTINS.has(member)) {
      for (const terminal of resolveTerminals(member, groups, proxyNames, [...stack, name])) result.add(terminal);
    } else {
      result.add(`PROXY:${member}`);
    }
  }
  return result;
}

function assertNoImplicitDirect(groups, proxyNames, errors, label) {
  for (const name of [...CORE_GROUPS, ...REGION_GROUPS, ...AUTO_GROUPS]) {
    const terminals = resolveTerminals(name, groups, proxyNames);
    if (terminals.has('SUBSTITUTE:DIRECT')) {
      errors.push(`[dynamic:${label}] ${name} can become empty-group SUBSTITUTE:DIRECT`);
    }
    if (terminals.has('CYCLE')) errors.push(`[dynamic:${label}] ${name} reaches a cycle`);
  }
  // DIRECT is permitted only as an explicit user-selectable member of Apple and Final.
  for (const name of ['🚀 手动切换', '🤖 AI服务', '🌍 国外流媒体', '📺 哔哩哔哩', ...REGION_GROUPS, ...AUTO_GROUPS]) {
    const terminals = resolveTerminals(name, groups, proxyNames);
    if (terminals.has('DIRECT')) errors.push(`[dynamic:${label}] ${name} reaches DIRECT without an explicit DIRECT option`);
  }
}

function validateProfile(profileText, { checkRuleDigest = true } = {}) {
  const errors = [];
  const normalized = profileText.replace(/\r\n/g, '\n');
  const sections = parseSections(normalized);
  const names = sections.map(x => x.name);
  if (!sameArray(names, EXPECTED_SECTIONS)) {
    errors.push(`sections must be exactly ${EXPECTED_SECTIONS.map(x => `[${x}]`).join(' -> ')}, got ${names.map(x => `[${x}]`).join(' -> ') || '(none)'}`);
  }
  const byName = new Map(sections.map(s => [s.name, s]));
  for (const required of EXPECTED_SECTIONS) if (!byName.has(required)) errors.push(`missing [${required}]`);
  if (byName.has('Proxy')) errors.push('public shell must not contain [Proxy]');
  if (errors.some(e => e.startsWith('missing'))) return { errors };

  const general = parseGeneral(byName.get('General'), errors);
  for (const [key, expected] of GENERAL_BASELINE) {
    if (general.get(key) !== expected) errors.push(`[General] ${key} must remain ${expected}, got ${general.get(key) ?? '(missing)'}`);
  }
  for (const key of general.keys()) {
    if (!GENERAL_BASELINE.has(key)) errors.push(`[General] unexpected active key: ${key}`);
  }

  const { groups, order } = parseGroups(byName.get('Proxy Group'), errors);
  if (!sameArray(order, EXPECTED_GROUP_ORDER)) {
    errors.push(`[Proxy Group] order/names changed. expected ${EXPECTED_GROUP_ORDER.join(' -> ')}, got ${order.join(' -> ')}`);
  }

  for (const [name, members] of EXPECTED_CORE_MEMBERS) {
    const g = groups.get(name);
    if (!g) { errors.push(`missing core group: ${name}`); continue; }
    if (g.type !== 'select') errors.push(`${name} must be select, got ${g.type}`);
    if (!sameArray(g.members, members)) errors.push(`${name} explicit members must be ${members.join(' | ')}, got ${g.members.join(' | ')}`);
    if (g.params.get('include-all-proxies') !== 'true') errors.push(`${name} must include-all-proxies=true for direct per-service/manual real-node override`);
    if (g.params.has('policy-regex-filter')) errors.push(`${name} must not filter its direct real-node override list`);
    if (g.params.get('hidden') === 'true') errors.push(`${name} must remain visible in iOS Policy Selection`);
  }

  for (const spec of REGION_SPECS) {
    const manual = groups.get(spec.manual);
    const auto = groups.get(spec.auto);
    if (!manual) errors.push(`missing regional manual group: ${spec.manual}`);
    if (!auto) errors.push(`missing regional automatic helper: ${spec.auto}`);
    if (!manual || !auto) continue;

    if (manual.type !== 'select') errors.push(`${spec.manual} must be select for persistent manual selection`);
    if (!sameArray(manual.members, [spec.auto])) errors.push(`${spec.manual} must explicitly default to ${spec.auto}`);
    if (manual.params.get('include-all-proxies') !== 'true') errors.push(`${spec.manual} must include-all-proxies=true`);
    if (manual.params.get('policy-regex-filter') !== spec.regex) errors.push(`${spec.manual} regional regex changed unexpectedly`);
    if (manual.params.get('hidden') === 'true') errors.push(`${spec.manual} must be visible for persistent regional manual selection`);

    if (auto.type !== 'fallback') errors.push(`${spec.auto} must be fallback`);
    if (!sameArray(auto.members, ['REJECT'])) errors.push(`${spec.auto} must have REJECT as its sole explicit safety member`);
    if (auto.params.get('include-all-proxies') !== 'true') errors.push(`${spec.auto} must include-all-proxies=true`);
    if (auto.params.get('policy-regex-filter') !== spec.regex) errors.push(`${spec.auto} regional regex must exactly match ${spec.manual}`);
    if (auto.params.get('evaluate-before-use') !== 'true') errors.push(`${spec.auto} must evaluate-before-use=true`);
    if (auto.params.get('no-alert') !== 'true') errors.push(`${spec.auto} must no-alert=true`);
    if (auto.params.get('hidden') !== 'true') errors.push(`${spec.auto} must hidden=true`);

    let re;
    try { re = compileSurgeRegex(spec.regex); } catch (error) {
      errors.push(`${spec.manual} regex is invalid: ${error.message}`);
      continue;
    }
    for (const sample of spec.positive) if (!re.test(sample)) errors.push(`${spec.manual} regex missed positive sample: ${sample}`);
    for (const sample of spec.negative) if (re.test(sample)) errors.push(`${spec.manual} regex false-positive sample: ${sample}`);
  }

  for (const g of groups.values()) {
    if (g.type === 'smart') errors.push(`${g.name}: smart is forbidden in this manual-override/fail-closed architecture`);
    for (const member of g.members) {
      if (!groups.has(member) && !BUILTINS.has(member)) errors.push(`${g.name} references undefined explicit policy: ${member}`);
    }
  }
  for (const cycle of findCycles(groups)) errors.push(`policy cycle: ${cycle.join(' -> ')}`);

  const rules = parseRules(byName.get('Rule'));
  if (rules.length === 0) errors.push('[Rule] must not be empty');
  const rawRuleSet = new Set();
  for (const rule of rules) {
    if (rawRuleSet.has(rule.raw)) errors.push(`[Rule] duplicate rule: ${rule.raw}`);
    rawRuleSet.add(rule.raw);
    if (rule.type === 'MATCH') errors.push('[Rule] MATCH is forbidden; use FINAL only');
    if (!rule.policy) errors.push(`[Rule] line ${rule.line} has no policy target: ${rule.raw}`);
    if (rule.policy && !groups.has(rule.policy) && !BUILTINS.has(rule.policy)) errors.push(`[Rule] undefined policy ${rule.policy}: ${rule.raw}`);
    if (rule.type === 'RULE-SET' && /^https?:\/\//i.test(rule.fields[1] || '') && !/^https:\/\//i.test(rule.fields[1])) {
      errors.push(`[Rule] external RULE-SET must use HTTPS: ${rule.raw}`);
    }
    const ipRule = rule.type.startsWith('IP-') || (rule.type === 'RULE-SET' && /\/ip\//i.test(rule.fields[1] || ''));
    if (ipRule && !rule.fields.includes('no-resolve')) errors.push(`[Rule] IP-bound rule must retain no-resolve: ${rule.raw}`);
  }

  const finals = rules.filter(r => r.type === 'FINAL');
  if (finals.length !== 1) errors.push(`[Rule] expected exactly one FINAL, got ${finals.length}`);
  if (rules.at(-1)?.raw !== 'FINAL,🌐 兜底策略,dns-failed') errors.push('[Rule] FINAL must remain final and target 🌐 兜底策略 with dns-failed');
  if (rules[0]?.raw !== 'RULE-SET,LAN,DIRECT,no-resolve') errors.push('[Rule] LAN rule must remain first');

  const indexOf = raw => rules.findIndex(r => r.raw === raw);
  const checkpoints = [
    'DOMAIN,api.github.com,🌐 兜底策略,extended-matching',
    'RULE-SET,https://ruleset.skk.moe/List/non_ip/apple_intelligence.conf,🤖 AI服务,extended-matching',
    'RULE-SET,SYSTEM,DIRECT',
    'RULE-SET,https://ruleset.skk.moe/List/non_ip/apple_services.conf,🍎 苹果服务,no-resolve,extended-matching',
    'DOMAIN-SUFFIX,youtube.com,🌍 国外流媒体,extended-matching',
    'DOMAIN-SUFFIX,b23.tv,📺 哔哩哔哩,extended-matching',
    'DOMAIN-SUFFIX,cn,DIRECT,extended-matching',
    'RULE-SET,https://ruleset.skk.moe/List/ip/ai.conf,🤖 AI服务,no-resolve',
    'RULE-SET,https://ruleset.skk.moe/List/ip/china_ip.conf,DIRECT,no-resolve',
    'GEOIP,CN,DIRECT,no-resolve',
    'FINAL,🌐 兜底策略,dns-failed'
  ];
  let last = -1;
  for (const checkpoint of checkpoints) {
    const idx = indexOf(checkpoint);
    if (idx < 0) errors.push(`[Rule] missing regression checkpoint: ${checkpoint}`);
    else if (idx <= last) errors.push(`[Rule] ordering regression around: ${checkpoint}`);
    else last = idx;
  }

  const bilibiliRules = rules.filter(r => /(^|,)(b23\.tv|[^,]*bili[^,]*|upos-bstar[^,]*)/i.test(r.raw));
  if (bilibiliRules.length < 20) errors.push(`[Rule] Bilibili corpus unexpectedly small: ${bilibiliRules.length}`);
  for (const rule of bilibiliRules) if (rule.policy !== '📺 哔哩哔哩') errors.push(`[Rule] Bilibili must use independent 📺 哔哩哔哩 policy: ${rule.raw}`);

  if (checkRuleDigest) {
    const normalizedRules = rules.map(r => r.raw).join('\n');
    const digest = crypto.createHash('sha256').update(normalizedRules).digest('hex');
    if (process.env.PRINT_RULE_HASH === '1') console.log(`RULE_SHA256=${digest}`);
    if (EXPECTED_RULE_SHA256 !== '__RULE_HASH__' && digest !== EXPECTED_RULE_SHA256) {
      errors.push(`[Rule] semantic digest changed: expected ${EXPECTED_RULE_SHA256}, got ${digest}`);
    }
  }

  // Public-shell security boundary.
  if (/^\s*#!MANAGED-CONFIG\b/im.test(normalized)) errors.push('public shell must not contain a private managed-config directive');
  if (/^\s*\[Proxy\]\s*$/im.test(normalized)) errors.push('public shell must not declare [Proxy]');
  if (/^\s*[^#\[\n]+\s*=\s*(ss|vmess|trojan|snell|tuic|hysteria2|anytls|wireguard|http|https|socks5|socks5-tls)\s*,/im.test(normalized)) {
    errors.push('public shell must not contain concrete proxy node declarations');
  }
  if (/\b(password|private-key|username|token)\s*=\s*[^\s,#]+/i.test(normalized)) errors.push('public shell appears to contain a credential assignment');

  // Dynamic [Proxy] injection scenarios. These model include-all-proxies and regex selection.
  const scenarios = new Map([
    ['zero-nodes', []],
    ['only-hk', ['香港 01']],
    ['only-us', ['US-01']],
    ['only-jp', ['JP_01']],
    ['only-sg', ['Singapore 01']],
    ['only-tw', ['TW01']],
    ['partial-regions', ['香港 01', 'US-01', 'Unclassified 01']],
    ['all-regions', ['HK-01', 'JP-01', 'SG-01', 'US-01', 'TW-01']],
    ['single-char-boundaries', ['VIP-港-01', 'VIP-日-01', 'VIP-新-01', 'VIP-美-01', 'VIP-台-01']],
    ['adversarial-chinese', ['VIP-港口中转', 'VIP-日常节点', 'VIP-新节点', 'VIP-美化线路', 'VIP-台式出口']],
    ['adversarial-codes', ['HKG 01', 'JPG 01', 'SGP 01', 'USA 01', 'TWN 01', 'RUS 01', 'BUS 01', 'USDT 01', 'TWITTER 01']],
    ['duplicate-source-names-after-sub-dedupe', ['US-01', 'US-01_1', '香港 01', '香港 01_1']],
    ['large-node-set', Array.from({ length: 100 }, (_, i) => `${['HK','JP','SG','US','TW'][i % 5]}-${String(i + 1).padStart(2, '0')}`)]
  ]);
  for (const [label, proxies] of scenarios) {
    assertNoImplicitDirect(groups, proxies, errors, label);
    for (const spec of REGION_SPECS) {
      const manualMembers = effectiveMembers(groups.get(spec.manual), proxies);
      const autoMembers = effectiveMembers(groups.get(spec.auto), proxies);
      if (manualMembers[0] !== spec.auto) errors.push(`[dynamic:${label}] ${spec.manual} no longer defaults to ${spec.auto}`);
      if (autoMembers[0] !== 'REJECT') errors.push(`[dynamic:${label}] ${spec.auto} lost first-member REJECT safety`);
      if (proxies.length === 0 && autoMembers.length !== 1) errors.push(`[dynamic:${label}] ${spec.auto} should collapse to REJECT only`);
    }
    for (const service of CORE_GROUPS) {
      const imported = includedProxyNames(groups.get(service), proxies);
      if (imported.length !== proxies.length) errors.push(`[dynamic:${label}] ${service} does not expose all injected real proxies`);
    }
  }

  // Adversarial corpus must not leak false positive region matches.
  const falsePositiveScenario = scenarios.get('adversarial-chinese');
  for (const spec of REGION_SPECS) {
    const imported = includedProxyNames(groups.get(spec.manual), falsePositiveScenario);
    if (imported.length !== 0) errors.push(`[regex] ${spec.manual} matched adversarial Chinese names: ${imported.join(', ')}`);
  }

  return { errors, groups, rules };
}

function runNegativeFixtures(profileText) {
  const fixtures = [
    ['missing Bilibili business group', s => s.replace(/^📺 哔哩哔哩 = .*\n/m, '')],
    ['Bilibili state recoupled to global manual', s => s.replaceAll(',📺 哔哩哔哩,extended-matching', ',🚀 手动切换,extended-matching')],
    ['AI loses direct real-node override', s => s.replace(/(🤖 AI服务 = select,[^\n]*?), include-all-proxies=true,/, '$1,')],
    ['region becomes automatic instead of persistent select', s => s.replace('🇺🇸 美国节点 = select,', '🇺🇸 美国节点 = fallback,')],
    ['automatic helper loses fail-closed REJECT', s => s.replace('⚡ 美国自动 = fallback, REJECT,', '⚡ 美国自动 = fallback, DIRECT,')],
    ['automatic helper becomes visible', s => s.replace(/(⚡ 美国自动 = [^\n]*?)hidden=true, /, '$1hidden=false, ')],
    ['regional regex regresses to unsafe single-character matching', s => s.replace(/(🇭🇰 香港节点 = select, ⚡ 香港自动, include-all-proxies=true, policy-regex-filter=)[^,]+(?:,[^,]+)*?, icon-url=/, '$1港, icon-url=')],
    ['smart reintroduced', s => s.replace('⚡ 日本自动 = fallback,', '⚡ 日本自动 = smart,')],
    ['policy cycle introduced', s => s.replace('🚀 手动切换 = select, 🇭🇰 香港节点,', '🚀 手动切换 = select, 🌐 兜底策略, 🇭🇰 香港节点,')],
    ['Final target broken', s => s.replace('FINAL,🌐 兜底策略,dns-failed', 'FINAL,🚀 手动切换,dns-failed')],
    ['General frozen value changed', s => s.replace('ipv6 = false', 'ipv6 = true')]
  ];
  const failures = [];
  for (const [name, mutate] of fixtures) {
    const mutated = mutate(profileText);
    if (mutated === profileText) {
      failures.push(`negative fixture did not mutate input: ${name}`);
      continue;
    }
    const result = validateProfile(mutated, { checkRuleDigest: false });
    if (result.errors.length === 0) failures.push(`negative fixture was not rejected: ${name}`);
  }
  return { failures, count: fixtures.length };
}

const result = validateProfile(text);
const negative = runNegativeFixtures(text);
const allErrors = [...result.errors, ...negative.failures];

if (allErrors.length) {
  console.error(`Surge profile validation FAILED (${allErrors.length} issue${allErrors.length === 1 ? '' : 's'}):`);
  for (const error of allErrors) console.error(`- ${error}`);
  process.exit(1);
}

console.log('Surge profile validation PASS');
console.log(`- General frozen settings: ${GENERAL_BASELINE.size}`);
console.log(`- Core service/global select groups: ${CORE_GROUPS.length}`);
console.log(`- Persistent regional select groups: ${REGION_GROUPS.length}`);
console.log(`- Hidden fail-closed fallback helpers: ${AUTO_GROUPS.length}`);
console.log('- Dynamic scenarios: 13 (0 nodes, partial regions, adversarial names, deduped names, 100-node set)');
console.log(`- Negative fixtures rejected: ${negative.count}`);
console.log('- Rule regression + reference graph + cycle + security gates: PASS');
