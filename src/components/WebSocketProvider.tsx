import React, { createContext, useContext, useEffect, useState, ReactNode } from 'react';

interface WebSocketContextType {
  connected: boolean;
  stats: any;
  recentClaims: any[];
  activeStreams: any[];
  recentBets: any[];
}

const WebSocketContext = createContext<WebSocketContextType>({
  connected: false,
  stats: null,
  recentClaims: [],
  activeStreams: [],
  recentBets: []
});

export const useWebSocket = () => useContext(WebSocketContext);

interface WebSocketProviderProps {
  children: ReactNode;
}

export const WebSocketProvider: React.FC<WebSocketProviderProps> = ({ children }) => {
  const [ws, setWs] = useState<WebSocket | null>(null);
  const [connected, setConnected] = useState(false);
  const [stats, setStats] = useState(null);
  const [recentClaims, setRecentClaims] = useState([]);
  const [activeStreams, setActiveStreams] = useState([]);
  const [recentBets, setRecentBets] = useState([]);

  useEffect(() => {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${protocol}//${window.location.host}/ws`;
    
    console.log('Connecting to WebSocket:', wsUrl);
    const websocket = new WebSocket(wsUrl);

    websocket.onopen = () => {
      console.log('WebSocket connected');
      setConnected(true);
      setWs(websocket);
    };

    websocket.onmessage = (event) => {
      try {
        const message = JSON.parse(event.data);
        console.log('WebSocket message:', message.type);

        switch (message.type) {
          case 'initial':
            setStats(message.data.stats);
            setRecentClaims(message.data.recentClaims);
            setActiveStreams(message.data.activeStreams);
            break;
          case 'update':
            if (message.data) {
              setStats(message.data.stats);
              if (message.data.recentClaims?.length > 0) {
                setRecentClaims(prev => [...message.data.recentClaims, ...prev].slice(0, 20));
              }
              setActiveStreams(message.data.activeStreams);
              if (message.data.recentBets?.length > 0) {
                setRecentBets(prev => [...message.data.recentBets, ...prev].slice(0, 20));
              }
            }
            break;
          case 'point_claim':
            setRecentClaims(prev => [message.data, ...prev].slice(0, 20));
            break;
          case 'bet_result':
            setRecentBets(prev => [message.data, ...prev].slice(0, 20));
            break;
          case 'stream_status':
            setActiveStreams(prev => {
              const existing = prev.findIndex(s => s.streamer === message.data.streamer);
              if (existing >= 0) {
                const updated = [...prev];
                updated[existing] = { ...updated[existing], ...message.data };
                return updated;
              }
              return prev;
            });
            break;
        }
      } catch (error) {
        console.error('Error parsing WebSocket message:', error);
      }
    };

    websocket.onerror = (error) => {
      console.error('WebSocket error:', error);
    };

    websocket.onclose = () => {
      console.log('WebSocket disconnected, attempting to reconnect...');
      setConnected(false);
      setTimeout(() => {
        window.location.reload();
      }, 5000);
    };

    return () => {
      websocket.close();
    };
  }, []);

  return (
    <WebSocketContext.Provider value={{ connected, stats, recentClaims, activeStreams, recentBets }}>
      {children}
    </WebSocketContext.Provider>
  );
};
