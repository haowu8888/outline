import { AISetting } from "@server/models";
import env from "./env";

export type AIConfig = {
  baseUrl: string;
  apiKey: string;
  model: string;
};

/** Default model used when none is configured. */
export const DEFAULT_MODEL = "gpt-4o-mini";

/**
 * Resolve the AI configuration for a team. Settings saved in the app take
 * precedence over environment variables.
 *
 * @param teamId The team to resolve configuration for.
 * @returns The configuration, or undefined if AI writing is not available.
 */
export async function resolveAIConfig(
  teamId: string
): Promise<AIConfig | undefined> {
  const setting = await AISetting.findOne({ where: { teamId } });

  if (setting) {
    if (!setting.enabled || !setting.baseUrl || !setting.apiKey) {
      return undefined;
    }
    return {
      baseUrl: setting.baseUrl,
      apiKey: setting.apiKey,
      model: setting.model || env.AI_MODEL || DEFAULT_MODEL,
    };
  }

  if (env.AI_BASE_URL && env.AI_API_KEY) {
    return {
      baseUrl: env.AI_BASE_URL,
      apiKey: env.AI_API_KEY,
      model: env.AI_MODEL || DEFAULT_MODEL,
    };
  }

  return undefined;
}
