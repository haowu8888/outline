import { IsOptional, IsUrl } from "class-validator";
import { Environment } from "@server/env";
import { Public } from "@server/utils/decorators/Public";
import environment from "@server/utils/environment";
import { CannotUseWithout } from "@server/utils/validators";

class AIPluginEnvironment extends Environment {
  /**
   * Base url of an OpenAI-compatible API, including the version path,
   * for example https://api.openai.com/v1 or http://new-api:3000/v1.
   */
  @IsOptional()
  @IsUrl({
    require_tld: false,
    require_protocol: true,
    allow_underscores: true,
    protocols: ["http", "https"],
  })
  public AI_BASE_URL = this.toOptionalString(environment.AI_BASE_URL);

  /** API key sent as a bearer token to the AI API. */
  @IsOptional()
  @CannotUseWithout("AI_BASE_URL")
  public AI_API_KEY = this.toOptionalString(environment.AI_API_KEY);

  /** The chat model used for writing assistance. */
  public AI_MODEL = environment.AI_MODEL || "gpt-4o-mini";

  /** Whether AI writing is available, exposed to the client. */
  @Public
  public AI_WRITING_ENABLED = !!(
    environment.AI_BASE_URL && environment.AI_API_KEY
  );
}

export default new AIPluginEnvironment();
