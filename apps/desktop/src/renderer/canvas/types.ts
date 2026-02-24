// Canvas document types — wraps Excalidraw data for persistence

export interface CanvasDocument {
  version: number;
  id: string;
  createdAt: string;
  updatedAt: string;
  /** Raw Excalidraw elements array */
  elements: readonly Record<string, unknown>[];
  /** Serializable subset of Excalidraw AppState */
  appState: CanvasAppState;
}

/** Only the appState fields we persist (Excalidraw has many transient fields) */
export interface CanvasAppState {
  viewBackgroundColor?: string;
  gridSize?: number | null;
  zenModeEnabled?: boolean;
}
