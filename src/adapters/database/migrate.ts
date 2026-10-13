import { migrate } from "drizzle-orm/node-postgres/migrator";
import { db, closeDatabasePool } from "./client.js";

export async function runMigrations(): Promise<void> {
  console.log("Running database migrations...");
  await migrate(db, { migrationsFolder: "./drizzle" });
  console.log("Database migrations completed successfully.");
}

// Allow direct CLI execution: tsx src/adapters/database/migrate.ts
const isMain = process.argv[1]?.endsWith("migrate.ts");
if (isMain) {
  runMigrations()
    .then(async () => {
      await closeDatabasePool();
      process.exit(0);
    })
    .catch(async (err) => {
      console.error("Migration failed:", err);
      await closeDatabasePool();
      process.exit(1);
    });
}
