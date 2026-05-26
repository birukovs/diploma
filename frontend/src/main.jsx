import React, { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import "./styles/stream-chat-theme.css";
import "./styles/polls.css";
import "./styles/clerk-theme.css";
import "./styles/clerk-overrides.css";
import App from "./App.jsx";
import { ClerkProvider, ClerkFailed, ClerkLoading } from "@clerk/clerk-react";
import { dark } from "@clerk/themes";
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

if (typeof window !== "undefined" && typeof window.__APP_BOOTED__ === "function") {
  window.__APP_BOOTED__();
}

const PUBLISHABLE_KEY = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY;
const CLERK_JS_URL = import.meta.env.VITE_CLERK_JS_URL;
const CLERK_PROXY_URL = import.meta.env.VITE_CLERK_PROXY_URL;
const DEFAULT_CLERK_JS_CDN_URL =
  "https://cdn.jsdelivr.net/npm/@clerk/clerk-js@5/dist/clerk.browser.js";
const CLERK_SCRIPT_LOAD_TIMEOUT_MS = Number(
  import.meta.env.VITE_CLERK_SCRIPT_LOAD_TIMEOUT_MS ?? 45000,
);
const DEFAULT_PROD_CLERK_PROXY_URL = import.meta.env.PROD ? "/__clerk" : undefined;

const decodeFrontendApiFromPublishableKey = (key) => {
  try {
    if (typeof key !== "string") return null;
    const parts = key.split("_");
    if (parts.length < 3) return null;
    const decoded = atob(parts[2]);
    if (!decoded || !decoded.endsWith("$")) return null;
    return decoded.slice(0, -1).toLowerCase();
  } catch {
    return null;
  }
};

const getEffectiveProxyUrl = (proxyUrl, publishableKey) => {
  if (!proxyUrl) return undefined;

  // Relative path proxy (e.g. /__clerk) is valid and should always be allowed.
  if (proxyUrl.startsWith("/")) return proxyUrl;

  const frontendApi = decodeFrontendApiFromPublishableKey(publishableKey);
  if (!frontendApi) return proxyUrl;

  try {
    const proxyHost = new URL(proxyUrl).host.toLowerCase();
    if (proxyHost === frontendApi) return proxyUrl;

    console.warn(
      `Clerk: proxyUrl host (${proxyHost}) does not match publishable key frontend API (${frontendApi}). Ignoring proxyUrl to prevent 401 errors.`,
    );
    return undefined;
  } catch {
    return undefined;
  }
};

const EFFECTIVE_CLERK_PROXY_URL = getEffectiveProxyUrl(
  CLERK_PROXY_URL ?? DEFAULT_PROD_CLERK_PROXY_URL,
  PUBLISHABLE_KEY,
);

if (!PUBLISHABLE_KEY) {
  throw new Error("Missing Publishable Key");
}

if (
  import.meta.env.PROD &&
  typeof window !== "undefined" &&
  PUBLISHABLE_KEY.startsWith("pk_test_")
) {
  console.warn(
    "Clerk: В production используется development publishable key (pk_test_). Рекомендуется переключиться на pk_live_.",
  );
}

Sentry.init({
  dsn: import.meta.env.VITE_SENTRY_DSN,
  integrations: [
    Sentry.reactRouterV7BrowserTracingIntegration({
      useEffect: React.useEffect,
      useLocation,
      useNavigationType,
      createRoutesFromChildren,
      matchRoutes,
    }),
  ],
  tracesSampleRate: 0.2,
  maxBreadcrumbs: 50,
  beforeSend(event) {
    if (event?.request) {
      delete event.request.data;
      delete event.request.headers;
      delete event.request.cookies;
      delete event.request.env;
      delete event.request.body;
    }

    if (event?.extra) {
      event.extra = {};
    }

    if (Array.isArray(event?.breadcrumbs)) {
      event.breadcrumbs = event.breadcrumbs.slice(-50).map((crumb) => ({
        ...crumb,
        data: undefined,
      }));
    }

    if (event?.contexts) {
      const { trace: _trace, ...rest } = event.contexts;
      event.contexts = rest;
    }

    return event;
  },
  beforeSendTransaction(event) {
    if (Array.isArray(event?.spans) && event.spans.length > 200) {
      event.spans = event.spans.slice(0, 200);
    }
    return event;
  },
});

createRoot(document.getElementById("root")).render(
  <StrictMode>
    <ClerkProvider
      publishableKey={PUBLISHABLE_KEY}
      scriptLoadTimeout={
        Number.isFinite(CLERK_SCRIPT_LOAD_TIMEOUT_MS) && CLERK_SCRIPT_LOAD_TIMEOUT_MS > 0
          ? CLERK_SCRIPT_LOAD_TIMEOUT_MS
          : 45000
      }
      clerkJSUrl={CLERK_JS_URL || DEFAULT_CLERK_JS_CDN_URL}
      proxyUrl={EFFECTIVE_CLERK_PROXY_URL}
      localization={ruRU}
      appearance={{
        baseTheme: dark,
        variables: {
          fontFamily: "Manrope, system-ui, sans-serif",
          fontSize: "14px",
          borderRadius: "12px",
          spacingUnit: "4px",
          colorPrimary: "#e03131",
          colorDanger: "#e03131",
          colorSuccess: "#2ecc71",
          colorWarning: "#f39c12",
          colorText: "#ffffff",
          colorTextOnPrimaryBackground: "#ffffff",
          colorTextSecondary: "rgba(255, 255, 255, 0.6)",
          colorBackground: "#141820",
          colorInputBackground: "#11151b",
          colorInputText: "#ffffff",
          colorNeutral: "rgba(255, 255, 255, 0.6)",
          colorShimmer: "rgba(255, 255, 255, 0.05)",
        },
        elements: {
          // Контейнеры
          rootBox: "clerk-sandbox clerk-skin",
          card: {
            backgroundColor: "#141820",
            border: "1px solid rgba(255, 255, 255, 0.08)",
            borderRadius: "16px",
            overflow: "hidden",
          },
          cardBox: {
            overflow: "hidden",
          },
          modalBackdrop: {
            backdropFilter: "blur(8px)",
          },
          modalContent: {
            overflow: "hidden",
          },
          footer: "clerk-footer",
          footerPages: "clerk-footer-pages",
          footerPagesLink: "clerk-footer-pages-link",
          footerAction: "clerk-footer-action",
          footerActionLink: "clerk-footer-action-link",

          // Кнопки формы — ВАЖНО: корректные размеры
          formButtonPrimary: {
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            minWidth: "120px",
            height: "44px",
            padding: "12px 20px",
            whiteSpace: "nowrap",
            overflow: "visible",
            flex: "0 0 auto",
          },
          formButtonReset: {
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            minWidth: "100px",
            height: "44px",
            padding: "12px 20px",
            whiteSpace: "nowrap",
            overflow: "visible",
            flex: "0 0 auto",
          },

          // Кнопки OAuth
          socialButtonsBlockButton: {
            display: "flex",
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "center",
            width: "100%",
            minHeight: "48px",
            gap: "12px",
            padding: "12px 20px",
            whiteSpace: "nowrap",
          },
          socialButtonsProviderIcon: {
            width: "20px",
            height: "20px",
            flex: "0 0 20px",
          },

          // Поповер кнопки пользователя
          userButtonPopoverCard: {
            width: "320px",
            minWidth: "320px",
          },
          userButtonPopoverActionButton: {
            display: "flex",
            flexDirection: "row",
            alignItems: "center",
            width: "100%",
            minHeight: "44px",
            gap: "12px",
            padding: "10px 14px",
            whiteSpace: "nowrap",
          },
          userButtonPopoverActionButtonIcon: {
            width: "20px",
            height: "20px",
            flex: "0 0 20px",
          },
          userButtonPopoverActionButtonText: {
            flex: "1 1 auto",
            whiteSpace: "nowrap",
            overflow: "hidden",
            textOverflow: "ellipsis",
          },

          // Иконки-кнопки — фиксированный размер, не сжимаются
          menuButton: {
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            width: "34px",
            height: "34px",
            minWidth: "34px",
            padding: "0",
            flex: "0 0 34px",
            borderRadius: "8px",
          },
          profileSectionPrimaryButton: {
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            width: "34px",
            height: "34px",
            minWidth: "34px",
            padding: "0",
            flex: "0 0 34px",
            borderRadius: "8px",
          },

          // Разделы профиля
          profileSection: {
            overflow: "visible",
          },
          profileSectionContent: {
            overflow: "visible",
          },
          profileSectionItem: {
            display: "grid",
            gridTemplateColumns: "minmax(0, 1fr) auto",
            columnGap: "16px",
            rowGap: "6px",
            padding: "12px 16px",
            minHeight: "56px",
          },

          // Бейджи
          badge: {
            display: "inline-flex",
            alignItems: "center",
            whiteSpace: "nowrap",
            flex: "0 0 auto",
            padding: "4px 10px",
          },

          // Кнопка редактирования идентификатора
          identityPreviewEditButton: {
            display: "inline-flex",
            alignItems: "center",
            minWidth: "100px",
            height: "36px",
            padding: "8px 14px",
            whiteSpace: "nowrap",
            flex: "0 0 auto",
          },

          // Альтернативные методы
          alternativeMethodsBlockButton: {
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            width: "100%",
            minHeight: "48px",
            gap: "10px",
            whiteSpace: "nowrap",
          },

          // Панель навигации
          navbar: {
            width: "260px",
            minWidth: "260px",
          },
          navbarButton: {
            display: "flex",
            alignItems: "center",
            gap: "12px",
            width: "100%",
            minHeight: "44px",
            padding: "10px 14px",
            whiteSpace: "nowrap",
          },
          navbarButtonIcon: {
            width: "20px",
            height: "20px",
            flex: "0 0 20px",
          },

          // Поля формы
          formFieldInput: {
            width: "100%",
            height: "48px",
            padding: "12px 16px",
          },
          formFieldLabel: {
            whiteSpace: "nowrap",
          },

          // Кнопка закрытия
          modalCloseButton: {
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            width: "36px",
            height: "36px",
            minWidth: "36px",
            padding: "0",
          },

          // Превью пользователя
          userPreview: {
            display: "flex",
            alignItems: "center",
            gap: "12px",
            padding: "14px",
          },
          userPreviewMainIdentifier: {
            whiteSpace: "nowrap",
            overflow: "hidden",
            textOverflow: "ellipsis",
          },
          userPreviewSecondaryIdentifier: {
            whiteSpace: "nowrap",
            overflow: "hidden",
            textOverflow: "ellipsis",
          },

          // Аккордеон
          accordionTriggerButton: {
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            width: "100%",
            minHeight: "48px",
            padding: "12px 16px",
          },

          // Меню
          menuList: {
            minWidth: "200px",
            padding: "8px",
          },
          menuItem: {
            display: "flex",
            alignItems: "center",
            gap: "10px",
            minHeight: "40px",
            padding: "10px 14px",
            whiteSpace: "nowrap",
          },
        },
      }}
    >
      <ClerkLoading>
        <div
          style={{
            minHeight: "100dvh",
            display: "grid",
            placeItems: "center",
            background: "#0f131a",
            color: "rgba(255,255,255,.78)",
            fontFamily: "Manrope, system-ui, sans-serif",
            padding: "24px",
            textAlign: "center",
          }}
        >
          Загрузка авторизации...
        </div>
      </ClerkLoading>

      <ClerkFailed>
        <div
          style={{
            minHeight: "100dvh",
            display: "grid",
            placeItems: "center",
            background: "#0f131a",
            color: "#fff",
            fontFamily: "Manrope, system-ui, sans-serif",
            padding: "24px",
            textAlign: "center",
            lineHeight: 1.5,
          }}
        >
          <div>
            <div style={{ fontSize: "18px", fontWeight: 700, marginBottom: "8px" }}>
              Не удалось загрузить модуль авторизации
            </div>
            <div style={{ opacity: 0.82, maxWidth: "560px" }}>
              Проверьте подключение к сети, отключите блокировщик рекламы/VPN для сайта и
              обновите страницу.
            </div>
          </div>
        </div>
      </ClerkFailed>

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
