import * as migration_20261020_160544_baseline from './20261020_160544_baseline';

export const migrations = [
  {
    up: migration_20261020_160544_baseline.up,
    down: migration_20261020_160544_baseline.down,
    name: '20261020_160544_baseline'
  },
];
