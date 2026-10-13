import { buildApp } from "./app.js";
import { config } from "./config.js";
import { closeDatabasePool } from "./adapters/database/client.js";

const app = buildApp();

async function start(): Promise<void> {
  try {
    await app.listen({
      port: config.PORT,
      host: config.HOST,
    });
  } catch (err) {
    app.log.error(err);
    process.exit(1);
  }
}

// Graceful shutdown handling
const shutdown = async (signal: string): Promise<void> => {
  app.log.info(`Received ${signal}. Shutting down gracefully...`);
  try {
    await app.close();
    await closeDatabasePool();
    process.exit(0);
  } catch (err) {
    app.log.error(`Error during shutdown: ${String(err)}`);
    process.exit(1);
  }
};

process.on("SIGINT", () => void shutdown("SIGINT"));
process.on("SIGTERM", () => void shutdown("SIGTERM"));

void start();
