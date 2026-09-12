import { readFileSync } from 'node:fs';

const configPath = process.argv[2] || 'Beatrice-Surge.conf';
const modulePath = process.argv[3] || '../Beatrice-Surge-Modules/Modules/Beatrice-Surge-System.sgmodule';
const config = readFileSync(configPath, 'utf8');
const systemModule = readFileSync(modulePath, 'utf8');

const REQUIRED_SYSTEM_OVERRIDES = new Map([
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

function generalSettings(text) {
  const body = text.match(/^\[General\]\r?\n([\s\S]*?)(?=^\[|$(?![\s\S]))/m)?.[1];
  if (body === undefined) throw new Error('missing [General] section');
  const entries = body.split(/\r?\n/)
    .map(line => line.trim())
    .filter(line => line && !line.startsWith('#'))
    .map(line => {
      const index = line.indexOf('=');
      if (index < 1) throw new Error(`invalid [General] line: ${line}`);
      return [line.slice(0, index).trim(), line.slice(index + 1).trim()];
    });
  return new Map(entries);
}

const configGeneral = generalSettings(config);
const moduleGeneral = generalSettings(systemModule);
const errors = [];

for (const [key, expected] of REQUIRED_SYSTEM_OVERRIDES) {
  if (configGeneral.get(key) !== expected) errors.push(`Config ${key} must be ${expected}`);
  if (moduleGeneral.get(key) !== expected) errors.push(`System module ${key} must be ${expected}`);
}

for (const [key, value] of moduleGeneral) {
  if (configGeneral.get(key) !== value) {
    errors.push(`System module conflicts with Config: ${key}=${value}`);
  }
}

if (errors.length) {
  console.error(`Public Surge contract validation FAILED (${errors.length} issues):`);
  for (const error of errors) console.error(`- ${error}`);
  process.exit(1);
}

console.log(`Public Surge contract PASS: ${REQUIRED_SYSTEM_OVERRIDES.size} frozen General settings agree`);
