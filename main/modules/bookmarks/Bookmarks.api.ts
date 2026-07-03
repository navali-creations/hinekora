import { ipcRenderer } from "electron";

import { unwrapIpcResult } from "~/main/utils/ipc-api";

import { BookmarksChannel } from "./Bookmarks.channels";
import type {
  ActivitySessionLibraryPage,
  ActivitySessionLibraryQuery,
  ActivitySessionTimeline,
  BookmarkLibraryPage,
  BookmarkLibraryQuery,
  BookmarkManualCreateResult,
  BookmarkManualUpdateInput,
  RecordingBookmarksPage,
  RecordingBookmarksQuery,
} from "./Bookmarks.dto";

const BookmarksAPI = {
  createManual: (): Promise<BookmarkManualCreateResult> =>
    ipcRenderer.invoke(BookmarksChannel.CreateManual).then(unwrapIpcResult),
  deleteManual: (id: string): Promise<void> =>
    ipcRenderer.invoke(BookmarksChannel.DeleteManual, id).then(unwrapIpcResult),
  getActivitySessionTimeline: (
    activitySessionId: string,
  ): Promise<ActivitySessionTimeline | null> =>
    ipcRenderer
      .invoke(BookmarksChannel.GetActivitySessionTimeline, activitySessionId)
      .then(unwrapIpcResult),
  listActivitySessions: (
    query?: ActivitySessionLibraryQuery,
  ): Promise<ActivitySessionLibraryPage> =>
    ipcRenderer
      .invoke(BookmarksChannel.ListActivitySessions, query)
      .then(unwrapIpcResult),
  listLibrary: (query?: BookmarkLibraryQuery): Promise<BookmarkLibraryPage> =>
    ipcRenderer
      .invoke(BookmarksChannel.ListLibrary, query)
      .then(unwrapIpcResult),
  listRecording: (
    recordingId: string,
    query?: RecordingBookmarksQuery,
  ): Promise<RecordingBookmarksPage> =>
    ipcRenderer
      .invoke(BookmarksChannel.ListRecording, recordingId, query)
      .then(unwrapIpcResult),
  updateManual: (input: BookmarkManualUpdateInput): Promise<void> =>
    ipcRenderer
      .invoke(BookmarksChannel.UpdateManual, input)
      .then(unwrapIpcResult),
};

export { BookmarksAPI };
