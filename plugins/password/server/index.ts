import { Hook, PluginManager } from "@server/utils/PluginManager";
import config from "../plugin.json";
import api from "./api/password";
import router from "./auth/password";

PluginManager.add([
  {
    ...config,
    type: Hook.AuthProvider,
    value: { router, id: config.id },
  },
  {
    ...config,
    type: Hook.API,
    value: api,
  },
]);
