import { CanvasDocument } from './types';

interface ExportElement {
  type: string;
  x: number;
  y: number;
  width?: number;
  height?: number;
  text?: string;
  points?: { x: number; y: number }[];
  strokeColor?: string;
  backgroundColor?: string;
}

interface ExportData {
  document: {
    id: string;
    elements: ExportElement[];
  };
}

function exportElement(el: Record<string, any>): ExportElement {
  const out: ExportElement = {
    type: el.type ?? 'unknown',
    x: Math.round(el.x ?? 0),
    y: Math.round(el.y ?? 0),
  };

  if (el.width != null) out.width = Math.round(el.width);
  if (el.height != null) out.height = Math.round(el.height);
  if (el.text) out.text = el.text;
  if (el.strokeColor && el.strokeColor !== 'transparent') out.strokeColor = el.strokeColor;
  if (el.backgroundColor && el.backgroundColor !== 'transparent') out.backgroundColor = el.backgroundColor;

  // Linear elements (arrow, line) have points
  if (Array.isArray(el.points) && el.points.length > 0) {
    out.points = el.points.map((p: any) => ({
      x: Math.round(Array.isArray(p) ? p[0] : p.x ?? 0),
      y: Math.round(Array.isArray(p) ? p[1] : p.y ?? 0),
    }));
  }

  return out;
}

export function exportForAI(doc: CanvasDocument): ExportData {
  const elements = (doc.elements || [])
    .filter((el: any) => !el.isDeleted)
    .map(exportElement);

  return {
    document: { id: doc.id, elements },
  };
}

export function exportToClipboard(doc: CanvasDocument): string {
  const data = exportForAI(doc);
  const json = JSON.stringify(data, null, 2);
  navigator.clipboard.writeText(json);
  return json;
}
