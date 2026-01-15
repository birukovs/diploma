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

app.use(express.json());
app.use(cors({origin: "http://localhost:5173", credentials: true}));
app.use(clerkMiddleware());

app.get("/debug-sentry", (req, res) => {
  throw new Error("Моя первая ошибка Sentry!");
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
    if (ENV.NODE_ENV !== "production") {
      app.listen(ENV.PORT, () => {
        console.log("Сервер запущен на порту:", ENV.PORT);
      });
    }
  } catch (error) {
    console.error("Ошибка при запуске сервера:", error);
    process.exit(1);
  }
};

startServer();

export default app;
