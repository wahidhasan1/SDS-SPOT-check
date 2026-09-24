// Attachment bytes live outside the database: on disk (server) or in memory (demo).

export interface FileStore {
  put(key: string, data: Blob): Promise<void>;
  get(key: string): Promise<Blob | null>;
  delete(key: string): Promise<void>;
}
