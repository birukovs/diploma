import React, { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import "./styles/stream-chat-theme.css";
import "./styles/polls.css";
import "./styles/clerk-theme.css";
import App from "./App.jsx";
import { ClerkProvider } from "@clerk/clerk-react";
import { ruRU } from "@clerk/localizations";
import {
  Routes,
  Route,
  BrowserRouter,
  useLocation,
  useNavigationType,
  createRoutesFromChildren,
  matchRoutes,
} from "react-router";
import { Toaster } from "react-hot-toast";

import * as Sentry from "@sentry/react";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import AuthProvider from "./providers/AuthProvider.jsx";

const queryClient = new QueryClient();

const PUBLISHABLE_KEY = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY;

if (!PUBLISHABLE_KEY) {
  throw new Error("Missing Publishable Key");
}

Sentry.init({
  dsn: "https://680f61787a4c6a797611b04c645833e0@o4510702443560960.ingest.de.sentry.io/4510709004763216",
  integrations: [
    Sentry.reactRouterV7BrowserTracingIntegration({
      useEffect: React.useEffect,
      useLocation,
      useNavigationType,
      createRoutesFromChildren,
      matchRoutes,
    }),
  ],
  tracesSampleRate: 1.0,
});

createRoot(document.getElementById("root")).render(
  <StrictMode>
    <ClerkProvider
      
      publishableKey={PUBLISHABLE_KEY}
      localization={ruRU}
      appearance={{
        variables: {
          fontFamily: "Manrope, system-ui, sans-serif",
          colorPrimary: "var(--rzd-red)",
          colorDanger: "var(--rzd-red)",
          colorText: "rgba(255, 255, 255, 0.92)",
          colorTextSecondary: "rgba(255, 255, 255, 0.72)",
          colorBackground: "var(--rzd-bg-1)",
          colorInputBackground: "var(--rzd-bg-2)",
          colorInputText: "rgba(255, 255, 255, 0.92)",
          colorNeutral: "var(--rzd-gray-300)",
        },
        elements: {
          card: "clerk-card",
          headerTitle: "clerk-header-title",
          headerSubtitle: "clerk-header-subtitle",
          formFieldLabel: "clerk-form-label",
          formFieldInput: "clerk-form-input",
          formButtonPrimary: "clerk-primary-button",
          footerActionLink: "clerk-link",
          dividerLine: "clerk-divider-line",
          dividerText: "clerk-divider-text",
          socialButtonsBlockButton: "clerk-social-button",
          socialButtonsIconButton: "clerk-social-button",
        },
      }}
    >
      <BrowserRouter>
        <QueryClientProvider client={queryClient}>
          <AuthProvider>
            <App />
          </AuthProvider>
          <Toaster position="bottom-center" />
        </QueryClientProvider>
      </BrowserRouter>
    </ClerkProvider>
  </StrictMode>
);
