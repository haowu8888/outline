import { action, observable } from "mobx";
import { client } from "./ApiClient";

/**
 * Client side state for the AI writing assistant. Loaded once per session and
 * updated immediately when an admin changes the settings.
 */
class AIConfigStore {
  @observable
  enabled = false;

  private request?: Promise<void>;

  /** Load whether AI writing is available, at most once. */
  load = () => {
    if (!this.request) {
      this.request = client
        .post("/ai.config")
        .then((res) => this.setEnabled(!!res.data?.enabled))
        .catch(() => {
          this.request = undefined;
        });
    }
    return this.request;
  };

  @action
  setEnabled = (enabled: boolean) => {
    this.enabled = enabled;
  };
}

export default new AIConfigStore();
