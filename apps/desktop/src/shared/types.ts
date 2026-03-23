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

// Commit tag system
export type CommitTag = 'auto-code' | 'auto-design' | 'manual-code' | 'manual-design' | 'chat-log';
export type CommitSource = 'chat' | 'action' | 'manual';

export interface CommitMetadata {
  tag: CommitTag;
  source: CommitSource;
  runId?: string;
}

// Git types
export interface ChangedFile {
  path: string;
  status: string;
  /** 'staged' | 'partially-staged' | '' */
  indexStatus?: string;
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
  meta?: CommitMetadata;
  filesChanged?: number;
}

export interface GitLogResponse {
  entries: GitLogEntry[];
}

// Chat & Run types
export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
  runId?: string;
}

export interface Run {
  id: string;
  type: 'chat';
  status: 'running' | 'completed' | 'error' | 'cancelled';
  input: {
    message: string;
    notes: string | null;
    context: ChatContext;
    parentRunId: string | null;
  };
  output: {
    filesChanged: string[];
    messageCount: number;
  };
  messages: ChatMessage[];
  createdAt: string;
  completedAt: string | null;
}

export interface ChatStreamChunk {
  runId: string;
  delta?: string;
  fileChange?: string;
  toolUse?: { name: string; input: string };
  sessionId?: string;
  status?: 'completed' | 'error' | 'cancelled';
  error?: string;
}

export interface ChatContext {
  openFile?: string;
  openFileContent?: string;
  projectSections?: Record<string, string>;
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
  GIT_CHECKOUT: 'jamo:git-checkout',
  CHECK_DIR_EMPTY: 'jamo:check-dir-empty',
  CLEAR_DIR: 'jamo:clear-dir',
  OPEN_EXTERNAL: 'jamo:open-external',
  CHECK_ENVIRONMENT: 'jamo:check-environment',
  CHAT_SEND: 'jamo:chat-send',
  CHAT_STREAM: 'jamo:chat-stream',
  CHAT_CANCEL: 'jamo:chat-cancel',
  LIST_RUNS: 'jamo:list-runs',
  GET_RUN: 'jamo:get-run',
  // Smart commit
  SMART_COMMIT: 'jamo:smart-commit',
  GET_COMMIT_HISTORY: 'jamo:get-commit-history',
  GIT_DIFF_COMMITS: 'jamo:git-diff-commits',
  GIT_REVERT_TO: 'jamo:git-revert-to',
  GIT_ADD: 'jamo:git-add',
  GIT_RESET_FILES: 'jamo:git-reset-files',
  GIT_BRANCH: 'jamo:git-branch',
  GIT_COMMIT_STAGED: 'jamo:git-commit-staged',
  GIT_DIFF_STAGED: 'jamo:git-diff-staged',
} as const;

// Environment check types
export interface DepCheck {
  name: string;
  found: boolean;
  version?: string;
  error?: string;
  warning?: string;
  fix?: string;
  fixUrl?: string;
}

export interface EnvCheckResult {
  deps: DepCheck[];
  claudeAuthenticated: boolean;
  claudeBypassMode: boolean;
  ready: boolean;
}

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
  gitCheckout(wsId: string, paths?: string[]): Promise<void>;
  smartCommit(wsId: string, opts: { tag: CommitTag; description: string; source: CommitSource; runId?: string }): Promise<GitCommitResponse>;
  getCommitHistory(wsId: string, limit?: number): Promise<GitLogResponse>;
  gitDiffCommits(wsId: string, fromRef: string, toRef: string): Promise<{ files: Array<{ path: string; status: string }>; diff: string }>;
  gitRevertTo(wsId: string, commitHash: string): Promise<GitCommitResponse>;
  gitAdd(wsId: string, paths: string[]): Promise<void>;
  gitResetFiles(wsId: string, paths: string[]): Promise<void>;
  gitBranch(wsId: string): Promise<{ branch: string }>;
  gitCommitStaged(wsId: string, message: string): Promise<GitCommitResponse>;
  gitDiffStaged(wsId: string, filePath?: string): Promise<GitDiffResponse>;
  openExternal(url: string): Promise<void>;
  checkEnvironment(): Promise<EnvCheckResult>;
  chatSend(wsId: string, message: string, context: ChatContext, existingMessages?: ChatMessage[]): Promise<{ runId: string }>;
  onChatStream(cb: (chunk: ChatStreamChunk) => void): () => void;
  chatCancel(runId: string): Promise<void>;
  listRuns(wsId: string, limit?: number): Promise<Run[]>;
  getRun(wsId: string, runId: string): Promise<Run>;
}

declare global {
  interface Window {
    jamo: JamoAPI;
  }
}
