import { z } from "zod";

/**
 * Request/response contract for the AI assistant.
 *
 * Shared by the route handler (server-side validation) and the chat components
 * (client-side pre-validation) so the two can never drift apart.
 */
export const assistantQuerySchema = z.object({
  query: z
    .string()
    .trim()
    .min(1, "Query must not be empty")
    .max(500, "Query must be under 500 characters"),
});

export type AssistantQuery = z.infer<typeof assistantQuerySchema>;

export const MAX_QUERY_LENGTH = 500;