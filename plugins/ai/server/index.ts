import { PluginManager, Hook } from "@server/utils/PluginManager";
import config from "../plugin.json";
import router from "./api/ai";
import env from "./env";

if (env.AI_WRITING_ENABLED) {
  PluginManager.add({
    ...config,
    type: Hook.API,
    value: router,
  });
}
