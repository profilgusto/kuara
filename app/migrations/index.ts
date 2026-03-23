import * as migration_20260322_235600 from './20260322_235600';

export const migrations = [
  {
    up: migration_20260322_235600.up,
    down: migration_20260322_235600.down,
    name: '20260322_235600'
  },
];
