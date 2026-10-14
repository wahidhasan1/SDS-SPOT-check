// Database utility: `npm run db:migrate`, `npm run db:seed`, or `npm run db:reset`.
import { databasePath, openDatabase } from "@/server/db";
import { resetDemoData, seedIfEmpty } from "@/server/db/seed";
import { get } from "@/server/db/sql";

const command = process.argv[2] ?? "seed";
const db = openDatabase();
if (command === "migrate") {
  console.log(`Migrations applied to ${databasePath()}`);
} else if (command === "seed") {
  seedIfEmpty(db);
  console.log(`Demo data is present in ${databasePath()} (seeded ${get<{ value: string }>(db, "SELECT value FROM app_meta WHERE key = 'seeded_at'")?.value}).`);
} else if (command === "reset") {
  resetDemoData(db);
  console.log(`All data in ${databasePath()} was deleted and the demo seed restored.`);
} else {
  console.error(`Unknown command "${command}". Use migrate, seed, or reset.`);
  process.exit(1);
}
db.close();
