import express from "express";
import { createServer } from "http";
import { WebSocketServer, WebSocket } from "ws";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const port = process.env.PORT || 3000;

// Enable JSON parse middleware
app.use(express.json());

// Serve static assets from the 'dist' directory after Vite build
app.use(express.static(path.join(__dirname, "dist")));

// API endpoint to create a group
const groups = {}; // Format: { groupId: { hostId: string, members: [{ id, name, deviceType, isHost }] } }

app.post("/api/groups", (req, res) => {
  const { hostId, hostName, deviceType } = req.body;
  const groupId = Math.random().toString(36).substring(2, 8).toUpperCase();

  groups[groupId] = {
    groupId,
    hostId,
    createdAt: new Date().toISOString(),
    members: [
      {
        id: hostId,
        name: hostName || `Host-Device`,
        deviceType: deviceType || "iPhone",
        isHost: true,
      }
    ]
  };

  res.json({ success: true, groupId, group: groups[groupId] });
});

// Get group info
app.get("/api/groups/:groupId", (req, res) => {
  const { groupId } = req.params;
  const group = groups[groupId];
  if (!group) {
    return res.status(404).json({ success: false, message: "Group not found" });
  }
  res.json({ success: true, group });
});

// Fallback all other routes to index.html for SPA routing using a robust fallback middleware
app.use((req, res, next) => {
  // If the request is for an API or static file, let it go (though those are handled above)
  if (req.path.startsWith("/api")) {
    return next();
  }
  res.sendFile(path.join(__dirname, "dist", "index.html"));
});

// Create HTTP Server
const server = createServer(app);

// Create WebSocket Server
const wss = new WebSocketServer({ server });

// Track active WebSocket connections
// clientInfo: Map<WebSocket, { id, name, groupId, deviceType, isHost }>
const clients = new Map();

wss.on("connection", (ws) => {
  console.log("New WebSocket connection established");

  ws.on("message", (messageStr) => {
    try {
      const data = JSON.parse(messageStr);
      const { type, payload } = data;

      switch (type) {
        case "JOIN_ROOM": {
          const { groupId, userId, userName, deviceType, isHost } = payload;

          // Store connection details
          clients.set(ws, {
            id: userId,
            name: userName,
            groupId: groupId,
            deviceType: deviceType,
            isHost: isHost,
          });

          // Update active memory room if not exists or add member if missing
          if (!groups[groupId]) {
            groups[groupId] = {
              groupId,
              hostId: isHost ? userId : null,
              members: []
            };
          }

          const room = groups[groupId];
          const exists = room.members.find(m => m.id === userId);
          if (!exists) {
            room.members.push({
              id: userId,
              name: userName,
              deviceType: deviceType,
              isHost: isHost
            });
          } else {
            // Update online status or name
            exists.name = userName;
            exists.deviceType = deviceType;
          }

          console.log(`User ${userName} (${userId}) joined Room ${groupId}`);

          // Broadcast updated member list to everyone in this room
          broadcastToRoom(groupId, {
            type: "ROOM_UPDATED",
            payload: {
              groupId,
              members: room.members
            }
          });

          // Send system join alert
          broadcastToRoom(groupId, {
            type: "SYSTEM_ALERT",
            payload: {
              text: `${userName} (${deviceType}) joined the translation group.`,
              timestamp: new Date().toISOString()
            }
          });
          break;
        }

        case "SEND_MESSAGE": {
          const { groupId, senderId, senderName, text, sourceLang, voiceUrl } = payload;
          console.log(`Message in ${groupId} from ${senderName}: ${text}`);

          // Broadcast speech/text event to everyone in the group
          broadcastToRoom(groupId, {
            type: "NEW_MESSAGE",
            payload: {
              messageId: Math.random().toString(36).substring(2, 9),
              senderId,
              senderName,
              text,
              sourceLang,
              voiceUrl: voiceUrl || null,
              timestamp: new Date().toISOString()
            }
          });
          break;
        }

        case "SIMULATE_NFC_BUMP": {
          const { groupId, senderId, senderName, targetDeviceType } = payload;
          // Facilitate NFC Bump/AirDrop simulation discovery
          broadcastToRoom(groupId, {
            type: "NFC_BUMP_RECEIVED",
            payload: {
              senderId,
              senderName,
              targetDeviceType,
              groupId
            }
          });
          break;
        }

        default:
          console.log("Unknown WebSocket event:", type);
      }
    } catch (err) {
      console.error("Error parsing WebSocket message:", err);
    }
  });

  ws.on("close", () => {
    const client = clients.get(ws);
    if (client) {
      const { id, name, groupId } = client;
      console.log(`User ${name} (${id}) disconnected`);
      clients.delete(ws);

      // Clean up room memory representation if needed, or update status
      const room = groups[groupId];
      if (room) {
        room.members = room.members.filter(m => m.id !== id);

        // If room is empty, we can clean it up
        if (room.members.length === 0) {
          delete groups[groupId];
          console.log(`Room ${groupId} is now empty and has been removed.`);
        } else {
          // Broadcast updated member list to remaining members
          broadcastToRoom(groupId, {
            type: "ROOM_UPDATED",
            payload: {
              groupId,
              members: room.members
            }
          });

          // Send system leave alert
          broadcastToRoom(groupId, {
            type: "SYSTEM_ALERT",
            payload: {
              text: `${name} left the group.`,
              timestamp: new Date().toISOString()
            }
          });
        }
      }
    }
  });
});

// Broadcast helper for specific room
function broadcastToRoom(groupId, data) {
  const msgStr = JSON.stringify(data);
  for (const [ws, info] of clients.entries()) {
    if (info.groupId === groupId && ws.readyState === WebSocket.OPEN) {
      ws.send(msgStr);
    }
  }
}

// Start the server
server.listen(port, "0.0.0.0", () => {
  console.log(`Translation Simulation Server is running on http://0.0.0.0:${port}`);
});
