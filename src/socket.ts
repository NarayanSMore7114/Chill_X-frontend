import { io, Socket } from "socket.io-client";

const isBrowser = typeof window !== "undefined"; 

const BACKEND_URL =
  "https://chill-x-backend.onrender.com";

export const socket: Socket = io(BACKEND_URL, {
  autoConnect: isBrowser,
  transports: ["polling", "websocket"], // Crucial: start with polling, upgrade to websocket
  upgrade: true,
  withCredentials: false,
  reconnection: true,
  reconnectionAttempts: 10,
  reconnectionDelay: 2000,
  timeout: 45000, // 45s timeout to tolerate Render free cold starts
});

export const getSocket = (): Socket => {
  if (isBrowser && !socket.connected) {
    socket.connect();
  }
  return socket;
}; 

socket.on("connect", () => {
  console.log("[SOCKET] Successfully connected to backend! ID:", socket.id);
});

socket.on("connect_error", (err) => {
  console.warn("[SOCKET] Connection error / waking up server:", err.message);
});

