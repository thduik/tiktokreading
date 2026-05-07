interface ReadTokRuntimeConfig {
  clerkPublishableKey?: string;
  clerkProxyUrl?: string;
}

declare global {
  interface Window {
    __READTOK_CONFIG?: ReadTokRuntimeConfig;
  }
}

function readRuntimeConfig(): ReadTokRuntimeConfig {
  if (typeof window === "undefined") {
    return {};
  }
  return window.__READTOK_CONFIG ?? {};
}

function normalize(value: string | undefined): string {
  return value?.trim() ?? "";
}

const runtimeConfig = readRuntimeConfig();

export const clerkPublishableKey = normalize(
  runtimeConfig.clerkPublishableKey || import.meta.env.VITE_CLERK_PUBLISHABLE_KEY,
);

export const clerkProxyUrl = normalize(
  runtimeConfig.clerkProxyUrl || import.meta.env.VITE_CLERK_PROXY_URL,
);

export const authEnabled = clerkPublishableKey.length > 0;
