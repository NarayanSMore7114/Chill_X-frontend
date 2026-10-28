import { io, Socket } from "socket.io-client";

const isBrowser = typeof window !== "undefined";

const BACKEND_URL =
  (import.meta.env.VITE_BACKEND_URL as string) ||
  "https://chill-x-backend.onrender.com";

export const socket: Socket = io(BACKEND_URL, {
  autoConnect: isBrowser,
  transports: ["polling", "websocket"],
  upgrade: true,
  withCredentials: false,
  reconnection: true,
  reconnectionAttempts: 15,
  reconnectionDelay: 1500,
  reconnectionDelayMax: 5000,
  timeout: 45000, // Accommodates Render free tier cold starts
});

export const getSocket = (): Socket => {
  if (isBrowser && !socket.connected) {
    socket.connect();
  }
  return socket;
};

// Client-only event logging (prevents Node SSR hydration warnings)
if (isBrowser) {
  socket.on("connect", () => {
    console.log("[SOCKET] Connected to backend! Socket ID:", socket.id);
  });

  socket.on("connect_error", (err) => {
    console.warn("[SOCKET] Connection notice:", err.message);
  });
}