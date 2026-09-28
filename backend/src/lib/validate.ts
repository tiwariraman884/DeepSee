/**
 * Express middleware factory for Zod schema validation.
 * Usage: router.post("/path", validate(schema, "body"), handler)
 */
import type { Request, Response, NextFunction } from "express";
import type { ZodSchema } from "zod";

type Source = "body" | "query" | "params";

export function validate<T>(schema: ZodSchema<T>, source: Source = "body") {
  return (req: Request, res: Response, next: NextFunction) => {
    const data = req[source];
    const result = schema.safeParse(data);

    if (!result.success) {
      const errors = result.error.issues.map((issue) => ({
        field: issue.path.join("."),
        message: issue.message,
      }));
      return res.status(400).json({
        error: "Validation failed",
        details: errors,
      });
    }

    // Replace with parsed (and potentially coerced/defaulted) data
    (req as any)[source] = result.data;
    next();
  };
}
