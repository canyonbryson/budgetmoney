const path = require('path');

const {
  DEFAULT_IMPORT_MODE,
  buildExportCommandArgs,
  buildImportCommandArgs,
  parseArgs,
  runMigration,
} = require('../migrate-convex-dev-to-prod');

describe('migrate-convex-dev-to-prod script', () => {
  it('uses safe defaults for parseArgs', () => {
    const options = parseArgs([]);

    expect(options).toMatchObject({
      includeFileStorage: false,
      keepSnapshot: false,
      yes: false,
      importMode: DEFAULT_IMPORT_MODE,
      envFile: null,
    });
    expect(path.basename(options.snapshotPath)).toMatch(/^convex-dev-export-\d{8}-\d{6}\.zip$/);
  });

  it('parses optional flags', () => {
    const options = parseArgs([
      '--yes',
      '--include-file-storage',
      '--keep-snapshot',
      '--env-file',
      '.env.migrate',
      '--snapshot-path',
      '/tmp/snapshot.zip',
      '--import-mode',
      'append',
    ]);

    expect(options).toMatchObject({
      yes: true,
      includeFileStorage: true,
      keepSnapshot: true,
      envFile: '.env.migrate',
      snapshotPath: '/tmp/snapshot.zip',
      importMode: 'append',
    });
  });

  it('builds export args', () => {
    const args = buildExportCommandArgs({
      snapshotPath: '/tmp/dev.zip',
      includeFileStorage: true,
      envFile: '.env.local',
    });

    expect(args).toEqual([
      'convex',
      'export',
      '--path',
      '/tmp/dev.zip',
      '--include-file-storage',
      '--env-file',
      '.env.local',
    ]);
  });

  it('builds import args for replace-all mode', () => {
    const args = buildImportCommandArgs({
      snapshotPath: '/tmp/dev.zip',
      yes: true,
      importMode: 'replace-all',
      envFile: '.env.local',
    });

    expect(args).toEqual([
      'convex',
      'import',
      '/tmp/dev.zip',
      '--prod',
      '--replace-all',
      '-y',
      '--env-file',
      '.env.local',
    ]);
  });

  it('runs export then import and deletes snapshot by default', async () => {
    const runCommandCalls = [];
    const deletedPaths = [];

    await runMigration(
      {
        snapshotPath: '/tmp/dev.zip',
        includeFileStorage: false,
        keepSnapshot: false,
        yes: true,
        envFile: null,
        importMode: 'replace-all',
      },
      {
        log: jest.fn(),
        runCommand: async (cmd, args) => {
          runCommandCalls.push([cmd, args]);
        },
        removeFile: async (filePath) => {
          deletedPaths.push(filePath);
        },
      },
    );

    expect(runCommandCalls).toEqual([
      ['npx', ['convex', 'export', '--path', '/tmp/dev.zip']],
      [
        'npx',
        ['convex', 'import', '/tmp/dev.zip', '--prod', '--replace-all', '-y'],
      ],
    ]);
    expect(deletedPaths).toEqual(['/tmp/dev.zip']);
  });
});
