import { z } from "zod";
import { BaseSchema } from "@server/routes/api/schema";
import { AIWritingActions } from "../prompts";

export const AIWriteSchema = BaseSchema.extend({
  body: z
    .object({
      action: z.enum(AIWritingActions),
      text: z.string().max(20000),
      instruction: z.string().max(2000).optional(),
      title: z.string().max(500).optional(),
    })
    .refine((body) => body.action !== "custom" || !!body.instruction?.trim(), {
      message: "instruction is required for custom action",
    })
    .refine((body) => body.action === "custom" || !!body.text.trim(), {
      message: "text is required",
    }),
});

export type AIWriteReq = z.infer<typeof AIWriteSchema>;
