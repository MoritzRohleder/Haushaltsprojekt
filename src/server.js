'use strict';

const { loadConfig } = require('./config');
const { createStorage } = require('./storage');
const { createRepositories } = require('./repositories');
const { JsonSessionStore } = require('./storage/sessionStore');
const { generateDue } = require('./services/recurring');
const { createApp } = require('./app');

const SHUTDOWN_TIMEOUT_MS = 10000;

async function main() {
  const config = loadConfig();
  const storage = await createStorage(config);
  const repos = createRepositories(storage);
  const sessionStore = new JsonSessionStore({ dir: config.dataDir });

  const created = await generateDue(repos);
  if (created) console.log(`${created} fällige regelmäßige Buchung(en) erzeugt.`);

  const app = createApp({ config, repos, sessionStore });
  const server = app.listen(config.port, () => {
    console.log(`Haushalt läuft auf Port ${config.port} (Daten: ${config.dataDir}, Umgebung: ${process.env.NODE_ENV || 'development'})`);
  });

  // Sauber beenden (z. B. bei `docker stop`): keine neuen Anfragen, laufende
  // Schreibzugriffe abschließen, Sitzungen sichern.
  let stopping = false;
  const shutdown = async (signal) => {
    if (stopping) return;
    stopping = true;
    console.log(`${signal} empfangen – beende …`);
    const force = setTimeout(() => process.exit(1), SHUTDOWN_TIMEOUT_MS);
    force.unref();
    server.close();
    server.closeIdleConnections?.();
    await storage.idle?.();
    sessionStore.flush();
    process.exit(0);
  };
  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('SIGTERM', () => shutdown('SIGTERM'));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
