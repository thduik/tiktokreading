import { defineConfig, type Plugin } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import path from "path";
import { execSync } from "node:child_process";
import runtimeErrorOverlay from "@replit/vite-plugin-runtime-error-modal";

const rawPort = process.env.PORT ?? "5173";

const port = Number(rawPort);

if (Number.isNaN(port) || port <= 0) {
  throw new Error(`Invalid PORT value: "${rawPort}"`);
}

const basePath = normalizeBasePath(process.env.BASE_PATH ?? "/");
const apiProxyTarget = process.env.VITE_API_PROXY_TARGET ?? "http://localhost:3000";
const appBuildTime = new Date().toISOString();
const appGitSha = normalizeBuildValue(
  process.env.READTOK_GIT_SHA ?? readGitSha() ?? "unknown",
);
const appVersion = normalizeBuildValue(
  process.env.READTOK_APP_VERSION ?? `${appBuildTime}-${appGitSha}`,
);

function normalizeBasePath(pathname: string) {
  if (pathname === "/") {
    return "/";
  }

  return `/${pathname.replace(/^\/+|\/+$/g, "")}/`;
}

function normalizeBuildValue(value: string) {
  return value.trim().replace(/[^a-zA-Z0-9._:-]/g, "-") || "unknown";
}

function readGitSha() {
  try {
    return execSync("git rev-parse --short=12 HEAD", {
      cwd: path.resolve(import.meta.dirname, "..", ".."),
      stdio: ["ignore", "pipe", "ignore"],
      encoding: "utf8",
    }).trim();
  } catch {
    return null;
  }
}

function appVersionManifestPlugin(): Plugin {
  return {
    name: "readtok-app-version-manifest",
    generateBundle(_options, bundle) {
      const entryChunk = Object.values(bundle).find(
        (item) =>
          item.type === "chunk" &&
          item.isEntry === true &&
          item.fileName.startsWith("assets/index-") &&
          item.fileName.endsWith(".js"),
      );

      this.emitFile({
        type: "asset",
        fileName: "version.json",
        source: `${JSON.stringify(
          {
            version: appVersion,
            buildTime: appBuildTime,
            gitSha: appGitSha,
            bundle: entryChunk ? `/${entryChunk.fileName}` : null,
          },
          null,
          2,
        )}\n`,
      });
    },
  };
}

export default defineConfig({
  base: basePath,
  define: {
    __READTOK_APP_VERSION__: JSON.stringify(appVersion),
    __READTOK_APP_BUILD_TIME__: JSON.stringify(appBuildTime),
    __READTOK_APP_GIT_SHA__: JSON.stringify(appGitSha),
  },
  plugins: [
    react(),
    tailwindcss(),
    appVersionManifestPlugin(),
    runtimeErrorOverlay(),
    ...(process.env.NODE_ENV !== "production" &&
    process.env.REPL_ID !== undefined
      ? [
          await import("@replit/vite-plugin-cartographer").then((m) =>
            m.cartographer({
              root: path.resolve(import.meta.dirname, ".."),
            }),
          ),
          await import("@replit/vite-plugin-dev-banner").then((m) =>
            m.devBanner(),
          ),
        ]
      : []),
  ],
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "src"),
      "@assets": path.resolve(import.meta.dirname, "..", "..", "attached_assets"),
    },
    dedupe: ["react", "react-dom"],
  },
  root: path.resolve(import.meta.dirname),
  build: {
    outDir: path.resolve(import.meta.dirname, "dist/public"),
    emptyOutDir: true,
  },
  server: {
    port,
    host: "0.0.0.0",
    allowedHosts: true,
    proxy: {
      "/api": {
        target: apiProxyTarget,
        changeOrigin: true,
      },
    },
    fs: {
      strict: true,
      deny: ["**/.*"],
    },
  },
  preview: {
    port,
    host: "0.0.0.0",
    allowedHosts: true,
  },
});
