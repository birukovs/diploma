import "../instrument.mjs";
import express from "express";
import { ENV } from "./config/env.js";
import { connectDB } from "./config/db.js";
import { clerkMiddleware } from "@clerk/express";
import { functions, inngest } from "./config/inngest.js";
import { serve } from "inngest/express";
import chatRoutes from "./routes/chat.route.js";
import cors from "cors";
import * as Sentry from "@sentry/node";

const app = express();

const decodeFrontendApiFromPublishableKey = (key) => {
  try {
    if (typeof key !== "string") return null;
    const parts = key.split("_");
    if (parts.length < 3) return null;
    const decoded = Buffer.from(parts[2], "base64").toString("utf8");
    if (!decoded.endsWith("$")) return null;
    return decoded.slice(0, -1).toLowerCase();
  } catch {
    return null;
  }
};

const getPublishableKeyFromRequest = (req) => {
  try {
    const rawUrl = req.originalUrl || req.url || "";
    const url = new URL(rawUrl, "https://proxy.local");
    const candidates = [
      url.searchParams.get("_clerk_publishable_key"),
      url.searchParams.get("__clerk_publishable_key"),
      url.searchParams.get("clerk_publishable_key"),
      url.searchParams.get("publishable_key"),
    ];

    const key = candidates.find((value) => typeof value === "string" && value.startsWith("pk_"));
    return key || null;
  } catch {
    return null;
  }
};

const getClerkFrontendApiHost = (req) => {
  const fromRequestKey = decodeFrontendApiFromPublishableKey(getPublishableKeyFromRequest(req));
  if (fromRequestKey) return fromRequestKey;

  const fromEnv = process.env.CLERK_FRONTEND_API_HOST?.trim().toLowerCase();
  if (fromEnv) return fromEnv;
  return decodeFrontendApiFromPublishableKey(ENV.CLERK_PUBLISHABLE_KEY);
};

const getProxyOrigin = (req) => {
  const explicit = (process.env.CLERK_PROXY_ORIGIN || ENV.CLIENT_URL || "").trim();
  if (explicit) return explicit.replace(/\/+$/, "");

  const xfProto = String(req.headers["x-forwarded-proto"] || "https")
    .split(",")[0]
    .trim();
  const xfHost = String(req.headers["x-forwarded-host"] || req.headers.host || "")
    .split(",")[0]
    .trim();

  if (xfHost) return `${xfProto}://${xfHost}`;
  return "";
};

const getPublicProxyPath = () => {
  const path = (process.env.CLERK_PROXY_PATH || "/clerk").trim();
  if (!path) return "/clerk";
  return path.startsWith("/") ? path.replace(/\/+$/, "") || "/clerk" : `/${path}`.replace(/\/+$/, "");
};

const filterProxyHeaders = (headers) => {
  const result = new Headers();
  const blocked = new Set([
    "host",
    "content-length",
    "connection",
    "transfer-encoding",
    "accept-encoding",
  ]);

  for (const [key, value] of Object.entries(headers)) {
    const lower = key.toLowerCase();
    if (blocked.has(lower) || value == null) continue;
    result.set(key, Array.isArray(value) ? value.join(", ") : String(value));
  }

  return result;
};

const normalizeOrigin = (value) =>
  typeof value === "string" ? value.trim().replace(/\/+$/, "").toLowerCase() : "";

const allowedOrigins = [ENV.CLIENT_URL, process.env.CLIENT_URL_2, process.env.CLIENT_URL_3]
  .map(normalizeOrigin)
  .filter(Boolean);

const isAllowedOrigin = (origin) => {
  if (!origin) return true;

  const normalizedOrigin = normalizeOrigin(origin);
  const isExplicitlyAllowed = allowedOrigins.includes(normalizedOrigin);
  const isVercelPreview =
    /^https:\/\/diploma-frontend(?:-[\w-]+)?\.vercel\.app$/i.test(normalizedOrigin);
  const isKnownFrontend = normalizedOrigin === "https://diploma-frontend-nu.vercel.app";
  const isLocalhost = /^http:\/\/localhost:\d+$/i.test(normalizedOrigin);
  const isCustomDomain = /^https:\/\/([a-z0-9-]+\.)?diplomaqwe\.ru$/i.test(normalizedOrigin);

  return (
    isExplicitlyAllowed ||
    isVercelPreview ||
    isKnownFrontend ||
    isLocalhost ||
    isCustomDomain
  );
};

const corsOptions = {
  origin(origin, callback) {
    if (isAllowedOrigin(origin)) {
      return callback(null, true);
    }

    console.warn(`CORS blocked for origin: ${origin}`);
    return callback(null, false);
  },
  credentials: true,
};

app.use((req, res, next) => {
  const origin = req.headers.origin;

  if (isAllowedOrigin(origin)) {
    if (origin) {
      res.header("Access-Control-Allow-Origin", origin);
      res.header("Vary", "Origin");
    }

    res.header("Access-Control-Allow-Credentials", "true");
    res.header("Access-Control-Allow-Headers", "Authorization, Content-Type");
    res.header("Access-Control-Allow-Methods", "GET,POST,PUT,PATCH,DELETE,OPTIONS");
  }

  next();
});

app.use(["/__clerk", "/clerk"], express.raw({ type: "*/*", limit: "2mb" }), async (req, res) => {
  const frontendApiHost = getClerkFrontendApiHost(req);

  if (!frontendApiHost || !ENV.CLERK_SECRET_KEY) {
    return res.status(503).json({ error: "Clerk proxy is not configured." });
  }

  const upstreamPath = (req.originalUrl || req.url || "").replace(/^\/(?:__clerk|clerk)/, "");
  const upstreamUrl = `https://${frontendApiHost}${upstreamPath || "/"}`;
  const proxyBasePath = getPublicProxyPath();
  const proxyOrigin = getProxyOrigin(req);
  const proxyUrl = proxyOrigin ? `${proxyOrigin}${proxyBasePath}` : proxyBasePath;

  const headers = filterProxyHeaders(req.headers);
  headers.set("Clerk-Proxy-Url", proxyUrl);
  headers.set("Clerk-Secret-Key", ENV.CLERK_SECRET_KEY);

  const xff = req.headers["x-forwarded-for"];
  if (xff) {
    headers.set("X-Forwarded-For", Array.isArray(xff) ? xff[0] : String(xff));
  }

  try {
    const method = req.method.toUpperCase();
    const hasBody = method !== "GET" && method !== "HEAD";
    const body = hasBody
      ? Buffer.isBuffer(req.body)
        ? req.body
        : req.body
          ? Buffer.from(req.body)
          : undefined
      : undefined;

    const upstreamResponse = await fetch(upstreamUrl, {
      method,
      headers,
      body,
    });

    res.setHeader("X-Clerk-Proxy-Upstream", frontendApiHost);

    res.status(upstreamResponse.status);
    upstreamResponse.headers.forEach((value, key) => {
      if (key.toLowerCase() === "transfer-encoding") return;
      res.setHeader(key, value);
    });

    const buffer = Buffer.from(await upstreamResponse.arrayBuffer());
    return res.send(buffer);
  } catch (error) {
    console.error("Clerk proxy request failed:", error);
    return res.status(502).json({ error: "Clerk proxy upstream error." });
  }
});

if (ENV.CLERK_SECRET_KEY) {
  app.use(
    clerkMiddleware({
      publishableKey: ENV.CLERK_PUBLISHABLE_KEY,
      secretKey: ENV.CLERK_SECRET_KEY,
    }),
  );
} else {
  console.error("CLERK_SECRET_KEY is missing. Auth middleware is disabled.");
}

app.use(express.json());
app.use(cors(corsOptions));
app.options("/{*any}", cors(corsOptions));

app.get("/debug-sentry", () => {
  throw new Error("My first Sentry error");
});

app.get("/api/debug/clerk-proxy", (req, res) => {
  const publishableKey = ENV.CLERK_PUBLISHABLE_KEY || "";
  const fromKeyHost = decodeFrontendApiFromPublishableKey(publishableKey);
  const requestKey = getPublishableKeyFromRequest(req);
  const requestKeyHost = decodeFrontendApiFromPublishableKey(requestKey);

  res.json({
    hasSecretKey: Boolean(ENV.CLERK_SECRET_KEY),
    publishableKeyPrefix: publishableKey ? publishableKey.slice(0, 12) : null,
    publishableKeyHost: fromKeyHost,
    requestPublishableKeyPrefix: requestKey ? requestKey.slice(0, 12) : null,
    requestPublishableKeyHost: requestKeyHost,
    proxyOrigin: getProxyOrigin(req),
    proxyPath: getPublicProxyPath(),
    effectiveFrontendApiHost: getClerkFrontendApiHost(req),
  });
});

app.get("/", (req, res) => {
  res.send("Hello World!");
});

app.use("/api/inngest", serve({ client: inngest, functions }));
app.use("/api/chat", chatRoutes);

Sentry.setupExpressErrorHandler(app);

const startServer = async () => {
  try {
    await connectDB();
  } catch (error) {
    console.error("Startup DB connection failed:", error);
    if (ENV.NODE_ENV !== "production") {
      process.exit(1);
    }
  }

  if (ENV.NODE_ENV !== "production") {
    app.listen(ENV.PORT, () => {
      console.log("Server is running on port:", ENV.PORT);
    });
  }
};

startServer();

export default app;
