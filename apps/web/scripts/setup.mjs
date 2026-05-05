import { createInterface } from 'node:readline/promises';
import { stdin, stdout } from 'node:process';
import { writeFileSync, readFileSync, existsSync, unlinkSync } from 'node:fs';
import { resolve, join } from 'node:path';
import { homedir } from 'node:os';

const CONFIG_PATH = resolve(import.meta.dirname, '..', 'app-config.json');
const NPMRC_PATH = join(homedir(), '.npmrc');
const FONTAWESOME_DEFAULT_TOKEN = '9A19FB16-1249-4387-ABA9-3C7AAF25C709';

const tokensOnly = process.argv.includes('--tokens-only');
const force = process.argv.includes('--force');

// ── Token helpers ─────────────────────────────────────────

function detectShellProfile() {
  const shell = process.env.SHELL || '';
  if (shell.endsWith('/zsh')) return join(homedir(), '.zshrc');
  if (shell.endsWith('/bash')) return join(homedir(), '.bashrc');
  return null;
}

function upsertExport(content, varName, value) {
  const line = `export ${varName}='${value}'`;
  const re = new RegExp(`^export\\s+${varName}=.*$`, 'm');
  if (re.test(content)) return content.replace(re, line);
  return content.trimEnd() + '\n' + line + '\n';
}

function warnLegacyNpmrc() {
  if (!existsSync(NPMRC_PATH)) return;
  const content = readFileSync(NPMRC_PATH, 'utf8');
  const legacyGh = /^\/\/npm\.pkg\.github\.com\/:_authToken=/m.test(content);
  const legacyFa = /^\/\/npm\.fontawesome\.com\/:_authToken=/m.test(content);
  if (!legacyGh && !legacyFa) return;

  console.log('');
  console.log('  ⚠  Legacy registry tokens detected in ~/.npmrc.');
  console.log('     The project .npmrc now uses ${NPM_TOKEN}/${FONTAWESOME_TOKEN}');
  console.log('     substitution, which overrides user-level tokens. Safe to remove:');
  if (legacyGh) console.log('       //npm.pkg.github.com/:_authToken=…');
  if (legacyFa) console.log('       //npm.fontawesome.com/:_authToken=…');
}

async function configureTokens(_rl, ask, askYN) {
  const envNpm = process.env.NPM_TOKEN || '';
  const envFa = process.env.FONTAWESOME_TOKEN || '';

  if (envNpm && envFa) {
    console.log('  ✓ NPM_TOKEN and FONTAWESOME_TOKEN already set in environment');
    warnLegacyNpmrc();
    return;
  }

  console.log('  Registry Tokens');
  console.log('  ─────────────────');
  console.log('  npm authenticates via env-var substitution in the committed .npmrc.');
  console.log('  Tokens go in your shell profile as exports, not in ~/.npmrc.');
  console.log('');

  let npmToken = envNpm;
  if (!npmToken) {
    console.log('  GitHub PAT with read:packages scope (SSO-authorized for opensided org).');
    console.log('  Create one at: https://github.com/settings/tokens/new?scopes=read:packages');
    console.log('');
    while (!npmToken) {
      npmToken = await ask('GitHub Personal Access Token');
      if (!npmToken) {
        console.log('  Token is required to install @opensided packages.');
      } else if (!npmToken.startsWith('ghp_') && !npmToken.startsWith('github_pat_')) {
        console.log('  Warning: token doesn\'t start with ghp_ or github_pat_ — double-check it.');
      }
    }
  } else {
    console.log('  ✓ NPM_TOKEN already set in environment');
  }

  let faToken = envFa;
  if (!faToken) {
    console.log('');
    faToken = await ask('Font Awesome Pro token', FONTAWESOME_DEFAULT_TOKEN);
  } else {
    console.log('  ✓ FONTAWESOME_TOKEN already set in environment');
  }

  console.log('');
  console.log('  Exports to add to your shell profile:');
  console.log(`    export NPM_TOKEN='${npmToken}'`);
  console.log(`    export FONTAWESOME_TOKEN='${faToken}'`);
  console.log('');

  const profile = detectShellProfile();
  if (!profile) {
    console.log('  (Could not detect shell profile — add them manually.)');
    warnLegacyNpmrc();
    return;
  }

  const doAppend = await askYN(`Append these to ${profile}?`, true);
  if (!doAppend) {
    console.log('  Skipped. Add the exports above to your shell profile manually.');
    warnLegacyNpmrc();
    return;
  }

  try {
    const current = existsSync(profile) ? readFileSync(profile, 'utf8') : '';
    let next = upsertExport(current, 'NPM_TOKEN', npmToken);
    next = upsertExport(next, 'FONTAWESOME_TOKEN', faToken);
    writeFileSync(profile, next);
    console.log(`  ✓ Wrote exports to ${profile}`);
    console.log(`  Run:  source ${profile}   (or open a new shell)`);
  } catch (err) {
    console.error(`  Could not write to ${profile}: ${err.message}`);
    console.error('  Add the exports above to your shell profile manually.');
  }

  warnLegacyNpmrc();
}

// ── Tokens-only mode ──────────────────────────────────────

if (tokensOnly) {
  const rl = createInterface({ input: stdin, output: stdout });
  const ask = async (question, defaultValue) => {
    const suffix = defaultValue ? ` (${defaultValue})` : '';
    const answer = (await rl.question(`  ${question}${suffix}: `)).trim();
    return answer || defaultValue || '';
  };
  const askYN = async (question, defaultYes = true) => {
    const hint = defaultYes ? 'Y/n' : 'y/N';
    const answer = (await rl.question(`  ${question} (${hint}): `)).trim().toLowerCase();
    if (answer === '') return defaultYes;
    return answer === 'y' || answer === 'yes';
  };
  console.log('');
  await configureTokens(rl, ask, askYN);
  console.log('');
  rl.close();
  process.exit(0);
}
if (force && existsSync(CONFIG_PATH)) {
  unlinkSync(CONFIG_PATH);
  console.log('\n  Removed existing app-config.json.\n');
}

if (existsSync(CONFIG_PATH)) {
  console.log('\n  app-config.json already exists. Skipping setup.\n');
  process.exit(0);
}

const rl = createInterface({ input: stdin, output: stdout });

const ask = async (question, defaultValue) => {
  const suffix = defaultValue ? ` (${defaultValue})` : '';
  const answer = (await rl.question(`  ${question}${suffix}: `)).trim();
  return answer || defaultValue || '';
};

const askYN = async (question, defaultYes = true) => {
  const hint = defaultYes ? 'Y/n' : 'y/N';
  const answer = (await rl.question(`  ${question} (${hint}): `)).trim().toLowerCase();
  if (answer === '') return defaultYes;
  return answer === 'y' || answer === 'yes';
};

const titleCase = (str) =>
  str.trim().replace(/\b\w/g, (c) => c.toUpperCase());

const NAV_ICONS = [
  'article', 'dashboard', 'folder', 'inventory_2', 'bar_chart',
  'calendar_month', 'task_alt', 'description', 'cloud_upload',
  'monitoring', 'groups', 'payments', 'credit_card', 'bolt',
  'rocket_launch', 'grid_view', 'insights', 'database',
  'security', 'integration_instructions', 'token', 'package_2',
  'deployed_code', 'analytics', 'receipt_long', 'account_tree',
  'hub', 'schema', 'dns', 'storage', 'browse_activity',
  'stacks', 'rule', 'share', 'lock', 'workspaces',
];

let _iconPool = [];
const randomIcon = () => {
  if (_iconPool.length === 0) _iconPool = [...NAV_ICONS].sort(() => Math.random() - 0.5);
  return _iconPool.pop();
};

console.log('');
console.log('  ┌─────────────────────────────────────┐');
console.log('  │     Welcome to the Setup Wizard      │');
console.log('  │  Let\'s configure your dashboard.     │');
console.log('  └─────────────────────────────────────┘');
console.log('');

// ── User info ──────────────────────────────────────────
console.log('  Your Information');
console.log('  ─────────────────');

let firstName = '';
while (!firstName) {
  firstName = titleCase(await ask('First name'));
  if (!firstName) console.log('  First name is required.');
}

const lastName = titleCase(await ask('Last name'));
const email = await ask('Email address');

// ── Product ────────────────────────────────────────────
console.log('');
console.log('  Product');
console.log('  ─────────────────');

const productName = titleCase(await ask('Product name', 'My App'));

// ── Sidebar navigation ────────────────────────────────
console.log('');
console.log('  Sidebar Navigation');
console.log('  ─────────────────');
console.log('  "Home" is included automatically as the first item.');
console.log('');

const topNavItems = [
  { label: 'Home', href: '/', icon: 'home' },
];

console.log('  Add navigation items (leave label empty when done):');
console.log('');
while (true) {
  const label = titleCase(await ask('  Label'));
  if (!label) break;

  const href = await ask('  Path (e.g. /projects)', '');
  const icon = randomIcon();
  const hasChildren = await askYN('  Has sub-items?', false);

  if (hasChildren) {
    const children = [];
    console.log('    Add sub-items (leave label empty when done):');
    while (true) {
      const childLabel = titleCase(await ask('    Sub-item label'));
      if (!childLabel) break;
      const childHref = await ask('    Sub-item path');
      children.push({ label: childLabel, href: childHref, icon: randomIcon() });
    }
    topNavItems.push({ label, icon, ...(href ? { href } : {}), children });
  } else {
    topNavItems.push({ label, href: href || `/${label.toLowerCase().replace(/\s+/g, '-')}`, icon });
  }

  console.log('');
}

// ── Bottom nav ────────────────────────────────────────
console.log('');
const useDefaultBottom = await askYN('Use default bottom navigation (Settings, Help Center)?');

let bottomNavItems;
if (useDefaultBottom) {
  bottomNavItems = [
    { label: 'Settings', href: '/settings', icon: 'settings' },
    { label: 'Help Center', href: '/help', icon: 'help' },
  ];
} else {
  bottomNavItems = [];
  console.log('  Add bottom navigation items (leave label empty when done):');
  while (true) {
    const label = titleCase(await ask('  Label'));
    if (!label) break;
    const href = await ask('  Path');
    bottomNavItems.push({ label, href, icon: randomIcon() });
  }
}

// ── Registry tokens ──────────────────────────────────
console.log('');
await configureTokens(rl, ask, askYN);

// ── Write config ──────────────────────────────────────
const config = {
  product: {
    name: productName,
    version: 'v0.1.0',
  },
  owner: {
    firstName,
    lastName,
    email,
  },
  navigation: {
    top: topNavItems,
    bottom: bottomNavItems,
  },
  createdAt: new Date().toISOString(),
};

writeFileSync(CONFIG_PATH, JSON.stringify(config, null, 2) + '\n');

console.log('');
console.log('  ✓ Configuration saved to app-config.json');
console.log(`  ✓ Product: ${productName}`);
console.log(`  ✓ Owner: ${firstName} ${lastName} (${email})`);
console.log(`  ✓ Navigation items: ${topNavItems.length} top, ${bottomNavItems.length} bottom`);
console.log('');

rl.close();
