import rateLimit, { ipKeyGenerator } from "express-rate-limit";
import { param, query, validationResult } from "express-validator";
import { z } from "zod";
import type { Request, Response, NextFunction } from "express";
import { TORRENT_DOWNLOADER_TYPES, USENET_DOWNLOADER_TYPES } from "../shared/downloader-types.js";
import { GAME_STATUSES } from "../shared/schema.js";
import { normalizeReleaseTitle } from "../shared/title-utils.js";
import { storage } from "./storage.js";
import { expressLogger, middlewareLogger } from "./logger.js";
import { reportServerError } from "./error-telemetry.js";
import {
  isSafeConfiguredDownloadPath,
  isSafeDownloadPathOverride,
} from "./downloaders/path-safety.js";

const DOWNLOADER_TYPES = [...TORRENT_DOWNLOADER_TYPES, ...USENET_DOWNLOADER_TYPES];

// End-to-end runs (`npm run dev:test`) drive the whole app from a single IP within seconds,
// which trips the per-IP limits below and makes back-to-back or retried runs fail with 429s.
// DISABLE_RATE_LIMITS=true lets that harness opt out. It only takes effect when NODE_ENV is
// explicitly "development" or "test" (an unset NODE_ENV means production for the server
// config), so it can never switch the limits off in a real deployment.
export function rateLimitsDisabled(): boolean {
  const nodeEnv = process.env.NODE_ENV;
  return (
    process.env.DISABLE_RATE_LIMITS === "true" && (nodeEnv === "development" || nodeEnv === "test")
  );
}

// Pace IGDB-backed API routes to the configured per-user request rate. Browsing
// one page can issue several independent queries at once; rejecting those with
// 429s makes normal navigation fail. Queue ordinary bursts, while bounding the
// pending work so a client cannot build an unbounded backlog. IGDBClient also
// paces actual upstream requests globally.
type IgdbRequestQueue = {
  tail: Promise<void>;
  nextAllowedAt: number;
  pending: number;
  cleanupTimer?: ReturnType<typeof setTimeout>;
};

const igdbRequestQueues = new Map<string, IgdbRequestQueue>();
const MAX_PENDING_IGDB_REQUESTS = 30;

export const igdbRateLimiter = (req: Request, res: Response, next: NextFunction): void => {
  if (rateLimitsDisabled()) {
    next();
    return;
  }

  const userId = req.user?.id;
  const queueKey = userId ? `user:${userId}` : `ip:${ipKeyGenerator(req.ip ?? "unknown")}`;
  let queue = igdbRequestQueues.get(queueKey);
  if (!queue) {
    queue = { tail: Promise.resolve(), nextAllowedAt: 0, pending: 0 };
    igdbRequestQueues.set(queueKey, queue);
  }

  if (queue.cleanupTimer) {
    clearTimeout(queue.cleanupTimer);
    delete queue.cleanupTimer;
  }

  if (queue.pending >= MAX_PENDING_IGDB_REQUESTS) {
    res.set("Retry-After", "1").status(429).json({
      message: "Too many IGDB requests are queued; try again shortly",
    });
    return;
  }

  queue.pending++;
  const queuedRequest = queue.tail.then(async () => {
    let requestsPerSecond = 3;
    if (userId) {
      try {
        const settings = await storage.getUserSettings(userId);
        requestsPerSecond = settings?.igdbRateLimitPerSecond ?? requestsPerSecond;
      } catch (error) {
        middlewareLogger.error({ error }, "Error fetching user IGDB rate limit; defaulting to 3");
      }
    }

    const intervalMs = 1000 / Math.min(4, Math.max(1, requestsPerSecond));
    const delayMs = Math.max(0, queue!.nextAllowedAt - Date.now());
    if (delayMs > 0) {
      await new Promise((resolve) => setTimeout(resolve, delayMs));
    }
    queue!.nextAllowedAt = Date.now() + intervalMs;
    if (!res.destroyed) next();
  });

  queue.tail = queuedRequest
    .catch((error) => {
      middlewareLogger.error({ error }, "Error scheduling IGDB request");
      if (!res.headersSent && !res.destroyed) next();
    })
    .finally(() => {
      queue!.pending--;
      if (queue!.pending === 0) {
        const cleanupDelay = Math.max(0, queue!.nextAllowedAt - Date.now());
        queue!.cleanupTimer = setTimeout(() => {
          if (queue!.pending === 0 && igdbRequestQueues.get(queueKey) === queue) {
            igdbRequestQueues.delete(queueKey);
          }
        }, cleanupDelay);
        queue!.cleanupTimer.unref?.();
      }
    });
};

// Rate limiter for sensitive endpoints (write operations)
export const sensitiveEndpointLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 30, // limit each IP to 30 requests per minute
  message: "Too many requests, please try again later",
  standardHeaders: true,
  legacyHeaders: false,
  skip: rateLimitsDisabled,
});

// Rate limiter for authentication/login endpoints
export const authRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 20, // limit each IP to 20 requests per 15 minutes
  message: "Too many authentication attempts, please try again later",
  standardHeaders: true,
  legacyHeaders: false,
  skip: rateLimitsDisabled,
});

// Rate limiter for expensive per-user filesystem work (recursive scans).
// Keyed by authenticated user id so one user hammering scans cannot
// starve other users, with the client IP as fallback for safety.
export const scanRateLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 10, // limit each user to 10 scans per minute
  keyGenerator: (req: Request) => {
    const userId = req.user?.id;
    if (userId) return `user:${userId}`;
    return ipKeyGenerator(req.ip ?? "unknown");
  },
  message: "Too many scan requests, please try again later",
  standardHeaders: true,
  legacyHeaders: false,
  skip: rateLimitsDisabled,
});

// A secondary limit after authentication keeps one integration credential from
// spreading requests across many source IPs. The earlier general API limiter
// still provides a per-IP ceiling for both valid and invalid credentials.
export const integrationRateLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 300,
  keyGenerator: (req: Request) => {
    if (req.apiKeyId) return `api-key:${req.apiKeyId}`;
    if (req.user?.id) return `user:${req.user.id}`;
    return ipKeyGenerator(req.ip ?? "unknown");
  },
  message: "Too many integration requests, please try again later",
  standardHeaders: true,
  legacyHeaders: false,
});

// General API rate limiter (lenient, just to prevent abuse)
export const generalApiLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  // The SPA alone can spend ~90 requests in 40 s (library load + download dialogs), so a
  // lower ceiling throttles normal browsing. Login has its own, much stricter limiter.
  max: 600, // limit each IP to 600 requests per minute
  message: "Too many requests, please try again later",
  standardHeaders: true,
  legacyHeaders: false,
  skip: rateLimitsDisabled,
});

// Rate limiter for the SPA catch-all route (vite's dev middleware transform and the
// production static/index.html fallback). generalApiLimiter only covers "/api", so
// without this, that wildcard handler — which does a disk read (and, in dev, a full
// Vite HTML transform) on every request — has no limit at all. Kept more permissive
// than the API limiter since real page loads fan out into many asset requests.
export const staticAssetLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 300, // limit each IP to 300 requests per minute
  message: "Too many requests, please try again later",
  standardHeaders: true,
  legacyHeaders: false,
  skip: rateLimitsDisabled,
});

/**
 * Validate and normalize a request body before a route handler can perform
 * side effects. Only issue metadata is returned or logged; raw inputs are
 * deliberately omitted so credentials and archive passwords cannot leak.
 */
export function validate<TSchema extends z.ZodTypeAny>(schema: TSchema) {
  return (req: Request, res: Response, next: NextFunction) => {
    const result = schema.safeParse(req.body);
    if (!result.success) {
      const details = result.error.issues.map(({ path, message, code }) => ({
        path: path.join("."),
        msg: message,
        code,
      }));
      expressLogger.warn(
        { path: req.path, method: req.method, validationErrors: details },
        "Validation failed"
      );
      return res.status(400).json({ error: "Validation failed", details });
    }
    req.body = result.data;
    return next();
  };
}

// Validation middleware to check for express-validator query/parameter errors.
// Request bodies use validate(schema) so error details have the same safe shape.
export const validateRequest = (req: Request, res: Response, next: NextFunction) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    const details = errors.array().map((validationError) => ({
      location: "location" in validationError ? validationError.location : undefined,
      path: "path" in validationError ? validationError.path : undefined,
      msg: validationError.msg,
    }));
    expressLogger.warn(
      { path: req.path, method: req.method, validationErrors: details },
      "Validation failed"
    );
    return res.status(400).json({
      error: "Validation failed",
      details,
    });
  }
  return next();
};

// Sanitization rules for game search queries
export const sanitizeSearchQuery = [
  query("q")
    .trim()
    .isLength({ min: 1, max: 200 })
    .withMessage("Search query must be between 1 and 200 characters"),
  query("search")
    .optional()
    .trim()
    .isLength({ max: 200 })
    .withMessage("Search query must be at most 200 characters"),
  query("limit")
    .optional()
    .isInt({ min: 1, max: 100 })
    .withMessage("Limit must be between 1 and 100")
    .toInt(),
  query("includeUndated")
    .optional()
    .isBoolean()
    .withMessage("includeUndated must be a boolean")
    .toBoolean(),
  query("platform")
    .optional()
    .isInt({ min: 1 })
    .withMessage("Platform must be a valid IGDB platform ID")
    .toInt(),
  query("year")
    .optional()
    .isInt({ min: 1950, max: 2100 })
    .withMessage("Year must be between 1950 and 2100")
    .toInt(),
];

// Sanitization rules for game ID parameters
export const sanitizeGameId = [
  param("id")
    .trim()
    .matches(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i)
    .withMessage("Invalid game ID format"),
];

// Sanitization rules for root folder ID parameters
export const sanitizeRootFolderId = [
  param("id")
    .trim()
    .matches(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i)
    .withMessage("Invalid root folder ID format"),
];

// Sanitization rules for download record ID parameters
export const sanitizeDownloadId = [
  param("downloadId")
    .trim()
    .matches(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i)
    .withMessage("Invalid download ID format"),
];

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Sanitization rules for the game journal/milestone/screenshot sub-resource ID params
export const sanitizeJournalEntryId = [
  param("entryId").trim().matches(UUID_PATTERN).withMessage("Invalid journal entry ID format"),
];

export const sanitizeMilestoneId = [
  param("milestoneId").trim().matches(UUID_PATTERN).withMessage("Invalid milestone ID format"),
];

export const sanitizeScreenshotId = [
  param("screenshotId").trim().matches(UUID_PATTERN).withMessage("Invalid screenshot ID format"),
];

// Sanitization rules for IGDB ID parameters
export const sanitizeIgdbId = [
  param("id").trim().isInt({ min: 1 }).withMessage("Invalid IGDB ID").toInt(),
];

// Sanitization rules for game status updates
const gameStatusBodySchema = z
  .object({ status: z.string().trim().pipe(z.enum(GAME_STATUSES)) })
  .passthrough();
export const sanitizeGameStatus = [validate(gameStatusBodySchema)];

const numberFromRequest = (value: unknown): unknown => {
  if (typeof value !== "string" || value.trim() === "") return value;
  return Number(value);
};

const booleanFromRequest = (value: unknown): unknown => {
  if (typeof value === "boolean") return value;
  if (value === 1 || value === "1") return true;
  if (value === 0 || value === "0") return false;
  if (typeof value === "string") {
    const normalized = value.trim().toLowerCase();
    if (["true", "yes", "on"].includes(normalized)) return true;
    if (["false", "no", "off"].includes(normalized)) return false;
  }
  return value;
};

const requestBooleanSchema = z.preprocess(booleanFromRequest, z.boolean());
const requestNumberSchema = <TSchema extends z.ZodTypeAny>(schema: TSchema) =>
  z.preprocess(numberFromRequest, schema);

const isHttpUrl = (value: string): boolean => {
  try {
    return ["http:", "https:"].includes(new URL(value).protocol);
  } catch {
    return false;
  }
};

// Sanitization rules for adding games
const optionalText = (max: number) => z.string().trim().max(max).optional();
const optionalTextArray = (max: number) => z.array(z.string().trim().max(max)).optional();

const gameDataBodySchema = z
  .object({
    title: z.string().trim().min(1).max(500),
    igdbId: requestNumberSchema(z.number().int().min(1)).nullable().optional(),
    summary: optionalText(5000),
    coverUrl: z
      .string()
      .trim()
      .optional()
      .refine((value) => !value || isHttpUrl(value), "Invalid cover URL"),
    releaseDate: z
      .string()
      .trim()
      .optional()
      .nullable()
      .refine((value) => !value || /^\d{4}-\d{2}-\d{2}$/.test(value), {
        message: "Invalid date format, use YYYY-MM-DD",
      }),
    rating: requestNumberSchema(z.number().min(0).max(10)).nullable().optional(),
    platforms: optionalTextArray(100),
    genres: optionalTextArray(100),
    publishers: optionalTextArray(200),
    developers: optionalTextArray(200),
  })
  .passthrough();
export const sanitizeGameData = [validate(gameDataBodySchema)];

// Sanitization rules for indexer data
const indexerBaseBodySchema = z
  .object({
    name: z.string().trim().min(1).max(200),
    url: z.string().trim().min(1).refine(isHttpUrl, "Invalid URL"),
    apiKey: optionalText(500),
    protocol: z.enum(["torznab", "newznab", "g4u", "json-catalog"]).optional(),
    enabled: requestBooleanSchema.optional(),
    allowInsecureLan: requestBooleanSchema.optional(),
  })
  .passthrough();
export const sanitizeIndexerData = [validate(indexerBaseBodySchema)];

// Sanitization rules for partial indexer updates (PATCH)
const indexerUpdateBodySchema = z
  .object({
    name: z.string().trim().min(1).max(200).optional(),
    url: z
      .string()
      .trim()
      .optional()
      .refine((value) => !value || isHttpUrl(value), "Invalid URL"),
    apiKey: optionalText(500),
    protocol: z.enum(["torznab", "newznab", "g4u", "json-catalog"]).optional(),
    enabled: requestBooleanSchema.optional(),
    priority: requestNumberSchema(z.number().int().min(1)).optional(),
    categories: z.array(z.unknown()).optional(),
    rssEnabled: requestBooleanSchema.optional(),
    autoSearchEnabled: requestBooleanSchema.optional(),
    allowInsecureLan: requestBooleanSchema.optional(),
  })
  .passthrough();
export const sanitizeIndexerUpdateData = [validate(indexerUpdateBodySchema)];

// Sanitization rules for downloader data
// Accepts hostname, IP address, or FQDN -- shared by every downloader URL
// validator below so the pattern (and any future fix to it) lives in one
// place instead of being copy-pasted per route.
const DOWNLOADER_HOSTNAME_REGEX =
  /^[a-zA-Z0-9]([a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(\.[a-zA-Z0-9]([a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$/;
const DOWNLOADER_IP_REGEX = /^(\d{1,3}\.){3}\d{1,3}$/;

/**
 * A downloader's `url` field accepts either a full http(s) URL, or (for a
 * recognized downloader type) a bare hostname/IP/FQDN. Shared by
 * sanitizeDownloaderData, sanitizeDownloaderTestData, and
 * sanitizeDownloaderUpdateData.
 */
function isValidDownloaderUrl(value: string, type: unknown): boolean {
  if (/^https?:\/\/.+/.test(value)) return true;
  if (typeof type === "string" && (DOWNLOADER_TYPES as readonly string[]).includes(type)) {
    return DOWNLOADER_HOSTNAME_REGEX.test(value) || DOWNLOADER_IP_REGEX.test(value);
  }
  return false;
}

const downloaderTypeSchema = z
  .string()
  .trim()
  .refine(
    (value) => (DOWNLOADER_TYPES as readonly string[]).includes(value),
    "Invalid downloader type"
  );
const optionalDownloaderText = (max: number, label: string) =>
  z.string().trim().max(max, `${label} must be at most ${max} characters`).optional();
const optionalConfiguredDownloadPath = z
  .string()
  .trim()
  .max(500, "Download path must be at most 500 characters")
  .refine(isSafeConfiguredDownloadPath, "Download path cannot contain parent-directory segments")
  .optional();
const strictRequestBooleanSchema = z.boolean();
const optionalStrictBoolean = () => strictRequestBooleanSchema.optional();
const optionalCompatibleBoolean = () => requestBooleanSchema.optional();
const optionalDownloaderFields = {
  username: optionalDownloaderText(200, "Username"),
  password: optionalDownloaderText(200, "Password"),
  category: optionalDownloaderText(100, "Category"),
  label: optionalDownloaderText(100, "Label"),
  urlPath: optionalDownloaderText(200, "URL path"),
  allowSelfSignedCertificate: optionalStrictBoolean(),
  allowInsecureLan: optionalStrictBoolean(),
};

const downloaderCreateBodySchema = z
  .object({
    name: z.string().trim().min(1).max(200),
    type: downloaderTypeSchema,
    url: z.string().trim().min(1),
    ...optionalDownloaderFields,
    enabled: optionalCompatibleBoolean(),
    downloadPath: optionalConfiguredDownloadPath,
  })
  .superRefine((data, ctx) => {
    if (!isValidDownloaderUrl(data.url, data.type)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["url"],
        message: "Invalid URL or hostname",
      });
    }
  })
  .passthrough();
export const sanitizeDownloaderData = [validate(downloaderCreateBodySchema)];

// Optional settings applied to every indexer a Prowlarr sync imports. Omitted
// fields fall back to the sync's own defaults (see ProwlarrClient.getIndexers).
const prowlarrSyncBodySchema = z
  .object({
    allowInsecureLan: optionalStrictBoolean(),
    priority: requestNumberSchema(z.number().int().min(1).max(100)).optional(),
    categories: z
      .array(
        z.string().regex(/^\d{1,6}$/, "Each category must be a numeric Torznab/Newznab category id")
      )
      .max(100, "Categories must be an array of at most 100 entries")
      .optional(),
  })
  .passthrough();
export const sanitizeProwlarrSyncData = [validate(prowlarrSyncBodySchema)];

// Sanitization rules for POST /api/downloaders/test -- validates the full
// request body before it's used to build a temporary Downloader and test a
// live connection, rather than only checking allowSelfSignedCertificate's
// type. Distinct from sanitizeDownloaderData because this route never takes
// a `name` (the server synthesizes one) and has its own body shape.
const downloaderTestBodySchema = z
  .object({
    type: downloaderTypeSchema,
    url: z.string().trim().min(1),
    port: requestNumberSchema(z.number().int().min(1).max(65535)).optional(),
    useSsl: optionalStrictBoolean(),
    urlPath: optionalDownloaderText(200, "URL path"),
    username: optionalDownloaderText(200, "Username"),
    password: optionalDownloaderText(200, "Password"),
    downloadPath: optionalConfiguredDownloadPath,
    category: optionalDownloaderText(100, "Category"),
    label: optionalDownloaderText(100, "Label"),
    addStopped: optionalStrictBoolean(),
    removeCompleted: optionalStrictBoolean(),
    postImportCategory: optionalDownloaderText(100, "Post-import category"),
    settings: z.string().nullable().optional(),
    allowSelfSignedCertificate: optionalStrictBoolean(),
    allowInsecureLan: optionalStrictBoolean(),
  })
  .superRefine((data, ctx) => {
    if (!isValidDownloaderUrl(data.url, data.type)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["url"],
        message: "Invalid URL or hostname",
      });
    }
  })
  .passthrough();
export const sanitizeDownloaderTestData = [validate(downloaderTestBodySchema)];

// Sanitization rules for partial downloader updates (PATCH)
const downloaderUpdateBodySchema = z
  .object({
    name: z.string().trim().min(1).max(200).optional(),
    type: downloaderTypeSchema.optional(),
    url: z.string().trim().optional(),
    ...optionalDownloaderFields,
    enabled: optionalCompatibleBoolean(),
    priority: requestNumberSchema(z.number().int().min(1)).optional(),
    downloadPath: optionalConfiguredDownloadPath,
  })
  .superRefine((data, ctx) => {
    if (data.url && !isValidDownloaderUrl(data.url, data.type)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["url"],
        message: "Invalid URL or hostname",
      });
    }
  })
  .passthrough();
export const sanitizeDownloaderUpdateData = [validate(downloaderUpdateBodySchema)];

// Sanitization rules for download add requests
const downloaderDownloadBodySchema = z
  .object({
    url: z
      .string()
      .trim()
      .refine((value) => {
        try {
          return ["http:", "https:", "magnet:"].includes(new URL(value).protocol);
        } catch {
          return false;
        }
      }, "Invalid download URL"),
    title: z.string().transform(normalizeReleaseTitle).pipe(z.string().min(1).max(500)),
    category: optionalDownloaderText(100, "Category"),
    releaseCategory: z.enum(["main", "update", "dlc", "extra", "packs"]).optional(),
    downloadType: z.enum(["torrent", "usenet"]).optional(),
    downloadPath: z
      .string()
      .trim()
      .max(500)
      .refine(
        isSafeDownloadPathOverride,
        "Download path must be relative and cannot contain parent-directory segments"
      )
      .optional(),
    priority: requestNumberSchema(z.number().int().min(0).max(10)).optional(),
    gameId: z.string().trim().regex(UUID_PATTERN).optional(),
    password: z.string().max(200, "Password must be at most 200 characters").optional(),
  })
  .passthrough();
export const sanitizeDownloaderDownloadData = [validate(downloaderDownloadBodySchema)];

// Sanitization rules for indexer search queries
export const sanitizeIndexerSearchQuery = [
  query("fileTypes")
    .optional()
    .isString()
    .isLength({ max: 120 })
    .matches(/^\.?[a-zA-Z0-9]{1,10}(,\.?[a-zA-Z0-9]{1,10}){0,9}$/)
    .withMessage("File types must be a comma-separated list of up to ten extensions"),
  query("query")
    .trim()
    .isLength({ min: 1, max: 200 })
    .withMessage("Search query must be between 1 and 200 characters"),
  query("category")
    .optional()
    .trim()
    .isLength({ max: 500 })
    .withMessage("Category must be at most 500 characters"),
  query("cat")
    .optional()
    .trim()
    .isLength({ max: 500 })
    .withMessage("Category alias (cat) must be at most 500 characters"),
  query("limit")
    .optional()
    .isInt({ min: 1, max: 100 })
    .withMessage("Limit must be between 1 and 100")
    .toInt(),
  query("offset")
    .optional()
    .isInt({ min: 0, max: Number.MAX_SAFE_INTEGER })
    .withMessage("Offset must be a non-negative integer within safe bounds")
    .toInt(),
];

// Sanitization rules for the game-status route param
export const sanitizeGameStatusParam = [
  param("status").trim().isIn(GAME_STATUSES).withMessage("Invalid status value"),
];

// Sanitization rules for the Quick Add (match-and-add) title
export const sanitizeMatchAndAddTitle = [
  validate(z.object({ title: z.string().trim().min(1).max(500) }).passthrough()),
];

// Sanitization rules for NexusMods game-domain lookup
export const sanitizeNexusModsGameDomainQuery = [
  query("title")
    .trim()
    .isLength({ min: 1, max: 500 })
    .withMessage("title must be between 1 and 500 characters"),
];

// Sanitization rules for NexusMods trending-mods lookup
export const sanitizeNexusModsTrendingModsQuery = [
  query("domain")
    .trim()
    .isLength({ min: 1, max: 200 })
    .withMessage("domain must be between 1 and 200 characters"),
  query("limit")
    .optional()
    .isInt({ min: 1, max: 20 })
    .withMessage("limit must be between 1 and 20")
    .toInt(),
];

// Sanitization rules for root folder creation
export const sanitizeRootFolderData = [
  validate(
    z
      .object({
        path: z
          .string()
          .trim()
          .min(1)
          .max(1000)
          .refine((value) => !value.includes("\0"), "Path must not contain null bytes"),
        name: z.string().trim().max(200).optional(),
        enabled: requestBooleanSchema.optional(),
        allowDelete: requestBooleanSchema.optional(),
      })
      .passthrough()
  ),
];

// Sanitization rules for partial root folder updates (PATCH)
export const sanitizeRootFolderUpdateData = [
  validate(
    z
      .object({
        path: z
          .string()
          .trim()
          .min(1)
          .max(1000)
          .refine((value) => !value.includes("\0"), "Path must not contain null bytes")
          .optional(),
        name: z.string().trim().max(200).nullable().optional(),
        enabled: requestBooleanSchema.optional(),
        allowDelete: requestBooleanSchema.optional(),
      })
      .passthrough()
  ),
];

// Sanitization rules for POST /api/library/scan (rootFolderId is optional — omit to scan all)
export const sanitizeLibraryScanData = [
  validate(
    z
      .object({
        rootFolderId: z.string().trim().min(1).max(200).optional(),
      })
      .passthrough()
      .optional()
      .default({})
  ),
];

// Sanitization rules for POST /api/library/scan/unmatched/match
export const sanitizeUnmatchedMatchData = [
  validate(
    z
      .object({
        rootFolderId: z.string().trim().min(1).max(200),
        folderName: z.string().trim().min(1).max(1000),
        igdbId: requestNumberSchema(z.number().int().min(1)),
      })
      .passthrough()
  ),
];

export const sanitizeUnmatchedSearchData = [
  validate(
    z
      .object({
        rootFolderId: z.string().trim().min(1).max(200),
        folderName: z.string().trim().min(1).max(1000),
        query: z.string().trim().min(1).max(200),
      })
      .passthrough()
  ),
];

// 🛡️ Sentinel: Global error handler middleware
// Standardizes error responses and prevents leakage of sensitive details in production
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const errorHandler = (err: any, req: Request, res: Response, next: NextFunction) => {
  const status = err.status || err.statusCode || 500;

  // Log the error using our logger instead of relying on default express handler logging
  // Use error level for 5xx, warn/info for client errors
  if (status >= 500) {
    expressLogger.error({ err, path: req.path, method: req.method }, "Request error");
    // Fire-and-forget: detect + report unhandled server errors for the automatic
    // error-telemetry pipeline. Never let this delay or fail the response.
    void reportServerError(err, {
      source: "expressErrorHandler",
      path: req.path,
      method: req.method,
    });
  } else {
    expressLogger.warn({ err, path: req.path, method: req.method }, "Request error");
  }

  // Determine the error message to show to the client
  // Sanitize server-error messages and details in production to prevent information leakage.
  // Keep the original error intact above so it remains available in server logs.
  const isProductionServerError = req.app.get("env") === "production" && status >= 500;
  let message = err.message || "Internal Server Error";
  if (isProductionServerError) {
    message = "Internal Server Error";
  }

  // Include details for validation/client errors, but never expose server-error internals
  // to production clients.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const response: { error: string; details?: any } = { error: message };
  if (err.details && !isProductionServerError) {
    response.details = err.details;
  }

  // If headers already sent, we can't send a JSON response
  if (res.headersSent) {
    return next(err);
  }

  res.status(status).json(response);
};
