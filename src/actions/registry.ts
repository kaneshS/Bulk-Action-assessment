import type { IBulkActionHandler } from "./types.js";

type HandlerKey = string;

function key(entityType: string, actionType: string): HandlerKey {
  return `${entityType}:${actionType}`;
}

const handlers = new Map<HandlerKey, IBulkActionHandler>();

export function registerHandler(handler: IBulkActionHandler): void {
  const k = key(handler.entityType, handler.actionType);
  handlers.set(k, handler);
}

export function getHandler(entityType: string, actionType: string): IBulkActionHandler | undefined {
  return handlers.get(key(entityType, actionType));
}

export function hasHandler(entityType: string, actionType: string): boolean {
  return handlers.has(key(entityType, actionType));
}
