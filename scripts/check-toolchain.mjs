#!/usr/bin/env node
import { execFileSync } from "node:child_process";

const REQUIRED_NODE = ">=20.19.0 <21 || >=22.12.0";
const REQUIRED_PNPM = "10.33.2";

function parseVersion(version) {
  const match = version.trim().replace(/^v/, "").match(/^(\d+)\.(\d+)\.(\d+)/);
  if (!match) {
    return null;
  }

  return {
    major: Number(match[1]),
    minor: Number(match[2]),
    patch: Number(match[3])
  };
}

function compareVersion(a, b) {
  if (a.major !== b.major) return a.major - b.major;
  if (a.minor !== b.minor) return a.minor - b.minor;
  return a.patch - b.patch;
}

function nodeVersionIsSupported(version) {
  const parsed = parseVersion(version);
  if (!parsed) return false;

  if (parsed.major === 20) {
    return compareVersion(parsed, { major: 20, minor: 19, patch: 0 }) >= 0;
  }

  if (parsed.major === 22) {
    return compareVersion(parsed, { major: 22, minor: 12, patch: 0 }) >= 0;
  }

  return parsed.major > 22;
}

function fail(message) {
  console.error(message);
  process.exit(1);
}

const nodeVersion = process.version;

if (!nodeVersionIsSupported(nodeVersion)) {
  fail(
    [
      `[toolchain] Node ${nodeVersion} is not supported.`,
      `[toolchain] Required Node: ${REQUIRED_NODE}`,
      "[toolchain] This repo uses Vite 7/Rollup 4, which need modern Node native packages.",
      "[toolchain] Run `nvm install && nvm use`, then `corepack pnpm install`."
    ].join("\n")
  );
}

if (process.argv.includes("--pnpm")) {
  let pnpmVersion = "";
  try {
    pnpmVersion = execFileSync("corepack", ["pnpm", "-v"], {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"]
    }).trim();
  } catch (error) {
    fail(
      [
        "[toolchain] Could not run pnpm through Corepack.",
        "[toolchain] Run `corepack enable` and try again.",
        error instanceof Error ? error.message : String(error)
      ].join("\n")
    );
  }

  if (pnpmVersion !== REQUIRED_PNPM) {
    fail(
      [
        `[toolchain] pnpm ${pnpmVersion} is not supported.`,
        `[toolchain] Required pnpm: ${REQUIRED_PNPM}`,
        `Run \`corepack prepare pnpm@${REQUIRED_PNPM} --activate\`.`
      ].join("\n")
    );
  }
}

console.log(`[toolchain] OK: Node ${nodeVersion}, pnpm ${REQUIRED_PNPM}`);
