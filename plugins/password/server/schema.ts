import { z } from "zod";
import { Client } from "@shared/types";
import { BaseSchema } from "@server/routes/api/schema";

export const MIN_PASSWORD_LENGTH = 8;

export const PasswordSigninSchema = BaseSchema.extend({
  body: z.object({
    email: z.string().email(),
    password: z.string().min(1).max(256),
    client: z.nativeEnum(Client).default(Client.Web),
  }),
});

export type PasswordSigninReq = z.infer<typeof PasswordSigninSchema>;

export const PasswordUpdateSchema = BaseSchema.extend({
  body: z.object({
    /** Required when the user already has a password. */
    currentPassword: z.string().max(256).optional(),
    password: z.string().min(MIN_PASSWORD_LENGTH).max(256),
  }),
});

export type PasswordUpdateReq = z.infer<typeof PasswordUpdateSchema>;
