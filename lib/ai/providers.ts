import { gateway } from "@ai-sdk/gateway";
import {
  customProvider,
  extractReasoningMiddleware,
  wrapLanguageModel,
} from "ai";
import { isTestEnvironment } from "../constants";

export const myProvider = isTestEnvironment
  ? (() => {
      const {
        artifactModel,
        chatModel,
        reasoningModel,
        titleModel,
      } = require("./models.mock");
      return customProvider({
        languageModels: {
          "chat-model": chatModel,
          "chat-model-reasoning": reasoningModel,
          "title-model": titleModel,
          "artifact-model": artifactModel,
          "gpt-4.1-nano-2025-04-14": chatModel,
          "gpt-4o": chatModel,
          "gpt-4o-mini": chatModel,
          "gpt-5-nano-2025-08-07": reasoningModel,
        },
      });
    })()
  : customProvider({
      languageModels: {
        "chat-model": gateway.languageModel("xai/grok-2-vision-1212"),
        "chat-model-reasoning": wrapLanguageModel({
          model: gateway.languageModel("xai/grok-3-mini"),
          middleware: extractReasoningMiddleware({ tagName: "think" }),
        }),
        "title-model": gateway.languageModel("xai/grok-2-1212"),
        "artifact-model": gateway.languageModel("xai/grok-2-1212"),
        // Temporary mappings so UI IDs resolve even though FastAPI handles execution.
        "gpt-4.1-nano-2025-04-14": gateway.languageModel(
          "xai/grok-2-vision-1212"
        ),
        "gpt-4o": gateway.languageModel("xai/grok-2-vision-1212"),
        "gpt-4o-mini": gateway.languageModel("xai/grok-2-vision-1212"),
        "gpt-5-nano-2025-08-07": wrapLanguageModel({
          model: gateway.languageModel("xai/grok-3-mini"),
          middleware: extractReasoningMiddleware({ tagName: "think" }),
        }),
      },
    });
