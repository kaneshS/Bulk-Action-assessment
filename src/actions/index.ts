/**
 * Import all action handlers to register them with the registry.
 * Add new handler imports here when adding new bulk actions.
 */
import "./bulk-update/handler.js";

export { getHandler, hasHandler, registerHandler } from "./registry.js";
export type { IBulkActionHandler, BulkActionContext, BulkActionResult } from "./types.js";
