import type { Transport } from "@app-icon-maker/utils";

export const tauriTransport: Transport = {
  async invoke<T>(cmd: string, args?: Record<string, unknown>): Promise<T> {
    const { invoke } = await import("@tauri-apps/api/core");
    return invoke<T>(cmd, args);
  },
};
