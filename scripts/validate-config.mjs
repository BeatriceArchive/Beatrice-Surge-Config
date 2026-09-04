import { readFileSync } from 'node:fs';

const CONFIG_URL = new URL('../Beatrice-Surge.conf', import.meta.url);
const text = readFileSync(CONFIG_URL, 'utf8');
const errors = [];

function check(condition, message) {
    if (!condition) errors.push(message);
}

function meaningfulLines(sectionText) {
    return sectionText
        .split(/\r?\n/)
        .map(line => line.trim())
        .filter(line => line && !line.startsWith('#'));
}

function splitCsv(value) {
    const parts = [];
    let current = '';
    let quote = null;

    for (let index = 0; index < value.length; index += 1) {
        const character = value[index];

        if (quote) {
            current += character;
            if (character === quote && value[index - 1] !== '\\') quote = null;
            continue;
        }

        if (character === '"' || character === "'") {
            quote = character;
            current += character;
            continue;
        }

        if (character === ',') {
            parts.push(current.trim());
            current = '';
            continue;
        }

        current += character;
    }

    parts.push(current.trim());
    return parts.filter(Boolean);
}

check(text.length > 0, 'Beatrice-Surge.conf must not be empty');
check(text.charCodeAt(0) !== 0xFEFF, 'UTF-8 BOM is not allowed');
check(text.endsWith('\n'), 'file must end with a newline');

text.split(/\r?\n/).forEach((line, index) => {
    check(!/[ \t]+$/.test(line), `line ${index + 1}: trailing whitespace`);
});

const sectionMatches = [...text.matchAll(/^\[([^\]\r\n]+)\]\s*$/gm)];
const sectionNames = sectionMatches.map(match => match[1].trim());
const expectedSections = ['General', 'Proxy Group', 'Rule'];
check(
    JSON.stringify(sectionNames) === JSON.stringify(expectedSections),
    `public shell sections must be exactly: ${expectedSections.join(' -> ')}; got: ${sectionNames.join(' -> ')}`
);

function getSection(name) {
    const index = sectionMatches.findIndex(match => match[1].trim() === name);
    if (index < 0) return '';
    const start = sectionMatches[index].index + sectionMatches[index][0].length;
    const end = sectionMatches[index + 1]?.index ?? text.length;
    return text.slice(start, end);
}

const generalLines = meaningfulLines(getSection('General'));
const expectedGeneralLines = [
    'dns-server = system',
    'use-local-host-item-for-proxy = false',
    'compatibility-mode = 3',
    'ipv6 = false',
    'ipv6-vif = disabled',
    'wifi-assist = false',
    'all-hybrid = false',
    'udp-priority = true',
    'udp-policy-not-supported-behaviour = reject',
    'allow-wifi-access = false',
    'allow-hotspot-access = false',
    'proxy-restricted-to-lan = true',
    'include-all-networks = true',
    'include-local-networks = false',
    'include-apns = false',
    'include-cellular-services = false',
    'exclude-simple-hostnames = true',
    'icmp-forwarding = false',
    'loglevel = notify'
];
check(
    JSON.stringify(generalLines) === JSON.stringify(expectedGeneralLines),
    'General baseline drifted from the audited frozen contract'
);

const groupLines = meaningfulLines(getSection('Proxy Group'));
const groupMap = new Map();
for (const line of groupLines) {
    const equalsIndex = line.indexOf('=');
    check(equalsIndex > 0, `invalid Proxy Group line: ${line}`);
    if (equalsIndex <= 0) continue;
    const name = line.slice(0, equalsIndex).trim();
    const value = line.slice(equalsIndex + 1).trim();
    check(!groupMap.has(name), `duplicate Proxy Group: ${name}`);
    groupMap.set(name, value);
}

const coreGroups = ['🚀 手动切换', '🤖 AI服务', '🌍 国外流媒体', '🍎 苹果服务', '🌐 兜底策略'];
const regionGroups = ['🇭🇰 香港节点', '🇯🇵 日本节点', '🇸🇬 新加坡节点', '🇺🇸 美国节点', '🇹🇼 台湾节点'];
const expectedGroups = [...coreGroups, ...regionGroups];
check(
    JSON.stringify([...groupMap.keys()]) === JSON.stringify(expectedGroups),
    `Proxy Group set/order drifted; expected: ${expectedGroups.join(' | ')}`
);

function parseGroup(name, value) {
    const tokens = splitCsv(value);
    const type = (tokens.shift() || '').toLowerCase();
    const members = [];
    const parameters = new Map();

    for (const token of tokens) {
        const parameterMatch = token.match(/^([a-z][a-z0-9-]*)=(.*)$/i);
        if (parameterMatch) {
            parameters.set(parameterMatch[1].toLowerCase(), parameterMatch[2].trim());
        } else {
            members.push(token);
        }
    }

    return { name, type, members, parameters, value };
}

const groupDefs = new Map(
    [...groupMap.entries()].map(([name, value]) => [name, parseGroup(name, value)])
);

const expectedCoreMembers = new Map([
    ['🚀 手动切换', ['🇭🇰 香港节点', '🇯🇵 日本节点', '🇸🇬 新加坡节点', '🇺🇸 美国节点', '🇹🇼 台湾节点']],
    ['🤖 AI服务', ['🇺🇸 美国节点', '🇯🇵 日本节点', '🇸🇬 新加坡节点', '🚀 手动切换']],
    ['🌍 国外流媒体', ['🇭🇰 香港节点', '🇸🇬 新加坡节点', '🇯🇵 日本节点', '🇺🇸 美国节点', '🇹🇼 台湾节点', '🚀 手动切换']],
    ['🍎 苹果服务', ['DIRECT', '🚀 手动切换', '🇭🇰 香港节点', '🇯🇵 日本节点', '🇺🇸 美国节点']],
    ['🌐 兜底策略', ['🚀 手动切换', 'DIRECT']]
]);

for (const [name, expectedMembers] of expectedCoreMembers) {
    const definition = groupDefs.get(name);
    check(definition?.type === 'select', `${name} must remain a select group`);
    check(
        JSON.stringify(definition?.members || []) === JSON.stringify(expectedMembers),
        `${name} explicit member topology drifted`
    );
}

for (const name of ['🚀 手动切换', '🤖 AI服务', '🌍 国外流媒体']) {
    const definition = groupDefs.get(name);
    check(!(definition?.members || []).includes('DIRECT'), `${name} must not contain DIRECT`);
}
check(
    groupDefs.get('🚀 手动切换')?.parameters.get('include-all-proxies') === 'true',
    '🚀 手动切换 must include all injected proxies'
);
check((groupDefs.get('🍎 苹果服务')?.members || []).includes('DIRECT'), '🍎 苹果服务 must retain explicit DIRECT');
check((groupDefs.get('🌐 兜底策略')?.members || []).includes('DIRECT'), '🌐 兜底策略 must retain explicit DIRECT');
check(!groupLines.some(line => /=\s*smart\b/i.test(line)), 'Smart group is forbidden in the frozen fail-closed policy graph');

for (const [name, definition] of groupDefs) {
    const iconUrl = definition.parameters.get('icon-url');
    if (iconUrl) check(/^https:\/\//i.test(iconUrl), `${name} icon-url must use HTTPS`);
}

const regionRegexCases = {
    '🇭🇰 香港节点': {
        positive: ['香港 01', 'HK 01', 'HK-01', 'HK_01', '(HK) 01', '港 01', 'VIP-港-01', 'Hong Kong 01', '🇭🇰 01'],
        negative: ['VIP-港口中转', 'HKG 01']
    },
    '🇯🇵 日本节点': {
        positive: ['日本 01', 'JP 01', 'JP-01', 'JP_01', '(JP) 01', '日 01', 'VIP-日-01', 'Japan 01', '🇯🇵 01'],
        negative: ['VIP-日常节点', 'JPG 01']
    },
    '🇸🇬 新加坡节点': {
        positive: ['新加坡 01', '狮城 01', 'SG 01', 'SG-01', 'SG_01', '(SG) 01', '新 01', 'VIP-新-01', 'Singapore 01', '🇸🇬 01'],
        negative: ['VIP-新节点', 'SGP 01', 'ASGARD 01']
    },
    '🇺🇸 美国节点': {
        positive: ['美国 01', 'US 01', 'US-01', 'US_01', '(US) 01', '美 01', 'VIP-美-01', 'America 01', 'United States 01', '🇺🇸 01'],
        negative: ['VIP-美化线路', 'USA 01', 'RUS 01', 'BUS 01', 'USDT 01']
    },
    '🇹🇼 台湾节点': {
        positive: ['台湾 01', '台灣 01', 'TW 01', 'TW-01', 'TW_01', '(TW) 01', '台 01', 'VIP-台-01', 'Taiwan 01', '🇹🇼 01'],
        negative: ['VIP-台式出口', 'TWN 01', 'TWITTER 01']
    }
};

const regionRegexes = new Map();

for (const name of regionGroups) {
    const definition = groupDefs.get(name);
    check(definition?.type === 'fallback', `${name} must remain a fallback group`);
    check(
        JSON.stringify(definition?.members || []) === JSON.stringify(['REJECT']),
        `${name} must have REJECT as its only explicit member`
    );

    for (const [parameter, expectedValue] of [
        ['include-all-proxies', 'true'],
        ['evaluate-before-use', 'true'],
        ['no-alert', 'true'],
        ['hidden', 'true']
    ]) {
        check(definition?.parameters.get(parameter) === expectedValue, `${name} must set ${parameter}=${expectedValue}`);
    }
    check(definition?.parameters.has('policy-regex-filter'), `${name} missing policy-regex-filter`);

    const source = (definition?.parameters.get('policy-regex-filter') || '').replace(/^\(\?i\)/, '');
    let regex;
    try {
        regex = new RegExp(source, 'i');
        regionRegexes.set(name, regex);
    } catch (error) {
        errors.push(`${name} regex does not compile in the audit harness: ${error.message}`);
        continue;
    }

    for (const sample of regionRegexCases[name].positive) {
        check(regex.test(sample), `${name} regex false negative: ${sample}`);
    }
    for (const sample of regionRegexCases[name].negative) {
        check(!regex.test(sample), `${name} regex false positive: ${sample}`);
    }
}

const builtInPolicies = new Set([
    'DIRECT',
    'REJECT',
    'REJECT-DROP',
    'REJECT-NO-DROP',
    'REJECT-TINYGIF',
    'CELLULAR',
    'CELLULAR-ONLY',
    'HYBRID',
    'NO-HYBRID',
    'PASS'
]);

for (const [name, definition] of groupDefs) {
    for (const member of definition.members) {
        check(
            builtInPolicies.has(member) || groupDefs.has(member),
            `${name} references unknown explicit policy/group "${member}"`
        );
    }
}

const visiting = new Set();
const visited = new Set();

function visitGroup(name, path = []) {
    if (visited.has(name)) return;
    if (visiting.has(name)) {
        const cycleStart = path.indexOf(name);
        const cycle = [...path.slice(Math.max(cycleStart, 0)), name].join(' -> ');
        errors.push(`Proxy Group cycle detected: ${cycle}`);
        return;
    }

    visiting.add(name);
    const definition = groupDefs.get(name);
    for (const member of definition?.members || []) {
        if (groupDefs.has(member)) visitGroup(member, [...path, name]);
    }
    visiting.delete(name);
    visited.add(name);
}

for (const name of groupDefs.keys()) visitGroup(name);

function includedProxies(definition, proxies) {
    if (definition.parameters.get('include-all-proxies') !== 'true') return [];

    const regex = regionRegexes.get(definition.name);
    if (!regex) return proxies;

    return proxies.filter(proxyName => regex.test(proxyName));
}

function terminalPolicies(policyName, proxies, stack = []) {
    if (builtInPolicies.has(policyName)) return new Set([policyName]);
    if (proxies.includes(policyName)) return new Set([`PROXY:${policyName}`]);

    const definition = groupDefs.get(policyName);
    if (!definition) return new Set([`UNKNOWN:${policyName}`]);
    if (stack.includes(policyName)) return new Set([`CYCLE:${[...stack, policyName].join(' -> ')}`]);

    const members = [...definition.members, ...includedProxies(definition, proxies)];

    // Surge substitutes an actually empty policy group with DIRECT.
    if (members.length === 0) return new Set(['DIRECT']);

    const terminals = new Set();
    for (const member of members) {
        for (const terminal of terminalPolicies(member, proxies, [...stack, policyName])) {
            terminals.add(terminal);
        }
    }
    return terminals;
}

const syntheticProxyScenarios = [
    { name: 'empty', proxies: [] },
    { name: 'single-hk', proxies: ['🇭🇰 香港 01'] },
    { name: 'single-jp', proxies: ['JP-01'] },
    { name: 'single-us', proxies: ['US 01'] },
    { name: 'single-sg', proxies: ['SG_01'] },
    { name: 'single-tw', proxies: ['TW (01)'] },
    { name: 'all-hk', proxies: ['HK-01', '港 02', 'Hong Kong (03)'] },
    { name: 'unknown-region', proxies: ['Premium Alpha', 'Node_02', 'VIP (03)'] },
    { name: 'mixed', proxies: ['🇭🇰 HK-01', 'JP_02', 'SG/03', 'US (04)', 'TW-05', 'Premium 06'] },
    { name: 'chinese-single-char', proxies: ['VIP-港-01', 'VIP_日_02', 'VIP/新/03', 'VIP(美)04', 'VIP 台 05'] },
    { name: 'false-positive-chinese', proxies: ['VIP-港口中转', 'VIP-日常节点', 'VIP-新节点', 'VIP-美化线路', 'VIP-台式出口'] },
    { name: 'false-positive-codes', proxies: ['HKG 01', 'JPG 01', 'SGP 01', 'USA 01', 'TWN 01', 'RUS 01', 'BUS 01', 'USDT 01', 'TWITTER 01', 'ASGARD 01'] }
];

for (const scenario of syntheticProxyScenarios) {
    for (const name of [...regionGroups, '🚀 手动切换', '🤖 AI服务', '🌍 国外流媒体']) {
        const terminals = terminalPolicies(name, scenario.proxies);
        check(terminals.size > 0, `${scenario.name}: ${name} resolved to no terminal policies`);
        check(!terminals.has('DIRECT'), `${scenario.name}: ${name} can reach accidental DIRECT`);
        check(
            ![...terminals].some(terminal => terminal.startsWith('UNKNOWN:') || terminal.startsWith('CYCLE:')),
            `${scenario.name}: ${name} has unresolved or cyclic terminal policies: ${[...terminals].join(' | ')}`
        );
    }

    if (scenario.name === 'unknown-region') {
        const manualTerminals = terminalPolicies('🚀 手动切换', scenario.proxies);
        for (const proxyName of scenario.proxies) {
            check(
                manualTerminals.has(`PROXY:${proxyName}`),
                `unknown-region: 🚀 手动切换 must retain unclassified injected proxy "${proxyName}"`
            );
        }
    }

    if (scenario.name.startsWith('false-positive-')) {
        for (const regionName of regionGroups) {
            const regionTerminals = terminalPolicies(regionName, scenario.proxies);
            check(
                JSON.stringify([...regionTerminals]) === JSON.stringify(['REJECT']),
                `${scenario.name}: ${regionName} must reject instead of misclassifying a node`
            );
        }
    }
}

const ruleLines = meaningfulLines(getSection('Rule'));
const duplicateRuleCheck = new Set();
for (const line of ruleLines) {
    check(!duplicateRuleCheck.has(line), `duplicate rule: ${line}`);
    duplicateRuleCheck.add(line);
}

check(!ruleLines.some(line => /^MATCH\s*,/i.test(line)), 'MATCH is forbidden; use FINAL');
const finalRules = ruleLines.filter(line => /^FINAL\s*,/i.test(line));
check(finalRules.length === 1, `expected exactly one FINAL rule; got ${finalRules.length}`);
check(ruleLines.at(-1) === 'FINAL,🌐 兜底策略,dns-failed', 'FINAL must be the last rule and target 🌐 兜底策略 with dns-failed');
check(ruleLines[0] === 'RULE-SET,LAN,DIRECT,no-resolve', 'LAN must remain the first rule and use no-resolve');

const allowedPolicies = new Set([...expectedGroups, ...builtInPolicies]);
for (const line of ruleLines) {
    const parts = splitCsv(line);
    const type = (parts[0] || '').toUpperCase();
    const policy = type === 'FINAL' ? parts[1] : parts[2];
    check(Boolean(policy), `rule has no policy: ${line}`);
    if (policy) check(allowedPolicies.has(policy), `rule references unknown policy "${policy}": ${line}`);

    if ((type === 'RULE-SET' || type === 'DOMAIN-SET') && /^https?:\/\//i.test(parts[1] || '')) {
        check(/^https:\/\//i.test(parts[1]), `external ${type} must use HTTPS: ${parts[1]}`);
    }

    const isIpRule =
        ['IP-CIDR', 'IP-CIDR6', 'GEOIP', 'IP-ASN'].includes(type) ||
        (type === 'RULE-SET' && /\/List\/ip\//i.test(parts[1] || ''));
    if (isIpRule) {
        check(parts.includes('no-resolve'), `IP-based rule must use no-resolve: ${line}`);
    }
}

function ruleIndex(prefix) {
    return ruleLines.findIndex(line => line.startsWith(prefix));
}

const orderingCheckpoints = [
    ['DOMAIN,api.github.com,🌐 兜底策略,extended-matching', 'RULE-SET,https://ruleset.skk.moe/List/non_ip/ai.conf,🤖 AI服务,extended-matching'],
    ['RULE-SET,https://ruleset.skk.moe/List/non_ip/apple_intelligence.conf,🤖 AI服务,extended-matching', 'RULE-SET,SYSTEM,DIRECT'],
    ['RULE-SET,https://ruleset.skk.moe/List/non_ip/ai.conf,🤖 AI服务,extended-matching', 'RULE-SET,SYSTEM,DIRECT'],
    ['RULE-SET,SYSTEM,DIRECT', 'RULE-SET,https://ruleset.skk.moe/List/non_ip/apple_services.conf,🍎 苹果服务,no-resolve,extended-matching'],
    ['RULE-SET,https://ruleset.skk.moe/List/non_ip/apple_services.conf,🍎 苹果服务,no-resolve,extended-matching', 'DOMAIN-SUFFIX,youtube.com,🌍 国外流媒体,extended-matching'],
    ['DOMAIN-SUFFIX,youtube.com,🌍 国外流媒体,extended-matching', 'DOMAIN-SUFFIX,b23.tv,🚀 手动切换,extended-matching'],
    ['DOMAIN-SUFFIX,b23.tv,🚀 手动切换,extended-matching', 'DOMAIN-SUFFIX,cn,DIRECT,extended-matching'],
    ['DOMAIN-SUFFIX,cn,DIRECT,extended-matching', 'RULE-SET,https://ruleset.skk.moe/List/non_ip/domestic.conf,DIRECT,extended-matching'],
    ['RULE-SET,https://ruleset.skk.moe/List/non_ip/domestic.conf,DIRECT,extended-matching', 'RULE-SET,https://ruleset.skk.moe/List/ip/ai.conf,🤖 AI服务,no-resolve'],
    ['RULE-SET,https://ruleset.skk.moe/List/ip/ai.conf,🤖 AI服务,no-resolve', 'RULE-SET,https://ruleset.skk.moe/List/ip/china_ip.conf,DIRECT,no-resolve'],
    ['RULE-SET,https://ruleset.skk.moe/List/ip/china_ip.conf,DIRECT,no-resolve', 'GEOIP,CN,DIRECT,no-resolve'],
    ['GEOIP,CN,DIRECT,no-resolve', 'FINAL,🌐 兜底策略,dns-failed']
];

for (const [earlier, later] of orderingCheckpoints) {
    const earlierIndex = ruleIndex(earlier);
    const laterIndex = ruleIndex(later);
    check(earlierIndex >= 0, `missing rule-order checkpoint: ${earlier}`);
    check(laterIndex >= 0, `missing rule-order checkpoint: ${later}`);
    if (earlierIndex >= 0 && laterIndex >= 0) {
        check(earlierIndex < laterIndex, `rule ordering invariant violated: "${earlier}" must precede "${later}"`);
    }
}

const activeLines = text
    .split(/\r?\n/)
    .map(line => line.trim())
    .filter(line => line && !line.startsWith('#'));
const activeText = activeLines.join('\n');

check(!/^#!MANAGED-CONFIG\b/im.test(text), 'public shell must not contain a managed subscription URL');
check(
    !/(?:^|,)\s*(?:password|username|private-key|private_key|client-secret|client_secret|token|psk|auth-key)\s*=/im.test(activeText),
    'public shell appears to contain a credential assignment'
);
check(
    !activeLines.some(line => /^[^=\r\n#]+\s*=\s*(?:http|https|socks5|ss|vmess|trojan|vless|snell|hysteria2?|tuic(?:-v5)?|anytls|trust-tunnel|ssh|wireguard|tailscale|external)\s*,/i.test(line)),
    'public shell must not contain proxy node declarations'
);

if (errors.length > 0) {
    console.error(`Surge config validation failed with ${errors.length} error(s):`);
    for (const error of errors) console.error(`- ${error}`);
    process.exitCode = 1;
} else {
    console.log(
        `Surge config validation passed: ${generalLines.length} General settings, ${groupLines.length} policy groups, ` +
        `${ruleLines.length} rules, ${syntheticProxyScenarios.length} synthetic proxy scenarios.`
    );
}
