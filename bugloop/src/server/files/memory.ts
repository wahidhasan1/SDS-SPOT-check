import type { FileStore } from "./types";

export class MemoryFileStore implements FileStore {
  private readonly files = new Map<string, Blob>();
  /** Called after writes so the demo can persist attachments. */
  onPut: ((key: string, data: Blob) => void) | null = null;

  async put(key: string, data: Blob): Promise<void> {
    this.files.set(key, data);
    this.onPut?.(key, data);
  }

  async get(key: string): Promise<Blob | null> {
    return this.files.get(key) ?? null;
  }

  async delete(key: string): Promise<void> {
    this.files.delete(key);
  }

  /** Load without triggering onPut (used when restoring a saved demo). */
  preload(key: string, data: Blob): void {
    this.files.set(key, data);
  }

  keys(): string[] {
    return [...this.files.keys()];
  }
}
