import Router from "koa-router";
import { AuthorizationError } from "@server/errors";
import auth from "@server/middlewares/authentication";
import { rateLimiter } from "@server/middlewares/rateLimiter";
import validate from "@server/middlewares/validate";
import { APIContext } from "@server/types";
import { RateLimiterStrategy } from "@server/utils/RateLimiter";
import {
  hashSharePassword,
  verifySharePassword,
} from "@server/utils/sharePassword";
import * as T from "../schema";

const router = new Router();

router.post("password.info", auth(), async (ctx: APIContext) => {
  const { user } = ctx.state.auth;

  ctx.body = {
    data: { hasPassword: !!user.passwordHash, email: user.email },
  };
});

router.post(
  "password.update",
  rateLimiter(RateLimiterStrategy.TenPerMinute),
  auth(),
  validate(T.PasswordUpdateSchema),
  async (ctx: APIContext<T.PasswordUpdateReq>) => {
    const { user } = ctx.state.auth;
    const { currentPassword, password } = ctx.input.body;

    if (
      user.passwordHash &&
      !verifySharePassword(currentPassword ?? "", user.passwordHash)
    ) {
      throw AuthorizationError("Current password is incorrect");
    }

    user.passwordHash = hashSharePassword(password);
    await user.save();

    ctx.body = { success: true };
  }
);

export default router;
