import * as migration_20260322_235600 from "./20260322_235600";
import * as migration_20260403_025415 from "./20260403_025415";
import * as migration_20260405_000000 from "./20260405_000000";
import * as migration_20260407_171654 from "./20260407_171654";
import * as migration_20260407_171744 from "./20260407_171744";
import * as migration_20260407_173934 from "./20260407_173934";
import * as migration_20260611_000000 from "./20260611_000000";
export const migrations = [
  {
    up: migration_20260322_235600.up,
    down: migration_20260322_235600.down,
    name: "20260322_235600",
  },
  {
    up: migration_20260403_025415.up,
    down: migration_20260403_025415.down,
    name: "20260403_025415",
  },
  {
    up: migration_20260405_000000.up,
    down: migration_20260405_000000.down,
    name: "20260405_000000",
  },
  {
    up: migration_20260407_171654.up,
    down: migration_20260407_171654.down,
    name: "20260407_171654",
  },
  {
    up: migration_20260407_171744.up,
    down: migration_20260407_171744.down,
    name: "20260407_171744",
  },
  {
    up: migration_20260407_173934.up,
    down: migration_20260407_173934.down,
    name: "20260407_173934",
  },
  {
    up: migration_20260611_000000.up,
    down: migration_20260611_000000.down,
    name: "20260611_000000",
  },
];
