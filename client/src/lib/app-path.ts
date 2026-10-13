import { appRoutePaths } from "@/lib/routes";

const URL_SCHEME_RE = /^[a-zA-Z][a-zA-Z\d+.-]*:/;
const DEV_ENTRY_PATH = "/src/main.tsx";
const BUILT_ASSETS_SEGMENT = "/assets/";

export function normalizeBasePath(path: string): string {
  if (!path || path === "." || path === "./") {
    return "/";
  }

  const withLeadingSlash = path.startsWith("/") ? path : `/${path}`;
  return withLeadingSlash.endsWith("/") ? withLeadingSlash : `${withLeadingSlash}/`;
}

function trimTrailingSlashes(path: string): string {
  let end = path.length;
  while (end > 0 && path[end - 1] === "/") {
    end--;
  }
  return path.slice(0, end) || "/";
}

function resolveBasePathFromRuntimeAsset(runtimeAssetHref?: string): string | undefined {
  if (!runtimeAssetHref) {
    return undefined;
  }

  try {
    const pathname = new URL(runtimeAssetHref).pathname;

    if (pathname.endsWith(DEV_ENTRY_PATH)) {
      return normalizeBasePath(pathname.slice(0, -DEV_ENTRY_PATH.length) || "/");
    }

    const builtAssetsIndex = pathname.lastIndexOf(BUILT_ASSETS_SEGMENT);
    if (builtAssetsIndex >= 0) {
      return normalizeBasePath(pathname.slice(0, builtAssetsIndex) || "/");
    }
  } catch {
    return undefined;
  }

  return undefined;
}

function findMatchedRoute(pathname: string): string | undefined {
  const normalizedPathname = trimTrailingSlashes(pathname);

  return [...appRoutePaths]
    .filter((route) => route !== "/")
    .sort((left, right) => right.length - left.length)
    .find((route) => normalizedPathname === route || normalizedPathname.endsWith(route));
}

export function resolveBasePathFrom(
  configuredBase: string,
  currentHref?: string,
  runtimeAssetHref?: string
): string {
  if (configuredBase === "./") {
    const runtimeBasePath = resolveBasePathFromRuntimeAsset(runtimeAssetHref);
    if (runtimeBasePath) {
      return runtimeBasePath;
    }

    if (!currentHref) {
      return "/";
    }

    try {
      const pathname = trimTrailingSlashes(new URL(currentHref).pathname);
      const matchedRoute = findMatchedRoute(pathname);

      if (matchedRoute) {
        const basePath = pathname.slice(0, -matchedRoute.length) || "/";
        return normalizeBasePath(basePath);
      }

      // Without a recognized route or a loaded runtime asset, the deployment
      // prefix cannot be distinguished safely from an unknown nested route.
      // Fail closed at the origin root instead of sending API/socket traffic
      // to a path inferred from that unknown route.
      return "/";
    } catch {
      return "/";
    }
  }

  if (!currentHref) {
    return normalizeBasePath(configuredBase);
  }

  try {
    return normalizeBasePath(new URL(configuredBase, currentHref).pathname);
  } catch {
    return normalizeBasePath(configuredBase);
  }
}

const configuredBase = import.meta.env.BASE_URL || "/";
const currentHref = typeof window === "undefined" ? undefined : window.location.href;
const runtimeAssetHref =
  typeof document === "undefined"
    ? undefined
    : document.querySelector<HTMLScriptElement>('script[type="module"][src]')?.src;

export const appBasePath = resolveBasePathFrom(configuredBase, currentHref, runtimeAssetHref);
export const routerBase = appBasePath === "/" ? undefined : appBasePath.slice(0, -1);

export function withBasePathFrom(basePath: string, path: string): string {
  if (!path || path === "/") {
    return basePath;
  }

  if (URL_SCHEME_RE.test(path) || path.startsWith("//") || path.startsWith("#")) {
    return path;
  }

  const basePrefix = basePath === "/" ? "" : basePath.slice(0, -1);
  if (basePrefix && (path === basePrefix || path.startsWith(`${basePrefix}/`))) {
    return path;
  }

  if (path.startsWith("/")) {
    return `${basePrefix}${path}`;
  }

  return `${basePath}${path}`;
}

export function withBasePath(path: string): string {
  return withBasePathFrom(appBasePath, path);
}

export function getSocketPath(): string {
  return withBasePath("/socket.io/");
}
