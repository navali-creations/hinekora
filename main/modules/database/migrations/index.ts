import { migration_20260608_000000_initial_schema } from "./20260608_000000_initial_schema";
import { migration_20260618_000000_replay_clip_kind } from "./20260618_000000_replay_clip_kind";
import { migration_20260619_000000_editor_projects } from "./20260619_000000_editor_projects";
import { migration_20260620_000000_media_library_performance } from "./20260620_000000_media_library_performance";
import { migration_20260625_000000_media_library_sort_indexes } from "./20260625_000000_media_library_sort_indexes";
import { migration_20260628_000000_editor_project_saved_edit_metadata } from "./20260628_000000_editor_project_saved_edit_metadata";
import { migration_20260630_000000_settings_cleanup } from "./20260630_000000_settings_cleanup";
import { migration_20260630_010000_recording_storage_path_migrations } from "./20260630_010000_recording_storage_path_migrations";
import { migration_20260701_000000_capture_profiles } from "./20260701_000000_capture_profiles";
import type { Migration } from "./Migration.interface";

const migrations: Migration[] = [
  migration_20260608_000000_initial_schema,
  migration_20260618_000000_replay_clip_kind,
  migration_20260619_000000_editor_projects,
  migration_20260620_000000_media_library_performance,
  migration_20260625_000000_media_library_sort_indexes,
  migration_20260628_000000_editor_project_saved_edit_metadata,
  migration_20260630_000000_settings_cleanup,
  migration_20260630_010000_recording_storage_path_migrations,
  migration_20260701_000000_capture_profiles,
];

export type { Migration } from "./Migration.interface";
export { MigrationRunner } from "./MigrationRunner";
export { migrations };
