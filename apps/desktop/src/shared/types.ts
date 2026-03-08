// Shared IPC type definitions between main and renderer processes.

export interface PingResponse {
  status: string;
  version: string;
}

export interface OpenWorkspaceResponse {
  workspaceId: string;
  path: string;
}

export interface ReadFileResponse {
  content: string;
}

export interface Patch {
  filePath: string;
  content: string;
}

export interface GenerateResponse {
  taskId: string;
  patches: Patch[];
}

export interface PatchResult {
  filePath: string;
  applied: boolean;
  error?: string;
}

export interface ApplyPatchesResponse {
  results: PatchResult[];
}

export interface TerminalData {
  sessionId: string;
  data: string; // base64 encoded
}

export interface FileEntry {
  name: string;
  isDir: boolean;
  size: number;
}

export interface ListDirectoryResponse {
  entries: FileEntry[];
}

export interface JamoEvent {
  id: string;
  type: string;
  payload: string; // base64 encoded
  timestampMs: number;
}

// Git types
export interface ChangedFile {
  path: string;
  status: string;
}

export interface GitStatusResponse {
  files: ChangedFile[];
  isClean: boolean;
}

export interface GitDiffResponse {
  diff: string;
}

export interface GitCommitResponse {
  commitHash: string;
}

export interface GitLogEntry {
  hash: string;
  shortHash: string;
  message: string;
  timestamp: string;
}

export interface GitLogResponse {
  entries: GitLogEntry[];
}

// IPC channel names
export const IPC = {
  PING: 'jamo:ping',
  OPEN_WORKSPACE: 'jamo:open-workspace',
  READ_FILE: 'jamo:read-file',
  WRITE_FILE: 'jamo:write-file',
  CREATE_TERMINAL: 'jamo:create-terminal',
  START_TERMINAL_STREAM: 'jamo:start-terminal-stream',
  SEND_TERMINAL_INPUT: 'jamo:send-terminal-input',
  RESIZE_TERMINAL: 'jamo:resize-terminal',
  TERMINAL_DATA: 'jamo:terminal-data',
  TERMINAL_END: 'jamo:terminal-end',
  GENERATE: 'jamo:generate',
  APPLY_PATCHES: 'jamo:apply-patches',
  SUBSCRIBE_EVENTS: 'jamo:subscribe-events',
  EVENT: 'jamo:event',
  SELECT_DIRECTORY: 'jamo:select-directory',
  WRITE_FILE_BINARY: 'jamo:write-file-binary',
  READ_FILE_BINARY: 'jamo:read-file-binary',
  LIST_DIRECTORY: 'jamo:list-directory',
  MOVE_FILE: 'jamo:move-file',
  CREATE_DIRECTORY: 'jamo:create-directory',
  DELETE_FILE: 'jamo:delete-file',
  GIT_INIT: 'jamo:git-init',
  GIT_STATUS: 'jamo:git-status',
  GIT_DIFF: 'jamo:git-diff',
  GIT_COMMIT: 'jamo:git-commit',
  GIT_LOG: 'jamo:git-log',
  CHECK_DIR_EMPTY: 'jamo:check-dir-empty',
  CLEAR_DIR: 'jamo:clear-dir',
  OPEN_EXTERNAL: 'jamo:open-external',
} as const;

// Window API exposed via preload
export interface JamoAPI {
  ping(): Promise<PingResponse>;
  selectDirectory(): Promise<string | null>;
  openWorkspace(path: string): Promise<OpenWorkspaceResponse>;
  readFile(wsId: string, path: string): Promise<ReadFileResponse>;
  writeFile(wsId: string, path: string, content: string): Promise<void>;
  writeFileBinary(wsId: string, path: string, base64Content: string): Promise<void>;
  readFileBinary(wsId: string, path: string): Promise<string>;
  listDirectory(wsId: string, path: string): Promise<ListDirectoryResponse>;
  moveFile(wsId: string, oldPath: string, newPath: string): Promise<void>;
  createDirectory(wsId: string, path: string): Promise<void>;
  deleteFile(wsId: string, path: string): Promise<void>;
  createTerminal(wsId: string, cols: number, rows: number): Promise<string>;
  startTerminalStream(sessionId: string): void;
  sendTerminalInput(sessionId: string, data: string): void;
  resizeTerminal(sessionId: string, cols: number, rows: number): void;
  onTerminalData(cb: (data: TerminalData) => void): () => void;
  onTerminalEnd(cb: (sessionId: string) => void): () => void;
  generate(wsId: string, prompt: string): Promise<GenerateResponse>;
  applyPatches(wsId: string, taskId: string, patches: Patch[]): Promise<ApplyPatchesResponse>;
  subscribeEvents(wsId: string): void;
  onEvent(cb: (event: JamoEvent) => void): () => void;
  checkDirEmpty(dirPath: string): Promise<boolean>;
  clearDir(dirPath: string): Promise<void>;
  gitInit(wsId: string): Promise<{ alreadyInitialized: boolean }>;
  gitStatus(wsId: string): Promise<GitStatusResponse>;
  gitDiff(wsId: string, filePath?: string): Promise<GitDiffResponse>;
  gitCommit(wsId: string, message: string): Promise<GitCommitResponse>;
  gitLog(wsId: string, limit?: number): Promise<GitLogResponse>;
  openExternal(url: string): Promise<void>;
}

declare global {
  interface Window {
    jamo: JamoAPI;
  }
}
