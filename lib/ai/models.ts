export const DEFAULT_CHAT_MODEL: string = "gpt-4o-mini";

export type ChatModel = {
  id: string;
  name: string;
  description: string;
};

export const chatModels: ChatModel[] = [
  {
    id: "gpt-4.1-nano-2025-04-14",
    name: "gpt-4.1-nano-2025-04-14",
    description: "Cost-efficient nano model tuned for general assistance.",
  },
  {
    id: "gpt-4o",
    name: "gpt-4o",
    description: "Flagship multimodal model with strong reasoning capabilities.",
  },
  {
    id: "gpt-4o-mini",
    name: "gpt-4o-mini",
    description: "Responsive mini model optimized for quick chat responses.",
  },
  {
    id: "gpt-5-nano-2025-08-07",
    name: "gpt-5-nano-2025-08-07",
    description: "Experimental nano release with updated August 2025 weights.",
  },
];

/**
 * Maps UI model identifiers to the underlying FastAPI agent model identifiers.
 * Update this map as additional backend models become available.
 */
export const FASTAPI_MODEL_MAPPING: Record<string, string> = {
  "gpt-4.1-nano-2025-04-14": "gpt-4.1-nano-2025-04-14",
  "gpt-4o": "gpt-4o",
  "gpt-4o-mini": "gpt-4o-mini",
  "gpt-5-nano-2025-08-07": "gpt-5-nano-2025-08-07",
};

export const DEFAULT_FASTAPI_MODEL =
  FASTAPI_MODEL_MAPPING[DEFAULT_CHAT_MODEL] ?? "gpt-4o-mini";
