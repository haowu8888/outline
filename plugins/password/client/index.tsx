import { PadlockIcon } from "outline-icons";
import * as React from "react";
import { Hook, PluginManager } from "~/utils/PluginManager";
import config from "../plugin.json";

PluginManager.add([
  {
    ...config,
    type: Hook.Settings,
    value: {
      group: "Account",
      after: "Profile",
      icon: PadlockIcon,
      component: React.lazy(() => import("./Settings")),
      enabled: () => true,
    },
  },
]);
