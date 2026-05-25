import { createContext, useEffect } from "react";
import { useAuth } from "@clerk/clerk-react";
import { axiosInstance } from "../lib/axios";
import toast from "react-hot-toast";

const AuthContext = createContext({});

export default function AuthProvider({ children }) {
  const { getToken } = useAuth();

  useEffect(() => {
    const interceptor = axiosInstance.interceptors.request.use(
      async (config) => {
        try {
          const token = await getToken();
          if (token) {
            config.headers.Authorization = `Bearer ${token}`;
          }
        } catch (error) {
          if (
            error.message?.toLowerCase?.().includes("auth") ||
            error.message?.toLowerCase?.().includes("token")
          ) {
            toast.error("Ошибка авторизации.");
          }
          console.log("Ошибка при получении токена:", error);
        }
        return config;
      },
      (error) => {
        console.error("Ошибка в перехватчике запроса:", error);
        return Promise.reject(error);
      },
    );

    return () => {
      axiosInstance.interceptors.request.eject(interceptor);
    };
  }, [getToken]);

  return <AuthContext.Provider value={{}}>{children}</AuthContext.Provider>;
}
