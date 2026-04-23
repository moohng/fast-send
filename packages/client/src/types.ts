
export interface FileInfo {
    filename: string;
    originalName: string;
    size: string;
    type: 'image' | 'video' | 'file';
}

export interface SharedItem {
    id: number;
    type: 'text' | 'file' | 'gallery';
    content?: string;
    filename?: string;
    originalName?: string;
    size?: string;
    files?: FileInfo[];
    time: string;
    fullTime: string;
    senderId: string;
    progress?: number;
}

export interface DeviceInfo {
    id: string;
    name: string;
    type: string;
    ip: string;
    lastSocketId: string;
}

export interface ServerConfig {
    ip: string;
    allIps: string[];
    url: string;
    qr: string;
}
