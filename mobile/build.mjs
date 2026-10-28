#!/usr/bin/env node
// Compila o app nativo a partir DESTA pasta, escolhendo o tipo de build.
//   node build.mjs                      -> menu interativo
//   node build.mjs android-apk-debug    -> direto, sem menu (veja a lista abaixo)
//   node build.mjs android-aab --url=https://seudominio.com --skip-web
// O endereço do site vem de --url, da variável CAP_SERVER_URL ou de mobile/.env. Os arquivos gerados ficam em mobile/builds/.
import { spawnSync } from 'node:child_process';
import { copyFileSync, existsSync, mkdirSync, readFileSync } from 'node:fs';
import { createInterface } from 'node:readline/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(here, '..'); // projeto web (gera o dist/)
const isWin = process.platform === 'win32';
const isMac = process.platform === 'darwin';

const TARGETS = {
  'sync':               { label: 'Só sincronizar (build do site + copiar para android/ e ios/)', platform: null },
  'android-apk-debug':  { label: 'Android · APK de teste (instala direto no celular, sem assinatura)', platform: 'android' },
  'android-apk':        { label: 'Android · APK de release (assinado se houver keystore.properties)', platform: 'android' },
  'android-aab':        { label: 'Android · AAB de release (arquivo para enviar à Play Store)', platform: 'android' },
  'android-studio':     { label: 'Android · abrir no Android Studio', platform: 'android' },
  'ios-archive':        { label: 'iOS · gerar .xcarchive (só no Mac, com Xcode)', platform: 'ios' },
  'ios-studio':         { label: 'iOS · abrir no Xcode (só no Mac)', platform: 'ios' },
  'assets':             { label: 'Regenerar ícones e splash (de mobile/assets)', platform: null },
};

const args = process.argv.slice(2);
const flag = (name) => args.find((a) => a.startsWith(`--${name}=`))?.split('=').slice(1).join('=');
const has = (name) => args.includes(`--${name}`);
const positional = args.filter((a) => !a.startsWith('--'));

const run = (cmd, cmdArgs, { cwd = here, env = {} } = {}) => {
  console.log(`\n$ ${cmd} ${cmdArgs.join(' ')}   (em ${path.relative(process.cwd(), cwd) || '.'})`);
  const r = spawnSync(cmd, cmdArgs, { cwd, stdio: 'inherit', shell: isWin, env: { ...process.env, ...env } });
  if (r.status !== 0) die(`O comando falhou (${cmd} ${cmdArgs[0] ?? ''}).`);
};
const has_ = (cmd, a = ['--version']) => spawnSync(cmd, a, { stdio: 'ignore', shell: isWin }).status === 0;
const die = (msg) => { console.error(`\n✖ ${msg}`); process.exit(1); };

const loadEnvFile = () => {
  const file = path.join(here, '.env');
  if (!existsSync(file)) return;
  for (const line of readFileSync(file, 'utf8').split('\n')) {
    const m = line.match(/^\s*([A-Z_]+)\s*=\s*(.*?)\s*$/);
    if (m && process.env[m[1]] === undefined) process.env[m[1]] = m[2];
  }
};

const version = JSON.parse(readFileSync(path.join(here, 'version.json'), 'utf8'));

const chooseTarget = async () => {
  if (positional[0]) {
    if (!TARGETS[positional[0]]) die(`Build desconhecido: ${positional[0]}. Opções: ${Object.keys(TARGETS).join(', ')}`);
    return positional[0];
  }
  if (!process.stdin.isTTY) die(`Informe o build: node build.mjs <${Object.keys(TARGETS).join('|')}>`);
  const keys = Object.keys(TARGETS);
  console.log('\nQual build você quer gerar?\n');
  keys.forEach((k, i) => console.log(`  ${i + 1}) ${TARGETS[k].label}`));
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  const answer = (await rl.question('\nNúmero: ')).trim();
  rl.close();
  const key = keys[Number(answer) - 1];
  if (!key) die('Opção inválida.');
  return key;
};

const ensureServerUrl = async () => {
  loadEnvFile();
  let url = flag('url') ?? process.env.CAP_SERVER_URL;
  if (!url && process.stdin.isTTY) {
    const rl = createInterface({ input: process.stdin, output: process.stdout });
    url = (await rl.question('\nEndereço HTTPS do site publicado (ex.: https://seudominio.com): ')).trim();
    rl.close();
  }
  if (!url || !/^https:\/\/[^/\s]+\/?$/.test(url)) die('Defina o endereço HTTPS do site: --url=https://seudominio.com, CAP_SERVER_URL ou mobile/.env.');
  process.env.CAP_SERVER_URL = url.replace(/\/+$/, '');
};

const prepare = () => {
  if (!existsSync(path.join(here, 'node_modules'))) run('npm', ['install']);
  if (!has('skip-web')) {
    if (!existsSync(path.join(root, 'node_modules'))) run('npm', ['install'], { cwd: root });
    run('npm', ['run', 'build'], { cwd: root });
  } else if (!existsSync(path.join(root, 'dist'))) die('Sem a pasta dist/ do site: rode sem --skip-web.');
  run('npx', ['cap', 'sync'], { cwd: here });
};

const checkAndroid = () => {
  if (!has_('java', ['-version'])) die('Java (JDK 17 ou 21) não encontrado. Instale o JDK ou use o JDK do Android Studio.');
  const sdk = process.env.ANDROID_HOME || process.env.ANDROID_SDK_ROOT;
  const local = path.join(here, 'android', 'local.properties');
  if (!sdk && !existsSync(local)) die('Android SDK não encontrado. Instale o Android Studio e defina ANDROID_HOME (ou crie mobile/android/local.properties com sdk.dir=/caminho/do/Android/sdk).');
};

const gradle = (task) => {
  checkAndroid();
  run(isWin ? 'gradlew.bat' : './gradlew', [task, `-PappVersionName=${version.versionName}`, `-PappVersionCode=${version.versionCode}`], { cwd: path.join(here, 'android') });
};

const keep = (from, name) => {
  if (!existsSync(from)) die(`O build terminou, mas não achei o arquivo esperado: ${from}`);
  const dir = path.join(here, 'builds');
  mkdirSync(dir, { recursive: true });
  const to = path.join(dir, `${name}-${version.versionName}-${version.versionCode}${path.extname(from)}`);
  copyFileSync(from, to);
  console.log(`\n✔ Pronto: ${path.relative(process.cwd(), to) || to}`);
  return to;
};

const outputs = path.join(here, 'android', 'app', 'build', 'outputs');
const target = await chooseTarget();
console.log(`\n▶ ${TARGETS[target].label}`);

if (target === 'assets') {
  run('npx', ['capacitor-assets', 'generate', '--android', '--ios']);
  process.exit(0);
}

if (TARGETS[target].platform === 'ios' && !isMac) die('Gerar o app iOS exige um Mac com Xcode. Copie esta pasta (mobile/) para um Mac e rode de novo.');
await ensureServerUrl();
prepare();

switch (target) {
  case 'sync':
    console.log('\n✔ Sincronizado. Abra android/ no Android Studio ou ios/ no Xcode, ou rode outro build.');
    break;
  case 'android-apk-debug':
    gradle('assembleDebug');
    keep(path.join(outputs, 'apk', 'debug', 'app-debug.apk'), 'thinkrplay-debug');
    break;
  case 'android-apk': {
    gradle('assembleRelease');
    const signed = path.join(outputs, 'apk', 'release', 'app-release.apk');
    const unsigned = path.join(outputs, 'apk', 'release', 'app-release-unsigned.apk');
    keep(existsSync(signed) ? signed : unsigned, existsSync(signed) ? 'thinkrplay' : 'thinkrplay-SEM-ASSINATURA');
    if (!existsSync(signed)) console.log('⚠ Sem assinatura: crie mobile/android/keystore.properties (veja keystore.properties.example) para assinar.');
    break;
  }
  case 'android-aab':
    gradle('bundleRelease');
    keep(path.join(outputs, 'bundle', 'release', 'app-release.aab'), 'thinkrplay');
    if (!existsSync(path.join(here, 'android', 'keystore.properties'))) console.log('⚠ Sem assinatura: a Play Store exige AAB assinado (veja keystore.properties.example).');
    break;
  case 'android-studio':
    run('npx', ['cap', 'open', 'android']);
    break;
  case 'ios-studio':
    if (!isMac) die('O Xcode só existe no Mac. Copie esta pasta (mobile/) para um Mac e rode de novo.');
    run('npx', ['cap', 'open', 'ios']);
    break;
  case 'ios-archive': {
    if (!isMac) die('Gerar o app iOS exige um Mac com Xcode. Copie esta pasta (mobile/) para um Mac e rode de novo.');
    const archive = path.join(here, 'builds', `Thinkrplay-${version.versionName}-${version.versionCode}.xcarchive`);
    mkdirSync(path.dirname(archive), { recursive: true });
    run('xcodebuild', [
      '-workspace', 'App.xcworkspace', '-scheme', 'App', '-configuration', 'Release', '-destination', 'generic/platform=iOS',
      '-archivePath', archive, `MARKETING_VERSION=${version.versionName}`, `CURRENT_PROJECT_VERSION=${version.versionCode}`, 'archive',
    ], { cwd: path.join(here, 'ios', 'App') });
    console.log(`\n✔ Pronto: ${archive}\n   Abra o Xcode → Window → Organizer para validar e enviar à App Store (precisa da sua conta e assinatura Apple).`);
    break;
  }
}
