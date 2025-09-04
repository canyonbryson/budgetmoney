const path = require("path");
const { getDefaultConfig } = require("expo/metro-config");

const projectRoot = __dirname;
const workspaceRoot = path.resolve(projectRoot, "../.."); // monorepo root

const config = getDefaultConfig(projectRoot);

config.resolver.unstable_enableSymlinks = true;
config.resolver.nodeModulesPaths = [
  path.join(workspaceRoot, "node_modules"),
];
config.resolver.extraNodeModules = {
  react: path.join(workspaceRoot, "node_modules/react"),
  "react-dom": path.join(workspaceRoot, "node_modules/react-dom"),
  "react-native": path.join(workspaceRoot, "node_modules/react-native"),
  "react-native-safe-area-context": path.join(
    workspaceRoot,
    "node_modules/react-native-safe-area-context"
  ),
  expo: path.join(workspaceRoot, "node_modules/expo"),
};
config.watchFolders = [workspaceRoot];

module.exports = config;
