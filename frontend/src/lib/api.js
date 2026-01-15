import { axiosInstance } from "./axios";

export async function getStreamToken(){
    const response = await fetch(`${import.meta.env.MODE === "development" ? "http://localhost:5001/api" : "https://diploma-backend-six.vercel.app/api"}/chat/token`, {
        method: 'GET',
        credentials: 'include',
    });
    if (!response.ok) {
        throw new Error('Failed to fetch token');
    }
    return response.json();
}
