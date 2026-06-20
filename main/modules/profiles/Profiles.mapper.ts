import { type Profile, ProfileSchema } from "~/types";

interface ProfileRow {
  id: string;
  name: string;
  game: string;
  data_json: string;
  created_at: string;
  updated_at: string;
}

function mapProfileRow(row: ProfileRow): Profile {
  const data = JSON.parse(row.data_json) as unknown;

  return ProfileSchema.parse({
    ...(typeof data === "object" && data !== null ? data : {}),
    id: row.id,
    name: row.name,
    game: row.game,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  });
}

export type { ProfileRow };
export { mapProfileRow };
