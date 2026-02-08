import { z } from "zod";

export const bulkUpdatePayloadSchema = z.object({
  name: z.string().optional(),
  email: z.string().email().optional(),
  age: z.number().int().min(0).max(150).optional().nullable(),
  status: z.string().optional(),
});

export type BulkUpdatePayload = z.infer<typeof bulkUpdatePayloadSchema>;

export function validateBulkUpdatePayload(payload: unknown): BulkUpdatePayload {
  const result = bulkUpdatePayloadSchema.safeParse(payload);
  if (!result.success) {
    throw new Error(`Invalid bulk update payload: ${result.error.message}`);
  }
  if (Object.keys(result.data).length === 0) {
    throw new Error("At least one field must be provided for bulk update");
  }
  return result.data;
}
