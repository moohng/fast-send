import { useState, useEffect, useCallback } from 'react';
import { Socket } from 'socket.io-client';
import { SharedItem } from '../types';

export const useItems = (baseUrl: string, socket: Socket | null, clientId: string, showToast: (m: string, t?: any) => void) => {
  const [items, setItems] = useState<SharedItem[]>([]);

  const fetchData = useCallback(async (newUrl?: string) => {
    const targetUrl = newUrl || baseUrl;
    if (!targetUrl) return;
    console.log('[Items] Fetching from:', targetUrl);
    try {
      const itemsRes = await fetch(`${targetUrl}/api/items`, {
        mode: 'cors',
        headers: { 'Accept': 'application/json' }
      });
      const i = await itemsRes.json();
      console.log('[Items] Fetched:', i.length, 'items');
      setItems([...i].reverse());
    } catch (e: any) {
      console.error('[Items] Fetch error:', e.message);
    }
  }, [baseUrl]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  useEffect(() => {
    if (!socket) return;

    socket.on('new-item', (item: SharedItem) => {
      setItems(p => p.some(x => x.id === item.id) ? p : [...p, item]);
      if (item.senderId !== clientId && !['CLIPBOARD_SYNC', 'CLIPBOARD_IMAGE'].includes(item.senderId)) {
        showToast('收到新内容', 'info');
      }
    });

    socket.on('item-removed', (id: number) => {
      setItems(p => p.filter(x => x.id !== id));
    });

    socket.on('items-cleared', () => {
      setItems([]);
    });

    return () => {
      socket.off('new-item');
      socket.off('item-removed');
      socket.off('items-cleared');
    };
  }, [socket, clientId, showToast]);

  const handleDelete = async (id: number) => {
    try {
      const res = await fetch(`${baseUrl}/api/items/${id}`, { method: 'DELETE' });
      if (res.ok) {
        setItems(p => p.filter(x => x.id !== id));
        showToast('已删除记录');
      }
    } catch (e) {
      showToast('删除失败', 'error');
    }
  };

  return { items, setItems, fetchData, handleDelete };
};
