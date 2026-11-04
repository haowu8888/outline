/* eslint-disable no-restricted-imports */
import { PassThrough } from "stream";
import Router from "koa-router";
import nodeFetch from "node-fetch";
import { UserRole } from "@shared/types";
import { InternalError, InvalidRequestError } from "@server/errors";
import Logger from "@server/logging/Logger";
import auth from "@server/middlewares/authentication";
import { rateLimiter } from "@server/middlewares/rateLimiter";
import validate from "@server/middlewares/validate";
import { AISetting } from "@server/models";
import { APIContext } from "@server/types";
import { RateLimiterStrategy } from "@server/utils/RateLimiter";
import { AIConfig, DEFAULT_MODEL, resolveAIConfig } from "../config";
import env from "../env";
import { buildMessages } from "../prompts";
import * as T from "./schema";

const router = new Router();

/**
 * Extract the text deltas from a chunk of an OpenAI-compatible SSE stream.
 *
 * @param buffer Unprocessed text left over from the previous chunk plus the new chunk.
 * @returns The text deltas found and the incomplete remainder.
 */
export function parseStreamChunk(buffer: string) {
  const lines = buffer.split("\n");
  const rest = lines.pop() ?? "";
  const deltas: string[] = [];

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed.startsWith("data:")) {
      continue;
    }
    const data = trimmed.slice(5).trim();
    if (!data || data === "[DONE]") {
      continue;
    }
    try {
      const delta = JSON.parse(data).choices?.[0]?.delta?.content;
      if (typeof delta === "string" && delta) {
        deltas.push(delta);
      }
    } catch (_err) {
      // ignore keep-alive or malformed lines
    }
  }

  return { deltas, rest };
}

/**
 * Send a chat completion request to the configured OpenAI-compatible API.
 */
function requestCompletion(
  config: AIConfig,
  body: Record<string, unknown>,
  signal?: AbortSignal
) {
  return nodeFetch(`${config.baseUrl.replace(/\/$/, "")}/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${config.apiKey}`,
    },
    body: JSON.stringify({ model: config.model, ...body }),
    // node-fetch accepts the standard AbortSignal at runtime
    signal: signal as never,
  });
}

router.post("ai.config", auth(), async (ctx: APIContext) => {
  const { user } = ctx.state.auth;
  const config = await resolveAIConfig(user.teamId);

  ctx.body = {
    data: { enabled: !!config },
  };
});

router.post(
  "ai.settings.info",
  auth({ role: UserRole.Admin }),
  async (ctx: APIContext) => {
    const { user } = ctx.state.auth;
    const setting = await AISetting.findOne({
      where: { teamId: user.teamId },
    });

    ctx.body = {
      data: {
        enabled: setting ? setting.enabled : !!env.AI_BASE_URL,
        baseUrl: setting ? setting.baseUrl : env.AI_BASE_URL ?? null,
        model: setting ? setting.model : env.AI_MODEL,
        hasApiKey: setting ? !!setting.apiKey : !!env.AI_API_KEY,
        defaultModel: DEFAULT_MODEL,
      },
    };
  }
);

router.post(
  "ai.settings.update",
  auth({ role: UserRole.Admin }),
  validate(T.AISettingsUpdateSchema),
  async (ctx: APIContext<T.AISettingsUpdateReq>) => {
    const { user } = ctx.state.auth;
    const { enabled, baseUrl, model, apiKey } = ctx.input.body;
    const [setting] = await AISetting.findOrCreate({
      where: { teamId: user.teamId },
      defaults: {
        teamId: user.teamId,
        baseUrl: env.AI_BASE_URL ?? null,
        model: env.AI_MODEL ?? null,
        apiKey: env.AI_API_KEY ?? null,
      },
    });

    if (enabled !== undefined) {
      setting.enabled = enabled;
    }
    if (baseUrl !== undefined) {
      setting.baseUrl = baseUrl || null;
    }
    if (model !== undefined) {
      setting.model = model?.trim() || null;
    }
    if (apiKey !== undefined) {
      setting.apiKey = apiKey?.trim() || null;
    }
    await setting.save();

    ctx.body = {
      data: {
        enabled: setting.enabled,
        baseUrl: setting.baseUrl,
        model: setting.model,
        hasApiKey: !!setting.apiKey,
        defaultModel: DEFAULT_MODEL,
      },
    };
  }
);

router.post(
  "ai.settings.test",
  rateLimiter(RateLimiterStrategy.TenPerMinute),
  auth({ role: UserRole.Admin }),
  validate(T.AISettingsTestSchema),
  async (ctx: APIContext<T.AISettingsTestReq>) => {
    const { user } = ctx.state.auth;
    const { baseUrl, model, apiKey } = ctx.input.body;
    const setting = await AISetting.findOne({
      where: { teamId: user.teamId },
    });
    const config = {
      baseUrl: baseUrl || setting?.baseUrl || env.AI_BASE_URL || "",
      apiKey: apiKey || setting?.apiKey || env.AI_API_KEY || "",
      model: model || setting?.model || env.AI_MODEL || DEFAULT_MODEL,
    };

    if (!config.baseUrl || !config.apiKey) {
      throw InvalidRequestError("Base url and API key are required");
    }

    try {
      const response = await requestCompletion(config, {
        max_tokens: 8,
        messages: [{ role: "user", content: "ping" }],
      });
      const detail = response.ok ? "" : (await response.text()).slice(0, 300);
      ctx.body = {
        data: { ok: response.ok, status: response.status, detail },
      };
    } catch (err) {
      ctx.body = {
        data: { ok: false, status: 0, detail: err.message },
      };
    }
  }
);

router.post(
  "ai.write",
  rateLimiter(RateLimiterStrategy.TwentyFivePerMinute),
  auth(),
  validate(T.AIWriteSchema),
  async (ctx: APIContext<T.AIWriteReq>) => {
    const { action, text, instruction, title } = ctx.input.body;
    const { user } = ctx.state.auth;
    const config = await resolveAIConfig(user.teamId);

    if (!config) {
      throw InvalidRequestError("AI writing is not configured");
    }

    const controller = new AbortController();
    const response = await requestCompletion(
      config,
      {
        stream: true,
        messages: buildMessages({ action, text, instruction, title }),
      },
      controller.signal
    );

    if (!response.ok || !response.body) {
      const detail = await response.text().catch(() => "");
      Logger.warn("AI request failed", {
        status: response.status,
        detail: detail.slice(0, 500),
      });
      throw InternalError(`AI request failed with status ${response.status}`);
    }

    const output = new PassThrough();
    let buffer = "";

    response.body.on("data", (chunk: Buffer) => {
      const parsed = parseStreamChunk(buffer + chunk.toString("utf8"));
      buffer = parsed.rest;
      parsed.deltas.forEach((delta) => output.write(delta));
    });
    response.body.on("end", () => {
      parseStreamChunk(buffer + "\n").deltas.forEach((delta) =>
        output.write(delta)
      );
      output.end();
    });
    response.body.on("error", (err: Error) => {
      Logger.warn("AI stream interrupted", { error: err.message });
      output.end();
    });

    // Stop the upstream request when the browser goes away.
    ctx.req.on("close", () => controller.abort());

    ctx.set("Cache-Control", "no-cache");
    ctx.set("X-Accel-Buffering", "no");
    ctx.type = "text/plain; charset=utf-8";
    ctx.body = output;
  }
);

export default router;
