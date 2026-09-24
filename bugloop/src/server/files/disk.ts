import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { dirname, join, resolve, sep } from "node:path";
import type { FileStore } from "./types";

/** Stores attachment bytes under a directory; the mime type is kept in a sidecar file. */
export class DiskFileStore implements FileStore {
  private readonly root: string;

  constructor(root: string) {
    this.root = resolve(root);
  }

  private path(key: string): string {
    const p = resolve(join(this.root, key));
    if (!p.startsWith(this.root + sep)) throw new Error("Invalid storage key");
    return p;
  }

  async put(key: string, data: Blob): Promise<void> {
    const p = this.path(key);
    await mkdir(dirname(p), { recursive: true });
    await writeFile(p, new Uint8Array(await data.arrayBuffer()));
    await writeFile(`${p}.type`, data.type || "application/octet-stream");
  }

  async get(key: string): Promise<Blob | null> {
    const p = this.path(key);
    try {
      const [bytes, type] = await Promise.all([readFile(p), readFile(`${p}.type`, "utf8").catch(() => "application/octet-stream")]);
      return new Blob([new Uint8Array(bytes)], { type });
    } catch {
      return null;
    }
  }

  async delete(key: string): Promise<void> {
    const p = this.path(key);
    await rm(p, { force: true });
    await rm(`${p}.type`, { force: true });
  }
}
