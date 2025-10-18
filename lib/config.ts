const defaultServiceBaseUrl = "http://localhost:8080";
const defaultClientProxyBasePath = "/api/fastapi";

/**
 * Base URL for the FastAPI microservice accessible from the browser.
 * Must use a NEXT_PUBLIC_* env var so it is available in the client bundle.
 */
export const FASTAPI_BASE_URL =
  process.env.NEXT_PUBLIC_FASTAPI_BASE_URL ?? defaultClientProxyBasePath;

/**
 * Base URL for the FastAPI microservice accessible from the Next.js server.
 * Falls back to the client base URL if a server-specific value was not provided.
 */
export const SERVER_FASTAPI_BASE_URL =
  process.env.FASTAPI_BASE_URL ?? defaultServiceBaseUrl;

export const FASTAPI_AGENT_ID =
  process.env.NEXT_PUBLIC_FASTAPI_AGENT_ID ??
  process.env.FASTAPI_AGENT_ID ??
  "self_corrective_rag";

export const FASTAPI_STREAM_ENDPOINT = `${FASTAPI_BASE_URL}/stream`;
export const FASTAPI_HISTORY_ENDPOINT = `${SERVER_FASTAPI_BASE_URL}/history`;
