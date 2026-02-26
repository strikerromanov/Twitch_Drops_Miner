import React, { createContext, useContext, useEffect, useState, ReactNode } from 'react';

interface WebSocketContextType {
  ws: WebSocket | null;
  connected: boolean;
  messages: any[];
  sendMessage: (data: any) => void;
}

const WebSocketContext = createContext<WebSocketContextType>({
  ws: null,
  connected: false,
  messages: [],
  sendMessage: () => {}
});

export const useWebSocket = () => useContext(WebSocketContext);

interface WebSocketProviderProps {
  children: ReactNode;
}

export const WebSocketProvider: React.FC<WebSocketProviderProps> = ({ children }) => {
  const [ws, setWs] = useState<WebSocket | null>(null);
  const [connected, setConnected] = useState(false);
  const [messages, setMessages] = useState<any[]>([]);
  const [reconnectAttempts, setReconnectAttempts] = useState(0);

  const maxReconnectAttempts = 5;
  const reconnectDelay = 3000;

  useEffect(() => {
    const connect = () => {
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const host = window.location.host;
      const wsUrl = `${protocol}//${host}/ws`;

      console.log('WebSocket connecting to:', wsUrl);
      const socket = new WebSocket(wsUrl);

      socket.onopen = () => {
        console.log('WebSocket connected');
        setConnected(true);
        setReconnectAttempts(0);
      };

      socket.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          setMessages(prev => [...prev.slice(-99), data]);
        } catch (error) {
          console.error('Failed to parse WebSocket message:', error);
        }
      };

      socket.onclose = (event) => {
        console.log('WebSocket closed:', event.code, event.reason);
        setConnected(false);
        setWs(null);

        if (reconnectAttempts < maxReconnectAttempts) {
          console.log(`Reconnecting in ${reconnectDelay / 1000}s (attempt ${reconnectAttempts + 1}/${maxReconnectAttempts})`);
          setTimeout(() => {
            setReconnectAttempts(prev => prev + 1);
          }, reconnectDelay);
        }
      };

      socket.onerror = (error) => {
        console.error('WebSocket error:', error);
      };

      setWs(socket);
    };

    connect();

    return () => {
      if (ws) {
        ws.close();
      }
    };
  }, [reconnectAttempts]);

  const sendMessage = (data: any) => {
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify(data));
    } else {
      console.warn('WebSocket not connected, message not sent:', data);
    }
  };

  return (
    <WebSocketContext.Provider value={{ ws, connected, messages, sendMessage }}>
      {children}
    </WebSocketContext.Provider>
  );
};
