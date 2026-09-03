import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";

export default defineConfig([
  ...nextVitals,
  {
    // Existing hydration and local-storage synchronization is intentionally
    // effect-driven. Migrate these screens incrementally without blocking the
    // security upgrade to React 19 / Next 16.
    rules: {
      "react-hooks/set-state-in-effect": "off",
      "react-hooks/purity": "off",
      "react-hooks/preserve-manual-memoization": "off",
    },
  },
  globalIgnores([".next/**", "node_modules/**", "playwright-report/**", "test-results/**"]),
]);
