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

function readHostname() {
  if (typeof window === "undefined") {
    return "";
  }
  return window.location.hostname.toLowerCase();
}

function isLocalDevelopmentHost(hostname: string) {
  if (
    hostname === "" ||
    hostname === "localhost" ||
    hostname === "127.0.0.1" ||
    hostname === "::1" ||
    hostname.endsWith(".local")
  ) {
    return true;
  }

  if (/^127\./.test(hostname) || /^192\.168\./.test(hostname) || /^10\./.test(hostname)) {
    return true;
  }

  const private172Match = hostname.match(/^172\.(\d{1,2})\./);
  if (private172Match) {
    const secondOctet = Number(private172Match[1]);
    return secondOctet >= 16 && secondOctet <= 31;
  }

  return false;
}

const runtimeConfig = readRuntimeConfig();
export const runtimeHostname = readHostname();

export const clerkPublishableKey = normalize(
  runtimeConfig.clerkPublishableKey || import.meta.env.VITE_CLERK_PUBLISHABLE_KEY,
);

export const clerkProxyUrl = normalize(
  runtimeConfig.clerkProxyUrl || import.meta.env.VITE_CLERK_PROXY_URL,
);

export const authEnabled = clerkPublishableKey.length > 0;
export const authConfigMissingOnHostedApp =
  !authEnabled && !isLocalDevelopmentHost(runtimeHostname);
