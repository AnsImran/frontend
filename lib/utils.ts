import type {
  CoreAssistantMessage,
  CoreToolMessage,
  UIMessage,
  UIMessagePart,
} from 'ai';
import { type ClassValue, clsx } from 'clsx';
import { formatISO } from 'date-fns';
import { twMerge } from 'tailwind-merge';
import type { DBMessage, Document } from '@/lib/db/schema';
import { ChatSDKError, type ErrorCode } from './errors';
import type { ChatMessage, ChatTools, CustomUIDataTypes } from './types';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export const fetcher = async (url: string) => {
  const response = await fetch(url);

  if (!response.ok) {
    const { code, cause } = await response.json();
    throw new ChatSDKError(code as ErrorCode, cause);
  }

  return response.json();
};

export async function fetchWithErrorHandlers(
  input: RequestInfo | URL,
  init?: RequestInit,
) {
  try {
    const response = await fetch(input, init);

    if (!response.ok) {
      const { code, cause } = await response.json();
      throw new ChatSDKError(code as ErrorCode, cause);
    }

    return response;
  } catch (error: unknown) {
    if (typeof navigator !== 'undefined' && !navigator.onLine) {
      throw new ChatSDKError('offline:chat');
    }

    throw error;
  }
}

export function getLocalStorage(key: string) {
  if (typeof window !== 'undefined') {
    return JSON.parse(localStorage.getItem(key) || '[]');
  }
  return [];
}

export function generateUUID(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

type ResponseMessageWithoutId = CoreToolMessage | CoreAssistantMessage;
type ResponseMessage = ResponseMessageWithoutId & { id: string };

export function getMostRecentUserMessage(messages: UIMessage[]) {
  const userMessages = messages.filter((message) => message.role === 'user');
  return userMessages.at(-1);
}

export function getDocumentTimestampByIndex(
  documents: Document[],
  index: number,
) {
  if (!documents) { return new Date(); }
  if (index > documents.length) { return new Date(); }

  return documents[index].createdAt;
}

export function getTrailingMessageId({
  messages,
}: {
  messages: ResponseMessage[];
}): string | null {
  const trailingMessage = messages.at(-1);

  if (!trailingMessage) { return null; }

  return trailingMessage.id;
}

export function sanitizeText(text: string) {
  return text.replace('<has_function_call>', '');
}

export function convertToUIMessages(messages: DBMessage[]): ChatMessage[] {
  return messages.map((message) => ({
    id: message.id,
    role: message.role as 'user' | 'assistant' | 'system',
    parts: message.parts as UIMessagePart<CustomUIDataTypes, ChatTools>[],
    metadata: {
      createdAt: formatISO(message.createdAt),
    },
  }));
}

export type MicroserviceHistoryMessage = {
  type: string;
  content: unknown;
  tool_calls?: unknown[];
  tool_call_id?: string | null;
  run_id?: string | null;
  response_metadata?: Record<string, unknown> | null;
  custom_data?: Record<string, unknown> | null;
};

export type MicroserviceHistoryResponse = {
  messages: MicroserviceHistoryMessage[];
};

function stringifyHistoryContent(content: unknown): string {
  if (typeof content === 'string') {
    return content;
  }

  if (content == null) {
    return '';
  }

  if (Array.isArray(content)) {
    return content.map((entry) => stringifyHistoryContent(entry)).join('');
  }

  if (typeof content === 'object' && 'text' in (content as Record<string, unknown>)) {
    const entry = content as { text?: unknown };
    if (typeof entry.text === 'string') {
      return entry.text;
    }
  }

  try {
    return JSON.stringify(content);
  } catch {
    return String(content);
  }
}

export function convertMicroserviceHistoryToChatMessages(
  history: MicroserviceHistoryResponse,
): ChatMessage[] {
  if (!history?.messages?.length) {
    return [];
  }

  const uiMessages: ChatMessage[] = [];
  const sourceMessages = history.messages;

  for (let index = 0; index < sourceMessages.length; index += 1) {
    const message = sourceMessages[index];
    if (!message) continue;

    const toolCalls = Array.isArray(message.tool_calls)
      ? (message.tool_calls as Array<Record<string, unknown>>).filter(
          (toolCall) => toolCall && typeof toolCall === 'object',
        )
      : [];

    const isAssistantWithTools =
      message.type === 'ai' && toolCalls.length > 0;

    if (isAssistantWithTools) {
      const toolCallMetas = toolCalls.map((toolCall) => {
        const id =
          typeof toolCall.id === 'string'
            ? toolCall.id
            : generateUUID();
        const name =
          typeof toolCall.name === 'string'
            ? toolCall.name
            : 'tool';
        const args =
          'args' in toolCall ? (toolCall as { args?: unknown }).args : undefined;
        return { id, name, args };
      });

      const knownToolCallIds = new Set(
        toolCallMetas.map((meta) => meta.id),
      );
      const toolOutputs = new Map<string, string>();

      let finalAssistantText: string | undefined;
      let consumed = 0;
      let cursor = index + 1;

      while (cursor < sourceMessages.length) {
        const nextMessage = sourceMessages[cursor];
        if (!nextMessage) break;

        if (
          nextMessage.type === 'tool' &&
          typeof nextMessage.tool_call_id === 'string' &&
          knownToolCallIds.has(nextMessage.tool_call_id)
        ) {
          toolOutputs.set(
            nextMessage.tool_call_id,
            stringifyHistoryContent(nextMessage.content),
          );
          cursor += 1;
          consumed += 1;
          continue;
        }

        if (
          nextMessage.type === 'ai' &&
          (!Array.isArray(nextMessage.tool_calls) ||
            nextMessage.tool_calls.length === 0)
        ) {
          finalAssistantText = sanitizeText(
            stringifyHistoryContent(nextMessage.content),
          );
          cursor += 1;
          consumed += 1;
        }

        break;
      }

      const initialAssistantText = sanitizeText(
        stringifyHistoryContent(message.content),
      );

      const toolParts = toolCallMetas.map((meta) => {
        const hasOutput = toolOutputs.has(meta.id);
        const output = toolOutputs.get(meta.id);
        return {
          type: 'dynamic-tool',
          toolCallId: meta.id,
          toolName: meta.name,
          state: hasOutput ? 'output-available' : 'input-available',
          input: meta.args ?? null,
          ...(hasOutput ? { output } : {}),
        } as UIMessagePart<CustomUIDataTypes, ChatTools>;
      });

      if (initialAssistantText) {
        toolParts.push({
          type: 'text',
          text: initialAssistantText,
        } as UIMessagePart<CustomUIDataTypes, ChatTools>);
      }

      if (
        finalAssistantText &&
        finalAssistantText !== initialAssistantText
      ) {
        toolParts.push({
          type: 'text',
          text: finalAssistantText,
        } as UIMessagePart<CustomUIDataTypes, ChatTools>);
      }

      if (toolParts.length > 0) {
        uiMessages.push({
          id: generateUUID(),
          role: 'assistant',
          parts: toolParts,
          metadata: {
            createdAt: formatISO(new Date()),
          },
        });
      }

      index += consumed;
      continue;
    }

    const role =
      message.type === 'human'
        ? ('user' as const)
        : message.type === 'ai'
          ? ('assistant' as const)
          : message.type === 'system'
            ? ('system' as const)
            : ('assistant' as const);

    const text = stringifyHistoryContent(message.content);

    uiMessages.push({
      id: generateUUID(),
      role,
      parts: [
        {
          type: 'text' as const,
          text,
        },
      ],
      metadata: {
        createdAt: formatISO(new Date()),
      },
    });
  }

  return uiMessages;
}

type MessageLike = {
  parts?: Array<
    {
      type: string;
      text?: string;
    }
  >;
};

export function getTextFromMessage(message: MessageLike): string {
  if (!message?.parts?.length) {
    return '';
  }

  return message.parts
    .filter(
      (part): part is { type: 'text'; text: string } =>
        part.type === 'text' && typeof part.text === 'string',
    )
    .map((part) => part.text)
    .join('');
}
