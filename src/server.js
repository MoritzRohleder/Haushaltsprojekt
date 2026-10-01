'use strict';

const { loadConfig } = require('./config');
const { createStorage } = require('./storage');
const { createRepositories } = require('./repositories');
const { JsonSessionStore } = require('./storage/sessionStore');
const { generateDue } = require('./services/recurring');
const { createApp } = require('./app');

async function main() {
  const config = loadConfig();
  const storage = await createStorage(config);
  const repos = createRepositories(storage);
  const sessionStore = new JsonSessionStore({ dir: config.dataDir });

  const created = await generateDue(repos);
  if (created) console.log(`${created} fällige regelmäßige Buchung(en) erzeugt.`);

  const app = createApp({ config, repos, sessionStore });
  const server = app.listen(config.port, () => {
    console.log(`Haushalt läuft auf http://localhost:${config.port} (Daten: ${config.dataDir})`);
  });

  const shutdown = () => {
    sessionStore.flush();
    server.close(() => process.exit(0));
  };
  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
