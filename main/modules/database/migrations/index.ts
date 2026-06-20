import { migration_20260608_000000_initial_schema } from "./20260608_000000_initial_schema";
import { migration_20260618_000000_replay_clip_kind } from "./20260618_000000_replay_clip_kind";
import { migration_20260619_000000_editor_projects } from "./20260619_000000_editor_projects";
import { migration_20260620_000000_media_library_performance } from "./20260620_000000_media_library_performance";
import type { Migration } from "./Migration.interface";

const migrations: Migration[] = [
  migration_20260608_000000_initial_schema,
  migration_20260618_000000_replay_clip_kind,
  migration_20260619_000000_editor_projects,
  migration_20260620_000000_media_library_performance,
];

export type { Migration } from "./Migration.interface";
export { MigrationRunner } from "./MigrationRunner";
export { migrations };
