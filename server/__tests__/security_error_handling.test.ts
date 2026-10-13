import { beforeEach, describe, it, expect, vi } from "vitest";
import express from "express";
import request from "supertest";
import { errorHandler } from "../middleware.js";
import { expressLogger } from "../logger.js";

// Mock logger to avoid actual logging during tests
vi.mock("../logger.js", () => ({
  expressLogger: {
    error: vi.fn(),
    warn: vi.fn(),
  },
}));

// Mock storage since middleware might import it
vi.mock("../storage.js", () => ({
  storage: {
    getUserSettings: vi.fn(),
  },
}));

// The error handler fires the automatic error-telemetry pipeline for 5xx errors
// (fire-and-forget). Mock it out here — these tests only care about the HTTP
// response the error handler produces, not telemetry reporting.
vi.mock("../error-telemetry.js", () => ({
  reportServerError: vi.fn(),
}));

describe("Security Error Handling", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should sanitize 500 errors in production", async () => {
    const app = express();
    app.set("env", "production");

    app.get("/error", (req, res, next) => {
      const err: any = new Error("Sensitive Database Info");
      err.status = 500;
      next(err);
    });

    app.use(errorHandler);

    const response = await request(app).get("/error");
    expect(response.status).toBe(500);
    expect(response.body.error).toBe("Internal Server Error");
    expect(response.body.error).not.toContain("Sensitive Database Info");
  });

  it.each([500, 503])(
    "should hide server error details from production clients (%i)",
    async (status) => {
      const app = express();
      app.set("env", "production");
      const details = { database: "private details", stack: "private trace" };

      app.get("/error", (_req, _res, next) => {
        const err: any = new Error("Sensitive internal failure");
        err.status = status;
        err.details = details;
        next(err);
      });

      app.use(errorHandler);

      const response = await request(app).get("/error");

      expect(response.status).toBe(status);
      expect(response.body).toEqual({ error: "Internal Server Error" });
      expect(expressLogger.error).toHaveBeenCalledWith(
        expect.objectContaining({
          err: expect.objectContaining({ message: "Sensitive internal failure", details }),
        }),
        "Request error"
      );
    }
  );

  it("should show details in development", async () => {
    const app = express();
    app.set("env", "development");

    app.get("/error", (req, res, next) => {
      const err: any = new Error("Debug Info");
      err.status = 500;
      next(err);
    });

    app.use(errorHandler);

    const response = await request(app).get("/error");
    expect(response.status).toBe(500);
    expect(response.body.error).toBe("Debug Info");
  });

  it("should pass through client errors (4xx) unchanged", async () => {
    const app = express();
    // Environment shouldn't matter for 4xx
    app.set("env", "production");

    app.get("/error", (req, res, next) => {
      const err: any = new Error("Invalid Input");
      err.status = 400;
      next(err);
    });

    app.use(errorHandler);

    const response = await request(app).get("/error");
    expect(response.status).toBe(400);
    expect(response.body.error).toBe("Invalid Input");
  });

  it("should handle errors explicitly thrown without status", async () => {
    const app = express();
    app.set("env", "production");

    app.get("/error", (req, res, next) => {
      next(new Error("Unexpected Error"));
    });

    app.use(errorHandler);

    const response = await request(app).get("/error");
    expect(response.status).toBe(500);
    expect(response.body.error).toBe("Internal Server Error");
  });

  it("should include error details when provided", async () => {
    const app = express();
    app.set("env", "production");

    app.get("/error", (_req, _res, next) => {
      const err: any = new Error("Validation failed");
      err.status = 400;
      err.details = [{ field: "name", message: "Required" }];
      next(err);
    });

    app.use(errorHandler);

    const response = await request(app).get("/error");
    expect(response.status).toBe(400);
    expect(response.body.error).toBe("Validation failed");
    expect(response.body.details).toEqual([{ field: "name", message: "Required" }]);
  });

  it("should delegate when headers are already sent", async () => {
    const err: any = new Error("late failure");
    err.status = 500;

    const req: any = {
      app: { get: vi.fn().mockReturnValue("production") },
      path: "/error",
      method: "GET",
    };
    const res: any = {
      headersSent: true,
      status: vi.fn().mockReturnThis(),
      json: vi.fn(),
    };
    const next = vi.fn();

    errorHandler(err, req, res, next);

    expect(next).toHaveBeenCalledWith(err);
    expect(res.status).not.toHaveBeenCalled();
    expect(res.json).not.toHaveBeenCalled();
  });
});
