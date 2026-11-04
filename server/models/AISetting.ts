import { InferAttributes, InferCreationAttributes } from "sequelize";
import {
  AllowNull,
  BelongsTo,
  Column,
  DataType,
  Default,
  ForeignKey,
  Table,
} from "sequelize-typescript";
import Team from "./Team";
import IdModel from "./base/IdModel";
import { SkipChangeset } from "./decorators/Changeset";
import Encrypted from "./decorators/Encrypted";
import Fix from "./decorators/Fix";

/**
 * Workspace level configuration for the AI writing assistant, editable by
 * admins at runtime.
 */
@Table({ tableName: "ai_settings", modelName: "ai_setting" })
@Fix
class AISetting extends IdModel<
  InferAttributes<AISetting>,
  Partial<InferCreationAttributes<AISetting>>
> {
  @Default(true)
  @Column
  enabled: boolean;

  /** Base url of an OpenAI-compatible API, including the version path. */
  @AllowNull
  @Column
  baseUrl: string | null;

  /** The chat model to use. */
  @AllowNull
  @Column
  model: string | null;

  /** API key sent as a bearer token, encrypted at rest. */
  @AllowNull
  @SkipChangeset
  @Column(DataType.BLOB)
  @Encrypted
  apiKey: string | null;

  // associations

  @BelongsTo(() => Team, "teamId")
  team: Team;

  @ForeignKey(() => Team)
  @Column(DataType.UUID)
  teamId: string;
}

export default AISetting;
