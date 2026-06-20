import type {
  EditorProject,
  EditorProjectSummary,
  EditorTimelineClip,
} from "./Editor.dto";

interface EditorProjectRow {
  clip_count: number;
  created_at: string;
  duration_seconds: number;
  id: string;
  project_json: string;
  title: string;
  updated_at: string;
}

function mapEditorProjectRow(row: EditorProjectRow): EditorProject {
  const data = JSON.parse(row.project_json) as unknown;
  if (!isEditorProject(data)) {
    throw new Error("Editor project data is invalid");
  }

  return {
    ...data,
    createdAt: row.created_at,
    durationSeconds: row.duration_seconds,
    id: row.id,
    title: row.title,
    updatedAt: row.updated_at,
  };
}

function mapEditorProjectSummaryRow(
  row: Omit<EditorProjectRow, "project_json">,
): EditorProjectSummary {
  return {
    clipCount: row.clip_count,
    createdAt: row.created_at,
    durationSeconds: row.duration_seconds,
    id: row.id,
    title: row.title,
    updatedAt: row.updated_at,
  };
}

function createEditorProjectSummary(
  project: EditorProject,
): EditorProjectSummary {
  return {
    clipCount: countEditorProjectClips(project),
    createdAt: project.createdAt,
    durationSeconds: project.durationSeconds,
    id: project.id,
    title: project.title,
    updatedAt: project.updatedAt,
  };
}

function countEditorProjectClips(project: EditorProject): number {
  return project.tracks.reduce(
    (clipCount, track) => clipCount + track.clips.length,
    0,
  );
}

function isEditorProject(value: unknown): value is EditorProject {
  if (typeof value !== "object" || value === null) {
    return false;
  }

  const project = value as Partial<EditorProject>;
  return (
    typeof project.id === "string" &&
    typeof project.title === "string" &&
    typeof project.createdAt === "string" &&
    typeof project.updatedAt === "string" &&
    typeof project.durationSeconds === "number" &&
    Array.isArray(project.assets) &&
    Array.isArray(project.tracks) &&
    (typeof project.activeClipId === "string" ||
      project.activeClipId === null) &&
    (typeof project.selectedAssetKey === "string" ||
      project.selectedAssetKey === null) &&
    project.tracks.every((track) => Array.isArray(track.clips)) &&
    project.tracks.every((track) =>
      track.clips.every(
        (clip: EditorTimelineClip) => typeof clip.id === "string",
      ),
    )
  );
}

export type { EditorProjectRow };
export {
  countEditorProjectClips,
  createEditorProjectSummary,
  mapEditorProjectRow,
  mapEditorProjectSummaryRow,
};
