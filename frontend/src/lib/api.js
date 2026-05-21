const API_BASE_URL = import.meta.env.VITE_API_BASE_URL;

export async function getStreamToken(getToken) {
  const clerkToken = await (typeof getToken === "function" ? getToken() : null);

  const response = await fetch(`${API_BASE_URL}/chat/token`, {
    method: "GET",
    credentials: "include",
    headers: clerkToken ? { Authorization: `Bearer ${clerkToken}` } : {},
  });

  if (!response.ok) {
    const body = await response.text().catch(() => "");
    throw new Error(`Failed to fetch token: ${response.status} ${body}`.trim());
  }

  return response.json();
}
