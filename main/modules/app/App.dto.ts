export interface AppSelectPathFilter {
  name: string;
  extensions: string[];
}

export interface AppSelectPathInput {
  title?: string;
  defaultPath?: string;
  properties: Array<"openFile" | "openDirectory">;
  filters?: AppSelectPathFilter[];
}
