import type { GameId } from "~/types";

type TimestampColumn = string;
type NullableTextColumn = string | null;
type RecordingStoragePathMigrationStatus = "completed" | "pending";
type BookmarkSource = "client-log" | "manual" | "system";
type BookmarkLinkTargetKind = "activity-session" | "recording";
type ActivitySessionMode = "rewind";
type ActivitySessionClipTargetKind = "replay-clip";
type BookmarkCategory =
  | "boss"
  | "death"
  | "hideout"
  | "manual"
  | "map"
  | "pinnacle"
  | "rewind-manual-replay"
  | "town";
type BookmarkSubcategory = "abyss-depths" | "trial" | null;

interface MigrationTable {
  id: string;
  description: string;
  applied_at: TimestampColumn;
}

interface ProfileTable {
  id: string;
  name: string;
  game: GameId | null;
  data_json: string;
  created_at: TimestampColumn;
  updated_at: TimestampColumn;
}

interface CaptureProfileTable {
  id: string;
  name: string;
  game: GameId;
  data_json: string;
  created_at: TimestampColumn;
  updated_at: TimestampColumn;
}

interface SettingTable {
  key: string;
  value_json: string;
  updated_at: TimestampColumn;
}

interface RecordingStoragePathMigrationTable {
  from_path: string;
  to_path: string;
  status: RecordingStoragePathMigrationStatus;
  created_at: TimestampColumn;
  updated_at: TimestampColumn;
}

interface ReplayClipTable {
  id: string;
  kind: string;
  status: string;
  source_game: GameId;
  source_league: string;
  death_timestamp: TimestampColumn;
  trigger_line_hash: string;
  original_obs_path: NullableTextColumn;
  processed_clip_path: NullableTextColumn;
  target_duration_seconds: number;
  duration_seconds: number | null;
  size_bytes: number;
  error: NullableTextColumn;
  created_at: TimestampColumn;
  updated_at: TimestampColumn;
}

interface RunRecordingTable {
  id: string;
  path: string;
  source_game: GameId;
  source_league: string;
  file_name: string;
  duration_seconds: number | null;
  size_bytes: number;
  exists_on_disk: number;
  mtime_ms: number;
  started_at: TimestampColumn;
  stopped_at: TimestampColumn;
  created_at: TimestampColumn;
  updated_at: TimestampColumn;
}

interface BookmarkTable {
  id: string;
  source_game: GameId;
  source_league: string;
  source: BookmarkSource;
  category: BookmarkCategory;
  subcategory: BookmarkSubcategory;
  label: string;
  scene_name: NullableTextColumn;
  note: NullableTextColumn;
  occurred_at: TimestampColumn;
  dedupe_key: NullableTextColumn;
  created_at: TimestampColumn;
  updated_at: TimestampColumn;
}

interface BookmarkLinkTable {
  id: string;
  bookmark_id: string;
  target_kind: BookmarkLinkTargetKind;
  target_id: string;
  offset_seconds: number | null;
  duration_seconds: number | null;
  archived: number;
  archived_target_title: NullableTextColumn;
  archived_target_duration_seconds: number | null;
  created_at: TimestampColumn;
  updated_at: TimestampColumn;
}

interface ActivitySessionTable {
  id: string;
  mode: ActivitySessionMode;
  source_game: GameId;
  source_league: string;
  started_at: TimestampColumn;
  stopped_at: TimestampColumn | null;
  created_at: TimestampColumn;
  updated_at: TimestampColumn;
}

interface ActivitySessionClipTable {
  id: string;
  activity_session_id: string;
  target_kind: ActivitySessionClipTargetKind;
  target_id: string;
  bookmark_id: string | null;
  offset_seconds: number | null;
  created_at: TimestampColumn;
  updated_at: TimestampColumn;
}

interface EditorProjectTable {
  id: string;
  title: string;
  duration_seconds: number;
  clip_count: number;
  history_edit_count: number;
  project_json: string;
  source_game: GameId | null;
  source_league: string | null;
  source_size_bytes: number;
  created_at: TimestampColumn;
  updated_at: TimestampColumn;
}

interface EditorProjectSourceLeagueTable {
  project_id: string;
  source_game: GameId;
  source_league: string;
}

export interface DatabaseSchema {
  activity_session_clips: ActivitySessionClipTable;
  activity_sessions: ActivitySessionTable;
  bookmark_links: BookmarkLinkTable;
  bookmarks: BookmarkTable;
  capture_profiles: CaptureProfileTable;
  editor_project_source_leagues: EditorProjectSourceLeagueTable;
  editor_projects: EditorProjectTable;
  migrations: MigrationTable;
  profiles: ProfileTable;
  recording_storage_path_migrations: RecordingStoragePathMigrationTable;
  settings: SettingTable;
  replay_clips: ReplayClipTable;
  run_recordings: RunRecordingTable;
}
