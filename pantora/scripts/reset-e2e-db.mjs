// Removes the end-to-end test database so every run starts from a fresh seed.
import fs from "node:fs";
for (const suffix of ["", "-wal", "-shm"]) fs.rmSync(`.data/e2e.db${suffix}`, { force: true });
