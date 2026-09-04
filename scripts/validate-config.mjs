import fs from 'node:fs';
import crypto from 'node:crypto';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const configPath = process.env.SURGE_CONFIG_PATH || fileURLToPath(new URL('../Beatrice-Surge.conf', import.meta.url));
const text = fs.readFileSync(configPath, 'utf8').replace(/\r\n/g, '\n');
const errors = [];
const fail = msg => errors.push(msg);
const same = (a, b) => a.length === b.length && a.every((v, i) => v === b[i]);
const csv = s => s.split(',').map(x => x.trim()).filter(Boolean);

const GENERAL = new Map([
  ['dns-server','system'],['use-local-host-item-for-proxy','false'],['compatibility-mode','3'],
  ['ipv6','false'],['ipv6-vif','disabled'],['wifi-assist','false'],['all-hybrid','false'],
  ['udp-priority','true'],['udp-policy-not-supported-behaviour','reject'],['allow-wifi-access','false'],
  ['allow-hotspot-access','false'],['proxy-restricted-to-lan','true'],['include-all-networks','true'],
  ['include-local-networks','false'],['include-apns','false'],['include-cellular-services','false'],
  ['exclude-simple-hostnames','true'],['icmp-forwarding','false'],['loglevel','notify']
]);

const core = ['🚀 手动切换','🤖 AI服务','🌍 国外流媒体','📺 哔哩哔哩','🍎 苹果服务','🌐 兜底策略'];
const compact = core.slice(1);
const regions = [
  ['🇭🇰 香港节点','⚡ 香港自动','(?i)(🇭🇰|香港|Hong Kong|(^|[- _/|()])港($|[- _/|()0-9])|(^|[^A-Za-z])HK([^A-Za-z]|$))',['香港 01','HK-01','HK01','Hong Kong','🇭🇰','VIP-港-01'],['VIP-港口中转','HKG 01','BANKHK']],
  ['🇯🇵 日本节点','⚡ 日本自动','(?i)(🇯🇵|日本|Japan|(^|[- _/|()])日($|[- _/|()0-9])|(^|[^A-Za-z])JP([^A-Za-z]|$))',['日本 01','JP-01','JP01','Japan','🇯🇵','VIP-日-01'],['VIP-日常节点','JPG 01','JPN 01']],
  ['🇸🇬 新加坡节点','⚡ 新加坡自动','(?i)(🇸🇬|新加坡|狮城|Singapore|(^|[- _/|()])新($|[- _/|()0-9])|(^|[^A-Za-z])SG([^A-Za-z]|$))',['新加坡 01','SG-01','SG01','Singapore','🇸🇬','VIP-新-01'],['VIP-新节点','SGP 01','ASGARD 01']],
  ['🇺🇸 美国节点','⚡ 美国自动','(?i)(🇺🇸|美国|美國|United States|America|(^|[- _/|()])美($|[- _/|()0-9])|(^|[^A-Za-z])US([^A-Za-z]|$))',['美国 01','US-01','US01','America','🇺🇸','VIP-美-01'],['VIP-美化线路','USA 01','RUS 01','USDT 01']],
  ['🇹🇼 台湾节点','⚡ 台湾自动','(?i)(🇹🇼|台湾|台灣|Taiwan|(^|[- _/|()])台($|[- _/|()0-9])|(^|[^A-Za-z])TW([^A-Za-z]|$))',['台湾 01','TW-01','TW01','Taiwan','🇹🇼','VIP-台-01'],['VIP-台式出口','TWN 01','TWITTER 01']]
];
const regional = regions.map(x => x[0]);
const auto = regions.map(x => x[1]);
const expectedOrder = [...core, ...regional, ...auto];
const expectedMembers = new Map([
  ['🚀 手动切换',regional],
  ['🤖 AI服务',['🇺🇸 美国节点','🇯🇵 日本节点','🇸🇬 新加坡节点','🚀 手动切换']],
  ['🌍 国外流媒体',['🇭🇰 香港节点','🇸🇬 新加坡节点','🇯🇵 日本节点','🇺🇸 美国节点','🇹🇼 台湾节点','🚀 手动切换']],
  ['📺 哔哩哔哩',['🇭🇰 香港节点','🇹🇼 台湾节点','🇯🇵 日本节点','🚀 手动切换']],
  ['🍎 苹果服务',['DIRECT','🇭🇰 香港节点','🇯🇵 日本节点','🇺🇸 美国节点','🚀 手动切换']],
  ['🌐 兜底策略',['🚀 手动切换','DIRECT','🇭🇰 香港节点','🇯🇵 日本节点','🇸🇬 新加坡节点','🇺🇸 美国节点','🇹🇼 台湾节点']]
]);
const builtins = new Set(['DIRECT','REJECT','REJECT-DROP','REJECT-NO-DROP','REJECT-TINYGIF','CELLULAR','CELLULAR-ONLY','HYBRID','NO-HYBRID','PASS']);

function sections(src) {
  const out = new Map(); let name = null;
  for (const raw of src.split('\n')) {
    const m = raw.match(/^\[([^\]]+)\]$/);
    if (m) { name = m[1]; if (out.has(name)) fail(`duplicate section [${name}]`); out.set(name, []); continue; }
    if (name) out.get(name).push(raw);
  }
  return out;
}
function active(lines=[]) { return lines.map(x=>x.trim()).filter(x=>x && !x.startsWith('#')); }
function parseGroups(lines) {
  const groups = new Map(), order=[];
  for (const raw of active(lines)) {
    const i=raw.indexOf('='); if(i<1){fail(`invalid group line: ${raw}`);continue;}
    const name=raw.slice(0,i).trim(), parts=csv(raw.slice(i+1));
    const members=[], params=new Map();
    for(const t of parts.slice(1)){const j=t.indexOf('='); if(j>0) params.set(t.slice(0,j).trim(),t.slice(j+1).trim()); else members.push(t);}
    if(groups.has(name)) fail(`duplicate group ${name}`);
    groups.set(name,{type:(parts[0]||'').toLowerCase(),members,params}); order.push(name);
  }
  return {groups,order};
}
function surgeRe(s){let f=''; if(s.startsWith('(?i)')){s=s.slice(4);f='i';} return new RegExp(s,f);}
function imported(g,nodes){
  if(!g || g.params.get('include-all-proxies')!=='true') return [];
  const f=g.params.get('policy-regex-filter'); if(!f) return [...nodes];
  const r=surgeRe(f); return nodes.filter(x=>r.test(x));
}
function cycles(groups){
  const seen=new Map(), stack=[];
  function visit(n){const s=seen.get(n)||0;if(s===1){fail(`policy cycle: ${[...stack,n].join(' -> ')}`);return;}if(s===2)return;seen.set(n,1);stack.push(n);for(const m of groups.get(n)?.members||[])if(groups.has(m))visit(m);stack.pop();seen.set(n,2);}
  for(const n of groups.keys())visit(n);
}

const sec = sections(text);
if(!same([...sec.keys()],['General','Proxy Group','Rule'])) fail(`sections must be exactly [General] -> [Proxy Group] -> [Rule]`);
if(sec.has('Proxy')) fail('public shell must not contain [Proxy]');

const general = new Map();
for(const raw of active(sec.get('General'))){const i=raw.indexOf('='); if(i<1){fail(`invalid General line: ${raw}`);continue;}general.set(raw.slice(0,i).trim(),raw.slice(i+1).trim());}
for(const [k,v] of GENERAL) if(general.get(k)!==v) fail(`[General] ${k} must remain ${v}`);
for(const k of general.keys()) if(!GENERAL.has(k)) fail(`[General] unexpected active key: ${k}`);

const {groups,order}=parseGroups(sec.get('Proxy Group'));
if(!same(order,expectedOrder)) fail(`[Proxy Group] order/names changed`);
for(const [name,members] of expectedMembers){
  const g=groups.get(name); if(!g){fail(`missing core group ${name}`);continue;}
  if(g.type!=='select') fail(`${name} must be select`);
  if(!same(g.members,members)) fail(`${name} explicit members changed`);
  if(g.params.get('hidden')==='true') fail(`${name} must remain visible`);
}
if(groups.get('🚀 手动切换')?.params.get('include-all-proxies')!=='true') fail('🚀 手动切换 must include-all-proxies=true');
for(const name of compact){
  const g=groups.get(name); if(!g) continue;
  for(const p of ['include-all-proxies','include-other-group','policy-path']) if(g.params.has(p)) fail(`${name} must stay compact and not directly import proxy lists (${p})`);
  if(g.params.has('policy-regex-filter')) fail(`${name} must not carry a direct-node filter`);
}
for(const [manual,helper,regex,pos,neg] of regions){
  const m=groups.get(manual), h=groups.get(helper);
  if(!m||!h){fail(`missing regional pair ${manual} / ${helper}`);continue;}
  if(m.type!=='select'||!same(m.members,[helper])) fail(`${manual} must be select -> ${helper}`);
  if(m.params.get('include-all-proxies')!=='true'||m.params.get('policy-regex-filter')!==regex) fail(`${manual} direct regional node import changed`);
  if(m.params.get('hidden')==='true') fail(`${manual} must remain visible`);
  if(h.type!=='fallback'||!same(h.members,['REJECT'])) fail(`${helper} must be fallback, REJECT`);
  if(h.params.get('include-all-proxies')!=='true'||h.params.get('policy-regex-filter')!==regex) fail(`${helper} regional import changed`);
  if(h.params.get('evaluate-before-use')!=='true'||h.params.get('no-alert')!=='true'||h.params.get('hidden')!=='true') fail(`${helper} helper flags changed`);
  const r=surgeRe(regex); for(const s of pos) if(!r.test(s)) fail(`${manual} regex missed ${s}`); for(const s of neg) if(r.test(s)) fail(`${manual} regex false-positive ${s}`);
}
for(const [name,g] of groups){
  if(g.type==='smart') fail(`${name}: smart is forbidden`);
  for(const m of g.members) if(!groups.has(m)&&!builtins.has(m)) fail(`${name} references undefined policy ${m}`);
}
cycles(groups);

const rules=active(sec.get('Rule')).map(raw=>{const f=csv(raw),t=(f[0]||'').toUpperCase();return{raw,f,t,policy:t==='FINAL'?f[1]:f[2]};});
if(rules[0]?.raw!=='RULE-SET,LAN,DIRECT,no-resolve') fail('LAN rule must remain first');
if(rules.at(-1)?.raw!=='FINAL,🌐 兜底策略,dns-failed') fail('FINAL must remain final and target 🌐 兜底策略');
if(rules.filter(x=>x.t==='FINAL').length!==1) fail('must contain exactly one FINAL');
const seenRules=new Set();
for(const r of rules){
  if(seenRules.has(r.raw)) fail(`duplicate rule ${r.raw}`); seenRules.add(r.raw);
  if(r.t==='MATCH') fail('MATCH is forbidden');
  if(r.policy&&!groups.has(r.policy)&&!builtins.has(r.policy)) fail(`undefined rule policy ${r.policy}`);
  if(r.t==='RULE-SET'&&/^http:\/\//i.test(r.f[1]||'')) fail(`external RULE-SET must use HTTPS: ${r.raw}`);
  if((r.t.startsWith('IP-')||(r.t==='RULE-SET'&&/\/ip\//i.test(r.f[1]||'')))&&!r.f.includes('no-resolve')) fail(`IP-bound rule lost no-resolve: ${r.raw}`);
}
const checkpoints=[
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
let last=-1; for(const c of checkpoints){const i=rules.findIndex(x=>x.raw===c); if(i<0) fail(`missing rule checkpoint ${c}`); else if(i<=last) fail(`rule ordering regression ${c}`); else last=i;}
const bili=rules.filter(r=>/(^|,)(b23\.tv|[^,]*bili[^,]*|upos-bstar[^,]*)/i.test(r.raw));
if(bili.length<20) fail('Bilibili rule corpus unexpectedly small'); for(const r of bili) if(r.policy!=='📺 哔哩哔哩') fail(`Bilibili rule not using independent policy: ${r.raw}`);
const hash=crypto.createHash('sha256').update(rules.map(x=>x.raw).join('\n')).digest('hex');
if(hash!=='995f5cbbca7a477f758360580549ebb431e6a35be43eb576d273081e4b9705d6') fail(`[Rule] semantic digest changed: ${hash}`);

if(/^\s*#!MANAGED-CONFIG\b/im.test(text)) fail('public shell must not contain managed-config');
if(/^\s*\[Proxy\]\s*$/im.test(text)) fail('public shell must not declare [Proxy]');
if(/^\s*[^#\[\n]+\s*=\s*(ss|vmess|trojan|snell|tuic|hysteria2|anytls|wireguard|http|https|socks5|socks5-tls)\s*,/im.test(text)) fail('public shell contains concrete proxy node');
if(/\b(password|private-key|username|token)\s*=\s*[^\s,#]+/i.test(text)) fail('public shell appears to contain credentials');

const scenarios=[
  [], ['香港 01'], ['US-01'], ['JP_01'], ['Singapore 01'], ['TW01'],
  ['香港 01','US-01','Unclassified 01'],
  ['HK-01','JP-01','SG-01','US-01','TW-01'],
  ['VIP-港-01','VIP-日-01','VIP-新-01','VIP-美-01','VIP-台-01'],
  ['VIP-港口中转','VIP-日常节点','VIP-新节点','VIP-美化线路','VIP-台式出口'],
  ['HKG 01','JPG 01','SGP 01','USA 01','TWN 01','RUS 01','USDT 01','TWITTER 01'],
  ['US-01','US-01_1','香港 01','香港 01_1'],
  Array.from({length:100},(_,i)=>`${['HK','JP','SG','US','TW'][i%5]}-${String(i+1).padStart(2,'0')}`)
];
for(const nodes of scenarios){
  if(imported(groups.get('🚀 手动切换'),nodes).length!==nodes.length) fail('🚀 手动切换 no longer exposes all real nodes');
  for(const name of compact) if(imported(groups.get(name),nodes).length) fail(`${name} directly exposes raw proxies`);
  for(const [manual,helper] of regions){const hm=groups.get(helper); if((hm?.members||[])[0]!=='REJECT') fail(`${helper} lost REJECT safety`); if(nodes.length===0&&imported(hm,nodes).length!==0) fail(`${helper} imports proxies in zero-node scenario`); if((groups.get(manual)?.members||[])[0]!==helper) fail(`${manual} no longer defaults to ${helper}`);}
}

if (!errors.length && process.env.SKIP_NEGATIVE_FIXTURES !== '1') {
  const fixtures = [
    ['AI raw-node flood', src => src.replace(/(🤖 AI服务 = select,[^\n]*?)(, icon-url=)/, '$1, include-all-proxies=true$2')],
    ['Final raw-node flood', src => src.replace(/(🌐 兜底策略 = select,[^\n]*?)(, icon-url=)/, '$1, include-all-proxies=true$2')],
    ['manual loses raw-node import', src => src.replace('🚀 手动切换 = select, 🇭🇰 香港节点, 🇯🇵 日本节点, 🇸🇬 新加坡节点, 🇺🇸 美国节点, 🇹🇼 台湾节点, include-all-proxies=true,', '🚀 手动切换 = select, 🇭🇰 香港节点, 🇯🇵 日本节点, 🇸🇬 新加坡节点, 🇺🇸 美国节点, 🇹🇼 台湾节点,')],
    ['helper loses REJECT', src => src.replace('⚡ 美国自动 = fallback, REJECT,', '⚡ 美国自动 = fallback, DIRECT,')],
    ['regional group becomes hidden', src => src.replace('🇺🇸 美国节点 = select, ⚡ 美国自动,', '🇺🇸 美国节点 = select, ⚡ 美国自动, hidden=true,')],
    ['policy cycle introduced', src => src.replace('🚀 手动切换 = select, 🇭🇰 香港节点,', '🚀 手动切换 = select, 🌐 兜底策略, 🇭🇰 香港节点,')],
    ['General frozen value changed', src => src.replace('ipv6 = false', 'ipv6 = true')],
    ['Final target changed', src => src.replace('FINAL,🌐 兜底策略,dns-failed', 'FINAL,🚀 手动切换,dns-failed')]
  ];
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'beatrice-surge-validator-'));
  try {
    for (const [name, mutate] of fixtures) {
      const mutated = mutate(text);
      if (mutated === text) { fail(`negative fixture did not mutate: ${name}`); continue; }
      const fixturePath = path.join(dir, `${fixtures.indexOf(fixtures.find(x => x[0] === name))}.conf`);
      fs.writeFileSync(fixturePath, mutated);
      const result = spawnSync(process.execPath, [fileURLToPath(import.meta.url)], {
        env: { ...process.env, SURGE_CONFIG_PATH: fixturePath, SKIP_NEGATIVE_FIXTURES: '1' },
        encoding: 'utf8'
      });
      if (result.status === 0) fail(`negative fixture was not rejected: ${name}`);
    }
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
}

if(errors.length){console.error(`Surge profile validation FAILED (${errors.length} issues):`); for(const e of errors) console.error(`- ${e}`); process.exit(1);}
console.log('Surge profile validation PASS');
console.log(`- General frozen settings: ${GENERAL.size}`);
console.log(`- Compact service groups without raw proxy flood: ${compact.length}`);
console.log(`- Persistent regional select groups: ${regional.length}`);
console.log(`- Hidden fail-closed fallback helpers: ${auto.length}`);
console.log(`- Dynamic scenarios: ${scenarios.length}`);
console.log('- Negative fixtures rejected: 8');
console.log('- Rule regression + policy graph + regex + dynamic proxy exposure gates: PASS');
