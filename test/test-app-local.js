'use strict';
/* eslint-env node, mocha */
const assert = require('yeoman-assert');
const constants = require('generator-alfresco-common').constants;
const helpers = require('yeoman-test');
const os = require('os');
const path = require('path');

describe('generator-alfresco:app-local', function () {
  describe('default prompts with local SDK', function () {
    this.timeout(60000);

    const osTempDir = path.join(os.tmpdir(), './temp-test');

    before(function () {
      return helpers.run(path.join(__dirname, '../generators/app'))
        .inDir(osTempDir)
        .withOptions({'skip-install': false})
        .withPrompts({
          sdkVersion: 'local',
          archetypeVersion: '2.1.1',
          removeDefaultSourceAmps: false,
          removeDefaultSourceSamples: false,
        })
        .toPromise();
    });

    it('creates a project', function () {
      assert.file(path.join(osTempDir, '.yo-rc.json'));
    });

    describe('default prompts with local SDK inside previous instantiation', function () {
      before(function () {
        return helpers.run(path.join(__dirname, '../generators/app'))
          .cd(osTempDir)
          .withLocalConfig({ 'archetypeVersion': '2.1.0' })
          .withOptions({ 'skip-install': false })
          .withPrompts({
            sdkVersion: 'local',
            archetypeVersion: '2.1.1',
            removeDefaultSourceAmps: false,
            removeDefaultSourceSamples: false,
          })
          .toPromise();
      });

      it('creates files', function () {
        assert.file([
          '.editorconfig',
          '.gitignore',
          '.yo-rc.json',
          'pom.xml',
          'debug.sh',
          'run.sh',
          'run.bat',
          'run-without-springloaded.sh',
          'scripts/debug.sh',
          'scripts/env.sh',
          'scripts/explode-alf-sources.sh',
          'scripts/find-exploded.sh',
          'scripts/grep-exploded.sh',
          'scripts/package-to-exploded.sh',
          'scripts/run.sh',
          'scripts/run.bat',
          'scripts/run-without-springloaded.sh',
          constants.FOLDER_SOURCE_TEMPLATES + '/README.md',
          constants.FOLDER_SOURCE_TEMPLATES + '/repo-amp/pom.xml',
          constants.FOLDER_SOURCE_TEMPLATES + '/share-amp/pom.xml',
          'repo/pom.xml',
          'repo-amp/pom.xml',
          'runner/pom.xml',
          'share/pom.xml',
          'share-amp/pom.xml',
          'solr-config/pom.xml',
          'TODO.md',
          'repo-amp/src/main/amp/config/alfresco/module/repo-amp/context/generated/README.md',
        ]);
      });
      it('adds generic include for generated beans', function () {
        assert.fileContent(
          'repo-amp/src/main/amp/config/alfresco/module/repo-amp/module-context.xml',
          /<import resource="classpath:alfresco\/module\/\${project\.artifactId}\/context\/generated\/\*-context\.xml"\/>/
        );
      });
      it('does not create enterprise specific files', function () {
        assert.noFile([
          'repo/src/main/resources/alfresco/extension/license/README.md',
        ]);
      });
      it('run.sh and debug.sh should not include -Penterprise flag', function () {
        assert.noFileContent([
          ['debug.sh', /-Penterprise/],
          ['run.sh', /-Penterprise/],
          ['run.bat', /-Penterprise/],
          ['run-without-springloaded.sh', /-Penterprise/],
          ['scripts/debug.sh', /-Penterprise/],
          ['scripts/run.sh', /-Penterprise/],
          ['scripts/run.bat', /-Penterprise/],
          ['scripts/run-without-springloaded.sh', /-Penterprise/],
        ]);
      });
    });
  });
});

// vim: autoindent expandtab tabstop=2 shiftwidth=2 softtabstop=2
