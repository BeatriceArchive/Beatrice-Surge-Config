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

for (const name of ['🚀 手动切换', '🤖 AI服务', '🌍 国外流媒体']) {
    const value = groupMap.get(name) || '';
    check(!/(^|,\s*)DIRECT(\s*,|$)/.test(value), `${name} must not contain DIRECT`);
}
check((groupMap.get('🚀 手动切换') || '').includes('include-all-proxies=true'), '🚀 手动切换 must include all injected proxies');
check(/(^|,\s*)DIRECT(\s*,|$)/.test(groupMap.get('🍎 苹果服务') || ''), '🍎 苹果服务 must retain explicit DIRECT');
check(/(^|,\s*)DIRECT(\s*,|$)/.test(groupMap.get('🌐 兜底策略') || ''), '🌐 兜底策略 must retain explicit DIRECT');
check(!groupLines.some(line => /=\s*smart\b/i.test(line)), 'Smart group is forbidden in the frozen fail-closed policy graph');

const regionRegexCases = {
    '🇭🇰 香港节点': {
        positive: ['香港 01', 'HK 01', '港 01', 'VIP-港-01', 'Hong Kong 01', '🇭🇰 01'],
        negative: ['VIP-港口中转', 'HKG 01']
    },
    '🇯🇵 日本节点': {
        positive: ['日本 01', 'JP 01', '日 01', 'VIP-日-01', 'Japan 01', '🇯🇵 01'],
        negative: ['VIP-日常节点', 'JPG 01']
    },
    '🇸🇬 新加坡节点': {
        positive: ['新加坡 01', '狮城 01', 'SG 01', '新 01', 'Singapore 01', '🇸🇬 01'],
        negative: ['VIP-新节点', 'SGP 01', 'ASGARD 01']
    },
    '🇺🇸 美国节点': {
        positive: ['美国 01', 'US 01', '美 01', 'America 01', 'United States 01', '🇺🇸 01'],
        negative: ['VIP-美化线路', 'USA 01', 'RUS 01', 'BUS 01', 'USDT 01']
    },
    '🇹🇼 台湾节点': {
        positive: ['台湾 01', '台灣 01', 'TW 01', '台 01', 'Taiwan 01', '🇹🇼 01'],
        negative: ['VIP-台式出口', 'TWN 01', 'TWITTER 01']
    }
};

for (const name of regionGroups) {
    const value = groupMap.get(name) || '';
    check(value.startsWith('fallback, REJECT,'), `${name} must fail closed with fallback, REJECT`);
    for (const required of [
        'include-all-proxies=true',
        'policy-regex-filter=',
        'evaluate-before-use=true',
        'no-alert=true',
        'hidden=true',
        'icon-url=https://'
    ]) {
        check(value.includes(required), `${name} missing ${required}`);
    }

    const marker = 'policy-regex-filter=';
    const regexStart = value.indexOf(marker);
    const regexEnd = value.indexOf(', evaluate-before-use=', regexStart + marker.length);
    check(regexStart >= 0 && regexEnd > regexStart, `${name} has an unreadable policy-regex-filter`);
    if (regexStart < 0 || regexEnd <= regexStart) continue;

    const source = value.slice(regexStart + marker.length, regexEnd).replace(/^\(\?i\)/, '');
    let regex;
    try {
        regex = new RegExp(source, 'i');
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

const allowedPolicies = new Set([...expectedGroups, 'DIRECT', 'REJECT', 'REJECT-DROP', 'PASS']);
for (const line of ruleLines) {
    const parts = line.split(',').map(part => part.trim());
    const type = (parts[0] || '').toUpperCase();
    const policy = type === 'FINAL' ? parts[1] : parts[2];
    check(Boolean(policy), `rule has no policy: ${line}`);
    if (policy) check(allowedPolicies.has(policy), `rule references unknown policy "${policy}": ${line}`);

    if (type === 'RULE-SET' && /^https?:\/\//i.test(parts[1] || '')) {
        check(/^https:\/\//i.test(parts[1]), `external RULE-SET must use HTTPS: ${parts[1]}`);
    }
}

const activeLines = text
    .split(/\r?\n/)
    .map(line => line.trim())
    .filter(line => line && !line.startsWith('#'));
const activeText = activeLines.join('\n');

check(!/^#!MANAGED-CONFIG\b/im.test(text), 'public shell must not contain a managed subscription URL');
check(
    !/(?:^|,)\s*(?:password|username|private-key|private_key|client-secret|client_secret|token)\s*=/im.test(activeText),
    'public shell appears to contain a credential assignment'
);
check(
    !activeLines.some(line => /^[^=\r\n#]+\s*=\s*(?:ss|vmess|trojan|vless|snell|hysteria2?|tuic|wireguard)\s*,/i.test(line)),
    'public shell must not contain proxy node declarations'
);

if (errors.length > 0) {
    console.error(`Surge config validation failed with ${errors.length} error(s):`);
    for (const error of errors) console.error(`- ${error}`);
    process.exitCode = 1;
} else {
    console.log(`Surge config validation passed: ${generalLines.length} General settings, ${groupLines.length} policy groups, ${ruleLines.length} rules.`);
}
