export interface Transport {
  invoke<T>(cmd: string, args?: Record<string, unknown>): Promise<T>;
}
