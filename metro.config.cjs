// CommonJS Metro config for Expo + pnpm workspaces (recommended by Expo)
const { getDefaultConfig } = require("@expo/metro-config");
const path = require("path");

const projectRoot = __dirname;
const workspaceRoot = path.resolve(projectRoot, "../..");

/** @type {import('metro-config').ConfigT} */
const config = getDefaultConfig(projectRoot);

config.resolver.unstable_enableSymlinks = true;
config.resolver.nodeModulesPaths = [path.join(workspaceRoot, "node_modules")];

// Resolve react-native-svg to the exact installed path to avoid duplicate JS vs native copies
let resolvedSvgDir;
try {
  const svgPkg = require.resolve("react-native-svg/package.json", {
    paths: [projectRoot, workspaceRoot],
  });
  resolvedSvgDir = path.dirname(svgPkg);
} catch {}

config.resolver.extraNodeModules = {
  react: path.join(workspaceRoot, "node_modules/react"),
  "react-dom": path.join(workspaceRoot, "node_modules/react-dom"),
  "react-native": path.join(workspaceRoot, "node_modules/react-native"),
  "react-native-safe-area-context": path.join(
    workspaceRoot,
    "node_modules/react-native-safe-area-context",
  ),
  ...(resolvedSvgDir ? { "react-native-svg": resolvedSvgDir } : {}),
  expo: path.join(workspaceRoot, "node_modules/expo"),
};
config.watchFolders = [workspaceRoot];

// Enable SVG as React components via react-native-svg-transformer
config.transformer = {
  ...config.transformer,
  babelTransformerPath: require.resolve("react-native-svg-transformer"),
};
config.resolver.assetExts = config.resolver.assetExts.filter(
  (ext) => ext !== "svg",
);
config.resolver.sourceExts = Array.from(
  new Set([...config.resolver.sourceExts, "svg"]),
);

module.exports = config;
