/**
 * Chat thread shapes for EntityPanel reverse "Referenced by ▸ Chats".
 * Full SchemaChat UI lands in a later Phase 13 slice (live ChatTab stays).
 */
export interface ChatRef {
  kind: 'entity' | 'doc' | 'record';
  id: string;
  name: string;
  entityKind?: 'base' | 'table' | 'field' | 'view';
  fieldType?: string;
}
export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  text: string;
  refs?: ChatRef[];
  convertedDoc?: { id: string; title: string };
}
export interface ChatThread {
  id: string;
  title: string;
  updatedAt: string;
  archived?: boolean;
  scope?: ChatRef[];
  messages: ChatMessage[];
}
