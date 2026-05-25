import { useAuth } from "@clerk/clerk-react";
import * as Sentry from "@sentry/react";
import { Suspense, lazy } from "react";
import { Navigate, Route, Routes } from "react-router";

const AuthPage = lazy(() => import("./pages/AuthPage"));
const CallPage = lazy(() => import("./pages/CallPage"));
const HomePage = lazy(() => import("./pages/HomePage"));

const SentryRoutes = Sentry.withSentryReactRouterV7Routing(Routes);

const App = () => {
  const { isSignedIn, isLoaded } = useAuth();

  if (!isLoaded) return null;
  return (
    <Suspense fallback={null}>
      <SentryRoutes>
        <Route
          path="/"
          element={isSignedIn ? <HomePage /> : <Navigate to={"/auth"} replace />}
        />
        <Route
          path="/auth"
          element={!isSignedIn ? <AuthPage /> : <Navigate to={"/"} replace />}
        />

        <Route
          path="/call/:id"
          element={isSignedIn ? <CallPage /> : <Navigate to={"/auth"} replace />}
        />

        <Route
          path="*"
          element={
            isSignedIn ? (
              <Navigate to={"/"} replace />
            ) : (
              <Navigate to={"/auth"} replace />
            )
          }
        />
      </SentryRoutes>
    </Suspense>
  );
};

export default App;
