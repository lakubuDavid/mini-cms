import { defineConfig } from "vite";
// import { tanstackRouter } from "@tanstack/router-plugin/vite";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import viteReact from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { nitro } from "nitro/vite";

const config = defineConfig({
  envPrefix: ["VITE_", "PUBLIC_"],
  resolve: {
    tsconfigPaths: true,
    alias: {
      tslib: "tslib/tslib.es6.js",
    },
    noExternal: [
      "fumadocs-core",
      "fumadocs-ui",
      "fumadocs-openapi",
      "@fumadocs/base-ui",
    ],
  },
  server: {
    watch: {
      ignored: ["**/routeTree.gen.ts"],
    },
  },
  plugins: [
    // tanstackRouter(),
    nitro(),
    // viteTsConfigPaths({
    //   projects: ["./tsconfig.json"],
    // }),
    tailwindcss(),
    tanstackStart(),
    viteReact(),
  ],
});

export default config;
