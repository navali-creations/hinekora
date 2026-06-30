import type { Migration } from "./Migration.interface";

function hasColumn(
  db: Parameters<Migration["up"]>[0],
  table: string,
  columnName: string,
): boolean {
  const columns = db.prepare(`PRAGMA table_info(${table})`).all() as Array<{
    name: string;
  }>;

  return columns.some((column) => column.name === columnName);
}

const migration_20260628_000000_editor_project_saved_edit_metadata: Migration =
  {
    id: "20260628_000000_editor_project_saved_edit_metadata",
    description: "Add saved edit summary metadata",
    up(db) {
      if (!hasColumn(db, "editor_projects", "source_game")) {
        db.exec("ALTER TABLE editor_projects ADD COLUMN source_game TEXT");
      }
      if (!hasColumn(db, "editor_projects", "source_league")) {
        db.exec("ALTER TABLE editor_projects ADD COLUMN source_league TEXT");
      }
      if (!hasColumn(db, "editor_projects", "source_size_bytes")) {
        db.exec(
          "ALTER TABLE editor_projects ADD COLUMN source_size_bytes INTEGER NOT NULL DEFAULT 0",
        );
      }
      if (!hasColumn(db, "editor_projects", "history_edit_count")) {
        db.exec(
          "ALTER TABLE editor_projects ADD COLUMN history_edit_count INTEGER NOT NULL DEFAULT 0",
        );
      }

      db.exec(`
        CREATE TABLE IF NOT EXISTS editor_project_source_leagues (
          project_id TEXT NOT NULL REFERENCES editor_projects(id) ON DELETE CASCADE,
          source_game TEXT NOT NULL,
          source_league TEXT NOT NULL,
          PRIMARY KEY (project_id, source_game, source_league)
        ) WITHOUT ROWID;

        DROP TABLE IF EXISTS temp.editor_project_saved_edit_timeline_assets;

        CREATE TEMP TABLE editor_project_saved_edit_timeline_assets (
          project_id TEXT NOT NULL,
          asset_key TEXT NOT NULL,
          PRIMARY KEY (project_id, asset_key)
        ) WITHOUT ROWID;

        INSERT OR IGNORE INTO editor_project_saved_edit_timeline_assets (
          project_id,
          asset_key
        )
        SELECT
          editor_projects.id,
          timeline_asset.value
        FROM editor_projects,
          json_tree(editor_projects.project_json, '$.tracks') AS timeline_asset
        WHERE timeline_asset.key = 'assetKey' AND timeline_asset.type = 'text';

        UPDATE editor_projects
        SET
          source_game = CASE
            WHEN
              (
                SELECT COUNT(DISTINCT json_extract(asset.value, '$.sourceGame'))
                FROM json_each(editor_projects.project_json, '$.assets') AS asset
                WHERE
                  json_type(asset.value, '$.sourceGame') = 'text'
                  AND json_extract(asset.value, '$.assetKey') IN (
                    SELECT timeline_asset.asset_key
                    FROM editor_project_saved_edit_timeline_assets AS timeline_asset
                    WHERE timeline_asset.project_id = editor_projects.id
                  )
              ) = 1
            THEN (
              SELECT MAX(json_extract(asset.value, '$.sourceGame'))
              FROM json_each(editor_projects.project_json, '$.assets') AS asset
              WHERE
                json_type(asset.value, '$.sourceGame') = 'text'
                AND json_extract(asset.value, '$.assetKey') IN (
                  SELECT timeline_asset.asset_key
                  FROM editor_project_saved_edit_timeline_assets AS timeline_asset
                  WHERE timeline_asset.project_id = editor_projects.id
                )
            )
            ELSE NULL
          END,
          source_league = CASE
            WHEN
              (
                SELECT COUNT(DISTINCT json_extract(asset.value, '$.sourceLeague'))
                FROM json_each(editor_projects.project_json, '$.assets') AS asset
                WHERE
                  json_type(asset.value, '$.sourceLeague') = 'text'
                  AND json_extract(asset.value, '$.assetKey') IN (
                    SELECT timeline_asset.asset_key
                    FROM editor_project_saved_edit_timeline_assets AS timeline_asset
                    WHERE timeline_asset.project_id = editor_projects.id
                  )
              ) = 1
            THEN (
              SELECT MAX(json_extract(asset.value, '$.sourceLeague'))
              FROM json_each(editor_projects.project_json, '$.assets') AS asset
              WHERE
                json_type(asset.value, '$.sourceLeague') = 'text'
                AND json_extract(asset.value, '$.assetKey') IN (
                  SELECT timeline_asset.asset_key
                  FROM editor_project_saved_edit_timeline_assets AS timeline_asset
                  WHERE timeline_asset.project_id = editor_projects.id
                )
            )
            ELSE NULL
          END,
          source_size_bytes = COALESCE((
            SELECT SUM(asset_sizes.size_bytes)
            FROM (
              SELECT
                json_extract(asset.value, '$.assetKey') AS asset_key,
                MAX(CAST(COALESCE(json_extract(asset.value, '$.sizeBytes'), 0) AS INTEGER)) AS size_bytes
              FROM json_each(editor_projects.project_json, '$.assets') AS asset
              WHERE json_extract(asset.value, '$.assetKey') IN (
                SELECT timeline_asset.asset_key
                FROM editor_project_saved_edit_timeline_assets AS timeline_asset
                WHERE timeline_asset.project_id = editor_projects.id
              )
              GROUP BY asset_key
            ) AS asset_sizes
          ), 0),
          history_edit_count = MIN(
            50,
            MAX(
              CAST(COALESCE(json_extract(project_json, '$.history.editCount'), 0) AS INTEGER),
              CAST(COALESCE(json_array_length(project_json, '$.history.labels'), 0) AS INTEGER)
            )
          );

        DELETE FROM editor_project_source_leagues;

        INSERT OR IGNORE INTO editor_project_source_leagues (
          project_id,
          source_game,
          source_league
        )
        SELECT
          editor_projects.id,
          json_extract(asset.value, '$.sourceGame'),
          json_extract(asset.value, '$.sourceLeague')
        FROM editor_projects,
          json_each(editor_projects.project_json, '$.assets') AS asset
        WHERE
          json_type(asset.value, '$.sourceGame') = 'text'
          AND json_type(asset.value, '$.sourceLeague') = 'text'
          AND json_extract(asset.value, '$.assetKey') IN (
            SELECT timeline_asset.asset_key
            FROM editor_project_saved_edit_timeline_assets AS timeline_asset
            WHERE timeline_asset.project_id = editor_projects.id
          );

        DROP TABLE IF EXISTS temp.editor_project_saved_edit_timeline_assets;
      `);

      db.exec(`
        CREATE INDEX IF NOT EXISTS idx_editor_project_source_leagues_scope
          ON editor_project_source_leagues(source_game, source_league, project_id);

        CREATE INDEX IF NOT EXISTS idx_editor_project_source_leagues_league
          ON editor_project_source_leagues(source_league, project_id);

        CREATE INDEX IF NOT EXISTS idx_editor_projects_saved_edits_all_updated
          ON editor_projects(updated_at DESC, id ASC);

        CREATE INDEX IF NOT EXISTS idx_editor_projects_saved_edits_all_created
          ON editor_projects(created_at DESC, id ASC);

        CREATE INDEX IF NOT EXISTS idx_editor_projects_saved_edits_all_duration
          ON editor_projects(duration_seconds DESC, id ASC);

        CREATE INDEX IF NOT EXISTS idx_editor_projects_saved_edits_all_history
          ON editor_projects(history_edit_count DESC, id ASC);

        CREATE INDEX IF NOT EXISTS idx_editor_projects_saved_edits_all_size
          ON editor_projects(source_size_bytes DESC, id ASC);

        CREATE INDEX IF NOT EXISTS idx_editor_projects_saved_edits_all_title
          ON editor_projects(title ASC, id ASC);
      `);
    },
    down(db) {
      db.exec(`
        DROP INDEX IF EXISTS idx_editor_projects_saved_edits_all_title;
        DROP INDEX IF EXISTS idx_editor_projects_saved_edits_all_size;
        DROP INDEX IF EXISTS idx_editor_projects_saved_edits_all_history;
        DROP INDEX IF EXISTS idx_editor_projects_saved_edits_all_duration;
        DROP INDEX IF EXISTS idx_editor_projects_saved_edits_all_created;
        DROP INDEX IF EXISTS idx_editor_projects_saved_edits_all_updated;

        DROP INDEX IF EXISTS idx_editor_project_source_leagues_league;
        DROP INDEX IF EXISTS idx_editor_project_source_leagues_scope;
        DROP TABLE IF EXISTS editor_project_source_leagues;
      `);
      if (hasColumn(db, "editor_projects", "history_edit_count")) {
        db.exec("ALTER TABLE editor_projects DROP COLUMN history_edit_count");
      }
      if (hasColumn(db, "editor_projects", "source_game")) {
        db.exec("ALTER TABLE editor_projects DROP COLUMN source_game");
      }
      if (hasColumn(db, "editor_projects", "source_league")) {
        db.exec("ALTER TABLE editor_projects DROP COLUMN source_league");
      }
      if (hasColumn(db, "editor_projects", "source_size_bytes")) {
        db.exec("ALTER TABLE editor_projects DROP COLUMN source_size_bytes");
      }
    },
  };

export { migration_20260628_000000_editor_project_saved_edit_metadata };
