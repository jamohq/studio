export interface RichTextDocument {
  version: number;
  id: string;
  createdAt: string;
  updatedAt: string;
  content: Record<string, any>;
}
