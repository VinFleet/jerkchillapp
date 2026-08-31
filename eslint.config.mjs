import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  {
    rules: {
      // This app's data layer is localStorage-backed (offline-first, no
      // server data source), so "load on mount, setState in an effect" is
      // the correct pattern throughout — not the derived-state anti-pattern
      // this rule targets.
      "react-hooks/set-state-in-effect": "off",
    },
  },
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // The real dependency tree, parked outside iCloud sync — node_modules is a
    // symlink to it. ESLint ignores "node_modules" by name, so it does not
    // recognise this one. See scripts/icloud-unsync.mjs.
    "node_modules.nosync/**",
  ]),
]);

export default eslintConfig;
