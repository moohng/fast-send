import { useState, useEffect, useRef } from 'react';
import { io, Socket } from 'socket.io-client';
import { Device } from '../types';

export const useSocket = (baseUrl: string, clientId: string, isMobile: boolean, isElectron: boolean) => {
  const [devices, setDevices] = useState<Device[]>([]);
  const socketRef = useRef<Socket | null>(null);

  useEffect(() => {
    if (!baseUrl) return;

    const socket = io(baseUrl);
    socketRef.current = socket;

    socket.on('connect', () => {
      socket.emit('register', { 
        id: clientId, 
        type: isMobile ? 'mobile' : (isElectron ? 'desktop' : 'web') 
      });
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
