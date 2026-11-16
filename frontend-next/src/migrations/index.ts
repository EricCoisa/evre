import * as migration_20261020_160544_baseline from './20261020_160544_baseline';
import * as migration_20261115_000000_home_redesign from './20261115_000000_home_redesign';
import * as migration_20261115_000001_home_site_demos from './20261115_000001_home_site_demos';
import * as migration_20261115_000002_home_sistema_demos from './20261115_000002_home_sistema_demos';

export const migrations = [
  {
    up: migration_20261020_160544_baseline.up,
    down: migration_20261020_160544_baseline.down,
    name: '20261020_160544_baseline'
  },
  {
    up: migration_20261115_000000_home_redesign.up,
    down: migration_20261115_000000_home_redesign.down,
    name: '20261115_000000_home_redesign'
  },
  {
    up: migration_20261115_000001_home_site_demos.up,
    down: migration_20261115_000001_home_site_demos.down,
    name: '20261115_000001_home_site_demos'
  },
  {
    up: migration_20261115_000002_home_sistema_demos.up,
    down: migration_20261115_000002_home_sistema_demos.down,
    name: '20261115_000002_home_sistema_demos'
  },
];
