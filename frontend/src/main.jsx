import React, { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import "./styles/stream-chat-theme.css";
import "./styles/polls.css";
import "./styles/clerk-theme.css";
import "./styles/clerk-overrides.css";
import App from "./App.jsx";
import { ClerkProvider } from "@clerk/clerk-react";
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
