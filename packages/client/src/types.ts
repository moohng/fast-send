
export interface SharedItem {
    id: number;
    type: 'text' | 'file';
    content?: string;
    filename?: string;
    originalName?: string;
    size?: string;
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
