import * as migration_20260322_235600 from './20260322_235600';
import * as migration_20260403_025415 from './20260403_025415';
import * as migration_20260405_000000 from './20260405_000000';

export const migrations = [
  {
    up: migration_20260322_235600.up,
    down: migration_20260322_235600.down,
    name: '20260322_235600',
  },
  {
    up: migration_20260403_025415.up,
    down: migration_20260403_025415.down,
    name: '20260403_025415'
  },
  {
    up: migration_20260405_000000.up,
    down: migration_20260405_000000.down,
    name: '20260405_000000'
  },
];
