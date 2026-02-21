#!/usr/bin/env node

const fs = require('fs');
const os = require('os');
const path = require('path');
const readline = require('readline');
const { spawn } = require('child_process');

const DEFAULT_IMPORT_MODE = 'replace-all';
const IMPORT_MODES = new Set(['replace-all', 'replace', 'append']);

function pad(value) {
  return String(value).padStart(2, '0');
}

function buildDefaultSnapshotPath(now = new Date()) {
  const timestamp = [
    now.getFullYear(),
    pad(now.getMonth() + 1),
    pad(now.getDate()),
  ].join('') +
    '-' +
    [pad(now.getHours()), pad(now.getMinutes()), pad(now.getSeconds())].join('');

  return path.join(os.tmpdir(), `convex-dev-export-${timestamp}.zip`);
}

function printUsage(log = console.log) {
  log('Usage: node scripts/migrate-convex-dev-to-prod.js [options]');
  log('');
  log('Copies all Convex data from dev deployment to prod deployment.');
  log('');
  log('Options:');
  log('  --yes                     Skip confirmation prompt');
  log('  --include-file-storage    Include Convex file storage in snapshot export');
  log('  --keep-snapshot           Do not delete the snapshot zip after import');
  log('  --snapshot-path <path>    Explicit path to export snapshot zip');
  log('  --import-mode <mode>      replace-all (default), replace, or append');
  log('  --env-file <path>         Pass an env file to both convex export/import');
  log('  -h, --help                Show this help');
}

function parseArgs(argv) {
  const options = {
    yes: false,
    includeFileStorage: false,
    keepSnapshot: false,
    envFile: null,
    snapshotPath: buildDefaultSnapshotPath(),
    importMode: DEFAULT_IMPORT_MODE,
    help: false,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];

    if (arg === '--yes') {
      options.yes = true;
      continue;
    }

    if (arg === '--include-file-storage') {
      options.includeFileStorage = true;
      continue;
    }

    if (arg === '--keep-snapshot') {
      options.keepSnapshot = true;
      continue;
    }

    if (arg === '--snapshot-path') {
      const value = argv[index + 1];
      if (!value) {
        throw new Error('--snapshot-path requires a value');
      }
      options.snapshotPath = value;
      index += 1;
      continue;
    }

    if (arg === '--import-mode') {
      const value = argv[index + 1];
      if (!value) {
        throw new Error('--import-mode requires a value');
      }
      if (!IMPORT_MODES.has(value)) {
        throw new Error(`--import-mode must be one of: ${Array.from(IMPORT_MODES).join(', ')}`);
      }
      options.importMode = value;
      index += 1;
      continue;
    }

    if (arg === '--env-file') {
      const value = argv[index + 1];
      if (!value) {
        throw new Error('--env-file requires a value');
      }
      options.envFile = value;
      index += 1;
      continue;
    }

    if (arg === '-h' || arg === '--help') {
      options.help = true;
      continue;
    }

    throw new Error(`Unknown option: ${arg}`);
  }

  return options;
}

function buildExportCommandArgs(options) {
  const args = ['convex', 'export', '--path', options.snapshotPath];

  if (options.includeFileStorage) {
    args.push('--include-file-storage');
  }

  if (options.envFile) {
    args.push('--env-file', options.envFile);
  }

  return args;
}

function buildImportCommandArgs(options) {
  const modeFlag = {
    'replace-all': '--replace-all',
    replace: '--replace',
    append: '--append',
  }[options.importMode];

  const args = ['convex', 'import', options.snapshotPath, '--prod', modeFlag];

  if (options.yes) {
    args.push('-y');
  }

  if (options.envFile) {
    args.push('--env-file', options.envFile);
  }

  return args;
}

async function runCommand(command, args) {
  await new Promise((resolve, reject) => {
    const child = spawn(command, args, { stdio: 'inherit' });
    child.on('error', reject);
    child.on('close', (code) => {
      if (code === 0) {
        resolve();
        return;
      }
      reject(new Error(`Command failed (${code}): ${command} ${args.join(' ')}`));
    });
  });
}

async function askForConfirmation(question) {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  return new Promise((resolve) => {
    rl.question(`${question} [y/N] `, (answer) => {
      rl.close();
      resolve(answer.trim().toLowerCase() === 'y' || answer.trim().toLowerCase() === 'yes');
    });
  });
}

async function runMigration(options, deps = {}) {
  const log = deps.log || console.log;
  const execute = deps.runCommand || runCommand;
  const removeFile = deps.removeFile || ((filePath) => fs.promises.rm(filePath, { force: true }));

  log(`Exporting dev deployment to ${options.snapshotPath}`);
  await execute('npx', buildExportCommandArgs(options));

  log('Importing snapshot into prod deployment');
  await execute('npx', buildImportCommandArgs(options));

  if (!options.keepSnapshot) {
    await removeFile(options.snapshotPath);
    log(`Deleted snapshot ${options.snapshotPath}`);
  }

  log('Convex dev -> prod migration complete.');
}

async function main(argv = process.argv.slice(2), deps = {}) {
  let options;

  try {
    options = parseArgs(argv);
  } catch (error) {
    console.error(error.message);
    printUsage();
    return 1;
  }

  if (options.help) {
    printUsage();
    return 0;
  }

  const confirm = deps.confirm || askForConfirmation;
  if (!options.yes) {
    const confirmed = await confirm(
      `This will copy ALL Convex data from dev to prod using '${options.importMode}' mode and may overwrite production data. Continue?`,
    );

    if (!confirmed) {
      console.log('Migration cancelled.');
      return 0;
    }

    options = { ...options, yes: true };
  }

  try {
    await runMigration(options, deps);
    return 0;
  } catch (error) {
    console.error(error.message);
    return 1;
  }
}

if (require.main === module) {
  main().then((code) => {
    process.exit(code);
  });
}

module.exports = {
  DEFAULT_IMPORT_MODE,
  IMPORT_MODES,
  buildDefaultSnapshotPath,
  buildExportCommandArgs,
  buildImportCommandArgs,
  parseArgs,
  printUsage,
  runMigration,
  main,
};
