export interface SharedItem {
  id: number;
  type: 'text' | 'file';
  content?: string;
  filename?: string;
  originalName?: string;
  size?: string;
  time: string;
  senderId: string;
  progress?: number;
}
export interface Device { name: string; ip: string; }
export interface ServerConfig { ip: string; url: string; qr: string; }
