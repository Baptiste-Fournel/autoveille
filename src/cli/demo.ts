/** Charge des annonces d'exemple dans la base locale :  npm run demo */
import path from 'node:path';
import { config } from '../config.js';
import { Store } from '../db.js';
import { Pipeline } from '../pipeline.js';
import { seedDemo } from '../demo.js';

const store = new Store(path.join(config.dataDir, 'autoveille.sqlite'));
await seedDemo(store, new Pipeline(store));
console.log('Annonces de démonstration chargées.');
