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

export const AISettingsUpdateSchema = BaseSchema.extend({
  body: z.object({
    enabled: z.boolean().optional(),
    baseUrl: z
      .string()
      .url()
      .refine((val) => /^https?:\/\//.test(val), {
        message: "must be a http or https url",
      })
      .nullish(),
    model: z.string().max(255).nullish(),
    /** A new API key, null removes it and undefined keeps the current key. */
    apiKey: z.string().max(1000).nullish(),
  }),
});

export type AISettingsUpdateReq = z.infer<typeof AISettingsUpdateSchema>;

export const AISettingsTestSchema = BaseSchema.extend({
  body: z.object({
    baseUrl: z.string().url().optional(),
    model: z.string().max(255).optional(),
    apiKey: z.string().max(1000).optional(),
  }),
});

export type AISettingsTestReq = z.infer<typeof AISettingsTestSchema>;

export const AISettingsModelsSchema = BaseSchema.extend({
  body: z.object({
    baseUrl: z.string().url().optional(),
    apiKey: z.string().max(1000).optional(),
  }),
});

export type AISettingsModelsReq = z.infer<typeof AISettingsModelsSchema>;
