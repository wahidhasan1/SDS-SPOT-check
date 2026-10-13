// Metro config: lets the app import the shared TypeScript package (@fluentpath/shared) from the monorepo.
const path = require('path');
const { getDefaultConfig } = require('expo/metro-config');

const projectRoot = __dirname;
const repoRoot = path.resolve(projectRoot, '../..');
const sharedDir = path.join(repoRoot, 'packages/shared');
const config = getDefaultConfig(projectRoot);

config.watchFolders = [sharedDir];
config.resolver.nodeModulesPaths = [path.join(projectRoot, 'node_modules')];
config.resolver.extraNodeModules = { '@fluentpath/shared': path.join(sharedDir, 'src') };
// Dependencies imported by the shared package (e.g. zod) resolve from this app's node_modules,
// never from the web/API workspace at the repository root.
config.resolver.resolveRequest = (context, moduleName, platform) => {
  if (context.originModulePath.startsWith(sharedDir) && !moduleName.startsWith('.')) {
    return context.resolveRequest({ ...context, originModulePath: path.join(projectRoot, 'package.json') }, moduleName, platform);
  }
  return context.resolveRequest(context, moduleName, platform);
};

module.exports = config;
