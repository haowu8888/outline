import * as React from "react";
import { Hook, PluginManager } from "~/utils/PluginManager";
import config from "../plugin.json";
import Icon from "./Icon";

PluginManager.add([
  {
    ...config,
    type: Hook.Settings,
    value: {
      group: "Workspace",
      icon: Icon,
      component: React.lazy(() => import("./Settings")),
      enabled: (_team, user) => user.isAdmin,
    },
  },
]);
