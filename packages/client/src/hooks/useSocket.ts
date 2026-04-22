import { useState, useEffect, useRef } from 'react';
import { io, Socket } from 'socket.io-client';
import { Device } from '../types';

export const useSocket = (baseUrl: string, clientId: string, isMobile: boolean, isElectron: boolean) => {
  const [devices, setDevices] = useState<Device[]>([]);
  const socketRef = useRef<Socket | null>(null);

  useEffect(() => {
    if (!baseUrl) return;

    const socket = io(baseUrl, {
      transports: ['websocket', 'polling'], // 强制优先 websocket
      reconnectionAttempts: 5,
      timeout: 10000
    });
    socketRef.current = socket;
    console.log('[Socket] Connecting to:', baseUrl);

    socket.on('connect', () => {
      console.log('[Socket] Connected! Client ID:', clientId);
      socket.emit('register', { 
        id: clientId, 
        type: isMobile ? 'mobile' : (isElectron ? 'desktop' : 'web') 
      });
    });

    socket.on('connect_error', (err) => {
      console.error('[Socket] Connection error:', err.message);
    });

    socket.on('devices-update', (data: Device[]) => {
      setDevices(data);
    });

    return () => {
      socket.close();
    };
  }, [baseUrl, clientId, isMobile, isElectron]);

  return { socket: socketRef.current, devices };
};
