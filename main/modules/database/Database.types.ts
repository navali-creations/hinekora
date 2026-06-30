import type { GameId } from "~/types";

type TimestampColumn = string;
type NullableTextColumn = string | null;

interface MigrationTable {
  id: string;
  description: string;
  applied_at: TimestampColumn;
}

interface ProfileTable {
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
  editor_project_source_leagues: EditorProjectSourceLeagueTable;
  editor_projects: EditorProjectTable;
  migrations: MigrationTable;
  profiles: ProfileTable;
  settings: SettingTable;
  replay_clips: ReplayClipTable;
  run_recordings: RunRecordingTable;
}
