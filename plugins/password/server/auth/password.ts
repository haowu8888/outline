import Router from "koa-router";
import { rateLimiter } from "@server/middlewares/rateLimiter";
import validate from "@server/middlewares/validate";
import { Team, User } from "@server/models";
import { APIContext } from "@server/types";
import { RateLimiterStrategy } from "@server/utils/RateLimiter";
import { signIn } from "@server/utils/authentication";
import { verifySharePassword } from "@server/utils/sharePassword";
import * as T from "../schema";

const router = new Router();

// Submitted as a regular form post so the browser follows the sign-in redirect
// and stores the session cookie.
router.post(
  "password",
  rateLimiter(RateLimiterStrategy.TenPerMinute),
  validate(T.PasswordSigninSchema),
  async (ctx: APIContext<T.PasswordSigninReq>) => {
    const { email, password, client } = ctx.input.body;

    const team = await Team.findOne({ order: [["createdAt", "DESC"]] });
    const user = team
      ? await User.findOne({
          where: { teamId: team.id, email: email.toLowerCase() },
        })
      : null;

    if (
      !team ||
      !user?.passwordHash ||
      !verifySharePassword(password, user.passwordHash)
    ) {
      return ctx.redirect("/?notice=password-invalid");
    }

    await signIn(ctx, "password", {
      user,
      team,
      isNewTeam: false,
      isNewUser: false,
      client,
    });
  }
);

export default router;
