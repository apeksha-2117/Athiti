import { io } from 'socket.io-client';
import { getAuthToken } from '../api/client';

let socket = null;

export function getSocket(customToken) {
  if (!socket) {
    const SOCKET_URL =
      import.meta.env.VITE_SOCKET_URL ||
      (import.meta.env.PROD ? 'https://athiti.onrender.com' : 'http://localhost:5000');
    const token = customToken || getAuthToken();

    socket = io(SOCKET_URL, {
      withCredentials: true,
      autoConnect: false,
      auth: { token },
      transports: ['websocket', 'polling'],
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      reconnectionAttempts: Infinity,
      timeout: 10000,
    });
  }
  return socket;
}

export function connectSocket(token) {
  const s = getSocket(token);
  const activeToken = token || getAuthToken();
  if (activeToken && s.auth) {
    s.auth.token = activeToken;
  }
  if (!s.connected) {
    s.connect();
  }
  return s;
}

export function disconnectSocket() {
  if (socket) {
    socket.disconnect();
    socket = null;
  }
}
