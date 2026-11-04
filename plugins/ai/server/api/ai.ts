/* eslint-disable no-restricted-imports */
import { PassThrough } from "stream";
import Router from "koa-router";
import nodeFetch from "node-fetch";
import { InternalError } from "@server/errors";
import Logger from "@server/logging/Logger";
import auth from "@server/middlewares/authentication";
import { rateLimiter } from "@server/middlewares/rateLimiter";
import validate from "@server/middlewares/validate";
import { APIContext } from "@server/types";
import { RateLimiterStrategy } from "@server/utils/RateLimiter";
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

router.post(
  "ai.write",
  rateLimiter(RateLimiterStrategy.TwentyFivePerMinute),
  auth(),
  validate(T.AIWriteSchema),
  async (ctx: APIContext<T.AIWriteReq>) => {
    const { action, text, instruction, title } = ctx.input.body;
    const controller = new AbortController();

    const response = await nodeFetch(
      `${env.AI_BASE_URL!.replace(/\/$/, "")}/chat/completions`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${env.AI_API_KEY}`,
        },
        body: JSON.stringify({
          model: env.AI_MODEL,
          stream: true,
          messages: buildMessages({ action, text, instruction, title }),
        }),
        // node-fetch accepts the standard AbortSignal at runtime
        signal: controller.signal as never,
      }
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
