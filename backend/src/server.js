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
