// Metro config: lets the app import the monorepo's shared TypeScript package.
const { getDefaultConfig } = require('expo/metro-config');
const path = require('path');

const projectRoot = __dirname;
const workspaceRoot = path.resolve(projectRoot, '../..');
const config = getDefaultConfig(projectRoot);

config.watchFolders = [path.resolve(workspaceRoot, 'packages/shared')];
config.resolver.nodeModulesPaths = [path.resolve(projectRoot, 'node_modules')];
config.resolver.extraNodeModules = { '@app/shared': path.resolve(workspaceRoot, 'packages/shared/src') };
// Make sure the shared package resolves react/zod etc. from this app, never from the web workspace.
config.resolver.disableHierarchicalLookup = true;

module.exports = config;
