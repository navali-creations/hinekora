import { EditorChannel } from "./Editor.channels";
import type { EditorProject, EditorProjectSummary } from "./Editor.dto";
import { validateEditorProject } from "./Editor.validation";

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
  const project = parseEditorProjectJson(row.project_json);

  return {
    ...project,
    createdAt: row.created_at,
    durationSeconds: row.duration_seconds,
    id: row.id,
    title: row.title,
    updatedAt: row.updated_at,
  };
}

function parseEditorProjectJson(projectJson: string): EditorProject {
  try {
    const value = JSON.parse(projectJson) as unknown;
    const project = validateEditorProject(value, EditorChannel.SaveProject);
    if (
      typeof value === "object" &&
      value !== null &&
      (value as Partial<EditorProject>).sourceGame === null &&
      (value as Partial<EditorProject>).sourceLeague === null
    ) {
      return {
        ...project,
        sourceGame: null,
        sourceLeague: null,
      };
    }

    return project;
  } catch {
    throw new Error("Editor project data is invalid");
  }
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

export type { EditorProjectRow };
export {
  countEditorProjectClips,
  createEditorProjectSummary,
  mapEditorProjectRow,
  mapEditorProjectSummaryRow,
};
