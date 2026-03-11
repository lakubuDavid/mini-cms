import { defineConfig } from "vite";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import viteReact from "@vitejs/plugin-react";
import viteTsConfigPaths from "vite-tsconfig-paths";
import tailwindcss from "@tailwindcss/vite";
import { nitro } from "nitro/vite";
import mdx from "fumadocs-mdx/vite";
import * as MdxConfig from "./source.config";

const config = defineConfig({
  envPrefix: ["VITE_", "PUBLIC_"],
  plugins: [
    nitro(),
    mdx(MdxConfig),
    viteTsConfigPaths({
      projects: ["./tsconfig.json"],
    }),
    tailwindcss(),
    tanstackStart(),
    viteReact(),
  ],
});

export default config;
