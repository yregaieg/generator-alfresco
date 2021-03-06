'use strict';
const chalk = require('chalk');
const fs = require('fs');
const debug = require('debug')('generator-alfresco:amp-source');
const path = require('path');
const constants = require('generator-alfresco-common').constants;
const filters = require('generator-alfresco-common').prompt_filters;
const validators = require('generator-alfresco-common').prompt_validators;
const SubGenerator = require('../subgenerator.js');

const WAR_TYPE_BOTH = 'Both repo & share';
const WAR_TYPES = [WAR_TYPE_BOTH, constants.WAR_TYPE_REPO, constants.WAR_TYPE_SHARE];

class AmpAddSourceSubGenerator extends SubGenerator {
  constructor (args, opts) {
    super(args, opts);

    const defGroupId = this.config.get(constants.PROP_PROJECT_GROUP_ID);
    const defArtifactIdPrefix = this.config.get(constants.PROP_PROJECT_ARTIFACT_ID);
    const defVersion = this.config.get(constants.PROP_PROJECT_VERSION);

    this.prompts = [
      {
        type: 'list',
        name: constants.PROP_WAR,
        option: { name: 'war', config: { alias: 'w', desc: 'War to target: repo, share or both', type: String, choices: WAR_TYPES } },
        choices: WAR_TYPES,
        message: 'Which war would you like to customize?',
        commonFilter: filters.chooseOneMapStartsWithFilterFactory({ 'repo': constants.WAR_TYPE_REPO, 'share': constants.WAR_TYPE_SHARE, 'both': WAR_TYPE_BOTH }),
        valueRequired: true,
      },
      {
        type: 'input',
        name: constants.PROP_PROJECT_GROUP_ID,
        option: { name: 'project-group-id', config: { alias: 'g', desc: 'groupId for project', type: String } },
        default: defGroupId,
        message: 'Project groupId?',
        commonFilter: filters.requiredTextFilter,
        valueRequired: true,
      },
      {
        type: 'input',
        name: constants.PROP_PROJECT_ARTIFACT_ID_PREFIX,
        option: { name: 'project-artifact-id', config: { alias: 'a', desc: 'prefix for project artifactId', type: String } },
        when: () => {
          this.out.docs([
            'In order to have consistent artifact names, we will automatically append',
            '-repo, -share and/or -parent to your artifactId prefix where appropriate.',
          ].join(' '));
          return true;
        },
        default: defArtifactIdPrefix,
        message: 'Project artifactId prefix?',
        commonFilter: filters.requiredTextFilter,
        validate: validators.uniqueSourceAmpModuleValidatorFactory(this.moduleRegistry),
        valueRequired: true,
      },
      {
        type: 'input',
        name: constants.PROP_PROJECT_VERSION,
        option: { name: 'project-version', config: { alias: 'v', desc: 'version for project', type: String } },
        default: defVersion,
        message: 'Project version?',
        commonFilter: filters.requiredVersionFilter,
        valueRequired: true,
      },
      {
        type: 'confirm',
        name: 'removeDefaultSourceSamples',
        option: { name: 'remove-default-source-samples', config: { alias: 'R', desc: 'Remove sample code from new amp(s)', type: Boolean, choices: ['true', 'false'] } },
        default: true,
        message: 'Should we remove the default samples?',
        commonFilter: filters.booleanFilter,
        valueRequired: true,
      },
      {
        type: 'confirm',
        name: 'createParent',
        option: { name: 'create-parent', config: { alias: 'p', desc: 'Create parent folder for amps', type: Boolean, choices: ['false', 'true'] } },
        when: readonlyProps => {
          const warType = (readonlyProps[constants.PROP_WAR] || this.answerOverrides[constants.PROP_WAR]);
          const show = (WAR_TYPE_BOTH === warType);
          if (show) {
            this.out.docs([
              'Unlike the traditional all-in-one SDK structure, where source',
              'AMP projects are placed in the project root, we place them inside a customizations',
              'folder. If you create both repo & share amps together, we\'ll offer to group them',
              'in a parent folder inside customizations.'].join(' '));
          }
          if (!show) this.createParent = false;
          return show;
        },
        default: false,
        message: 'Would you like to create a parent folder to contain both of your amps?',
        commonFilter: filters.booleanFilter,
        valueRequired: false,
      },
      {
        type: 'input',
        name: 'parentName',
        option: { name: 'parent-name', config: { alias: 'm', desc: 'Name for parent pom', type: String } },
        when: readonlyProps => {
          const create = (readonlyProps.createParent !== undefined
            ? readonlyProps.createParent
            : this.answerOverrides.createParent);
          return create;
        },
        message: 'Name for parent pom?',
        commonFilter: filters.optionalTextFilter,
        valueRequired: false,
      },
      {
        type: 'input',
        name: 'parentDescription',
        option: { name: 'parent-description', config: { alias: 's', desc: 'Description for parent pom', type: String } },
        when: readonlyProps => {
          const create = (readonlyProps.createParent !== undefined
            ? readonlyProps.createParent
            : this.answerOverrides.createParent);
          return create;
        },
        message: 'Description for parent pom?',
        commonFilter: filters.optionalTextFilter,
        valueRequired: false,
      },
      {
        type: 'input',
        name: 'repoName',
        option: { name: 'repo-name', config: { alias: 'n', desc: 'Name for repo pom', type: String } },
        when: whenRepoWar,
        message: 'Name for repo amp?',
        commonFilter: filters.optionalTextFilter,
        valueRequired: false,
      },
      {
        type: 'input',
        name: 'repoDescription',
        option: { name: 'repo-description', config: { alias: 'd', desc: 'Description for repo pom', type: String } },
        when: whenRepoWar,
        message: 'Description for repo amp?',
        commonFilter: filters.optionalTextFilter,
        valueRequired: false,
      },
      {
        type: 'input',
        name: 'shareName',
        option: { name: 'share-name', config: { alias: 'N', desc: 'Name for share pom', type: String } },
        when: whenShareWar,
        message: 'Name for share amp?',
        commonFilter: filters.optionalTextFilter,
        valueRequired: false,
      },
      {
        type: 'input',
        name: 'shareDescription',
        option: { name: 'share-description', config: { alias: 'D', desc: 'Description for share pom', type: String } },
        when: whenShareWar,
        message: 'Description for share amp?',
        commonFilter: filters.optionalTextFilter,
        valueRequired: false,
      },
    ];

    this.setupArgumentsAndOptions(this.prompts);
  }

  prompting () {
    if (this.bail) return;

    this.out.info([
      'This sub-generator will update existing POM\'s and context files.',
      'Yeoman will display ' + chalk.yellow('conflict <filename>'),
      'and ask you if you want to update each file.',
      '\nType "h" when prompted to get details about your choices.'].join(' '));

    this.out.docs([
      'In order to customize the Alfresco repository and/or share, the best practice',
      'is still to create AMPs. Here we\'ll walk you through what you need to provide',
      'in order for us to create source code projects for you to place your',
      'customizations in.'].join(' '),
    'http://docs.alfresco.com/5.1/tasks/alfresco-sdk-advanced-add-custom-amps-aio.html');

    const defGroupId = this.config.get(constants.PROP_PROJECT_GROUP_ID);
    const defVersion = this.config.get(constants.PROP_PROJECT_VERSION);

    return this.subgeneratorPrompt(this.prompts, '', props => {
      this.props = props;
      if (defGroupId === props[constants.PROP_PROJECT_GROUP_ID]) {
        props[constants.PROP_PROJECT_GROUP_ID] = constants.VAR_PROJECT_GROUPID;
      }
      if (defVersion === props[constants.PROP_PROJECT_VERSION]) {
        props[constants.PROP_PROJECT_VERSION] = constants.VAR_PROJECT_VERSION;
      }
      if (WAR_TYPE_BOTH === props[constants.PROP_WAR]) {
        this.props[constants.PROP_WAR] = [constants.WAR_TYPE_REPO, constants.WAR_TYPE_SHARE];
      } else {
        this.props[constants.PROP_WAR] = [this.props[constants.PROP_WAR]];
      }
    }).then(() => {
      debug('prompting finished');
    });
  }

  writing () {
    if (this.bail) return;

    // Do regular module instantiation stuff
    debug('writing %s', this.props[constants.PROP_WAR]);
    this.props[constants.PROP_WAR].forEach(war => {
      const prefix = this.props[constants.PROP_PROJECT_ARTIFACT_ID_PREFIX];
      const artifactId = prefix + '-' + war + '-amp';
      const groupId = this.props[constants.PROP_PROJECT_GROUP_ID];
      const version = this.props[constants.PROP_PROJECT_VERSION];
      const hasCustomizations = fs.existsSync(
        path.join(this.destinationPath(constants.FOLDER_CUSTOMIZATIONS), 'pom.xml'));
      let parentPath = (hasCustomizations ? constants.FOLDER_CUSTOMIZATIONS : '');
      // If are parent folder is created we need to put a pom in it
      // and link said pom into the customizations pom
      if (this.props.createParent) {
        let parentGroupId = groupId;
        if (parentGroupId === constants.VAR_PROJECT_GROUPID) {
          parentGroupId = this.config.get(constants.PROP_PROJECT_GROUP_ID);
        }
        const parentArtifactId = prefix + '-parent';
        let parentVersion = version;
        if (parentVersion === constants.VAR_PROJECT_VERSION) {
          parentVersion = this.config.get(constants.PROP_PROJECT_VERSION);
        }
        parentPath = path.join(parentPath, parentArtifactId);
        const parentPomPath = path.join(parentPath, 'pom.xml');
        let parentPomStr;
        if (this.fs.exists(parentPomPath)) {
          parentPomStr = this.fs.read(parentPomPath);
        }
        const parentPom = require('generator-alfresco-common').maven_pom(parentPomStr);
        parentPom.setProjectGAV(parentGroupId, parentArtifactId, parentVersion, 'pom');
        if (this.props.parentName) parentPom.setTopLevelElementTextContent('pom', 'name', this.props.parentName);
        if (this.props.parentDescription) parentPom.setTopLevelElementTextContent('pom', 'description', this.props.parentDescription);
        if (hasCustomizations) {
          parentPom.setParentGAV('org.alfresco.maven', 'customizations', '1.0.0-SNAPSHOT');
        } else {
          parentPom.setParentGAV(
            this.config.get(constants.PROP_PROJECT_GROUP_ID),
            this.config.get(constants.PROP_PROJECT_ARTIFACT_ID),
            this.config.get(constants.PROP_PROJECT_VERSION)
          );
        }
        this.fs.write(parentPomPath, parentPom.getPOMString());

        const containingFolderPath = (hasCustomizations ? constants.FOLDER_CUSTOMIZATIONS : '');
        const containingPomPath = this.destinationPath(path.join(containingFolderPath, 'pom.xml'));
        this.out.info('Adding ' + parentArtifactId + ' module to containing pom ' + containingPomPath);
        const containingPomStr = this.fs.read(containingPomPath);
        const containingPom = require('generator-alfresco-common').maven_pom(containingPomStr);
        if (!containingPom.findModule(parentArtifactId)) {
          containingPom.addModule(parentArtifactId, true);
          this.fs.write(containingPomPath, containingPom.getPOMString());
        }
      }
      const modulePath = path.join(parentPath, artifactId);
      debug('register and do initial setup for our module(s)');
      this.moduleManager.addModule(groupId, artifactId, version, 'amp', war, 'source', modulePath);
      debug('schedule setup activities for our module(s)');
      if (constants.WAR_TYPE_REPO === war) {
        debug('We are creating a new module so we need to schedule it to be setup');
        this.moduleManager.pushOp(() => { this.sdk.setupNewRepoModule.call(this, modulePath) });
        debug('If we have a custom name or description then arrange to get that info into the pom');
        if (this.props.repoName || this.props.repoDescription) {
          this.moduleManager.pushOp(() => {
            this.out.info('Setting name: ' + this.props.repoName + ' and description: ' + this.props.repoDescription + ' for: ' + artifactId);
            const pomPath = this.destinationPath(path.join(modulePath, 'pom.xml'));
            const pomStr = this.fs.read(pomPath);
            const pom = require('generator-alfresco-common').maven_pom(pomStr);
            if (this.props.repoName) pom.setTopLevelElementTextContent('pom', 'name', this.props.repoName);
            if (this.props.repoDescription) pom.setTopLevelElementTextContent('pom', 'description', this.props.repoDescription);
            this.fs.write(pomPath, pom.getPOMString());
          });
        }
        if (this.props.removeDefaultSourceSamples) {
          debug('scheduling sample source code/config removal');
          this.moduleManager.pushOp(() => {
            this.sdk.removeRepoSamples.call(this,
              modulePath,
              this.config.get(constants.PROP_PROJECT_PACKAGE),
              prefix
            );
          });
        } else {
          debug('NOT scheduling sample source code/config removal');
        }
      }
      if (constants.WAR_TYPE_SHARE === war) {
        // We are creating a new module so we need to set it up
        this.moduleManager.pushOp(() => { this.sdk.setupNewShareModule.call(this, modulePath) });
        // If we have a custom name or description then get that info into the pom
        if (this.props.shareName || this.props.shareDescription) {
          this.moduleManager.pushOp(() => {
            this.out.info('Setting name: ' + this.props.shareName + ' and description: ' + this.props.shareDescription + ' for: ' + artifactId);
            const pomPath = this.destinationPath(path.join(modulePath, 'pom.xml'));
            const pomStr = this.fs.read(pomPath);
            const pom = require('generator-alfresco-common').maven_pom(pomStr);
            if (this.props.shareName) pom.setTopLevelElementTextContent('pom', 'name', this.props.shareName);
            if (this.props.shareDescription) pom.setTopLevelElementTextContent('pom', 'description', this.props.shareDescription);
            this.fs.write(pomPath, pom.getPOMString());
          });
        }
        if (this.props.removeDefaultSourceSamples) {
          this.moduleManager.pushOp(() => {
            this.sdk.removeShareSamples.call(this,
              modulePath,
              this.config.get(constants.PROP_PROJECT_PACKAGE),
              prefix
            );
          });
        }
      }
    });
    // complete all scheduled activities
    this.moduleManager.save();
  }
};

function whenRepoWar (props) {
  const warType = props[constants.PROP_WAR];
  const show = (WAR_TYPE_BOTH === warType || constants.WAR_TYPE_REPO === warType);
  return show;
}

function whenShareWar (props) {
  const warType = props[constants.PROP_WAR];
  const show = (WAR_TYPE_BOTH === warType || constants.WAR_TYPE_SHARE === warType);
  return show;
}

module.exports = AmpAddSourceSubGenerator;

// vim: autoindent expandtab tabstop=2 shiftwidth=2 softtabstop=2
