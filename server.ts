import 'dotenv/config';
import express from "express";
import { createServer as createViteServer } from "vite";
import axios from "axios";
import cron from "node-cron";
import Database from "better-sqlite3";

const db = new Database("messages.db");

// Create tables
try {
  db.exec(`
    CREATE TABLE IF NOT EXISTS scheduled_messages (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      number TEXT,
      name TEXT,
      message TEXT,
      scheduled_at DATETIME,
      status TEXT DEFAULT 'Agendado'
    );
    CREATE TABLE IF NOT EXISTS messages (
      id TEXT PRIMARY KEY,
      number TEXT,
      name TEXT,
      message TEXT,
      status TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT
    );
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT UNIQUE NOT NULL,
      email TEXT UNIQUE NOT NULL,
      password TEXT NOT NULL,
      role TEXT DEFAULT 'user',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE IF NOT EXISTS roles (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT UNIQUE NOT NULL,
      description TEXT,
      permissions TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
  `);
  
  console.log('✓ Database tables created/verified successfully');
  
  // Verify tables exist
  const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table'").all();
  console.log('Available tables:', tables.map((t: any) => t.name).join(', '));
  
} catch (error) {
  console.error('Error creating database tables:', error);
  throw error;
}

db.prepare("INSERT OR IGNORE INTO settings (key, value) VALUES (?, ?)").run('instance_name', process.env.EVOLUTION_INSTANCE || 'default');
db.prepare("INSERT OR IGNORE INTO settings (key, value) VALUES (?, ?)").run('timezone', 'America/Sao_Paulo');

const app = express();
app.use(express.json());

const EVOLUTION_API_URL = process.env.EVOLUTION_API_URL;
const EVOLUTION_API_KEY = process.env.EVOLUTION_API_KEY;
const EVOLUTION_INSTANCE = process.env.EVOLUTION_INSTANCE;

async function sendWhatsAppMessage(number: string, message: string, name?: string) {
  const instanceName = db.prepare("SELECT value FROM settings WHERE key = 'instance_name'").get().value;
  console.log(`Sending message to ${number}: "${message}"`);
  const actualNumber = (number.includes(';') ? number.split(';')[1] : number).replace(/[^0-9]/g, '');
  const actualName = name || (number.includes(';') ? number.split(';')[0] : undefined);
  const payload = {
    number: actualNumber,
    text: message,
  };
  try {
    console.log(`Sending payload to ${instanceName}:`, payload);
    const response = await axios.post(
      `${EVOLUTION_API_URL}/message/sendText/${instanceName}`,
      payload,
      {
        headers: {
          apikey: EVOLUTION_API_KEY,
          "Content-Type": "application/json",
        },
      }
    );
    const messageId = response.data.key.id;
    const now = new Date().toISOString();
    db.prepare("INSERT INTO messages (id, number, name, message, status, created_at) VALUES (?, ?, ?, ?, ?, ?)").run(messageId, actualNumber, actualName || null, message, 'sent', now);
    console.log(`Message sent to ${actualNumber}, ID: ${messageId}`);
  } catch (error: any) {
    console.error(`Failed to send message to ${actualNumber}. Payload:`, JSON.stringify(payload));
    console.error(`Error response:`, JSON.stringify(error.response?.data || error.message));
    return false;
  }
  return true;
}

app.post("/api/webhook", (req, res) => {
  const { key, status } = req.body;
  if (key && status) {
    db.prepare("UPDATE messages SET status = ? WHERE id = ?").run(status, key.id);
  }
  res.sendStatus(200);
});

app.get("/api/messages", (req, res) => {
  const messages = db.prepare("SELECT * FROM messages ORDER BY created_at DESC").all();
  res.json(messages);
});

app.post("/api/messages/clear", (req, res) => {
  db.prepare("DELETE FROM messages").run();
  res.json({ status: "cleared" });
});

app.post("/api/send-now", async (req, res) => {
  const { name, number, message } = req.body;
  await sendWhatsAppMessage(number, message, name);
  res.json({ status: "sent" });
});

app.post("/api/send-bulk", async (req, res) => {
  const { numbers, message, delay } = req.body;
  console.log(`Bulk sending initiated. Numbers: ${JSON.stringify(numbers)}, Message: ${message}, Delay: ${delay}`);
  // Send asynchronously with delay
  (async () => {
    for (let i = 0; i < numbers.length; i++) {
      const number = numbers[i];
      console.log(`Sending bulk message to ${number}`);
      
      // Apply delay before sending, except for the first message
      if (i > 0) {
        await new Promise(resolve => setTimeout(resolve, (delay || 1) * 1000));
      }
      
      await sendWhatsAppMessage(number, message);
    }
  })();
  res.json({ status: "bulk-initiated" });
});

app.get("/api/settings", (req, res) => {
  const instanceSetting = db.prepare("SELECT value FROM settings WHERE key = 'instance_name'").get();
  const timezoneSetting = db.prepare("SELECT value FROM settings WHERE key = 'timezone'").get();
  res.json({ 
    instanceName: instanceSetting?.value,
    timezone: timezoneSetting?.value || 'America/Sao_Paulo'
  });
});

app.post("/api/settings", (req, res) => {
  const { instanceName, timezone } = req.body;
  if (instanceName !== undefined) {
    db.prepare("UPDATE settings SET value = ? WHERE key = 'instance_name'").run(instanceName);
  }
  if (timezone !== undefined) {
    db.prepare("UPDATE settings SET value = ? WHERE key = 'timezone'").run(timezone);
  }
  res.json({ status: "updated" });
});

app.post("/api/schedule", (req, res) => {
  const { name, number, message, scheduledAt } = req.body;
  console.log(`Scheduling message. Name: ${name}, Number: ${number}, Message: ${message}, ScheduledAt: ${scheduledAt}`);
  if (!message || message.trim() === "") {
    console.error("Attempted to schedule message with empty text");
    return res.status(400).json({ error: "Message is required" });
  }
  const stmt = db.prepare("INSERT INTO scheduled_messages (name, number, message, scheduled_at) VALUES (?, ?, ?, ?)");
  stmt.run(name, number, message, scheduledAt);
  res.json({ status: "scheduled" });
});

app.get("/api/scheduled-messages", (req, res) => {
  const messages = db.prepare("SELECT * FROM scheduled_messages").all();
  res.json(messages);
});

// Users routes
app.get("/api/users", (req, res) => {
  try {
    console.log('GET /api/users - Fetching users');
    const users = db.prepare("SELECT id, username, email, role, created_at FROM users").all();
    console.log('Found users:', users.length);
    return res.json(users);
  } catch (error: any) {
    console.error('Error fetching users:', error.message);
    return res.status(500).json({ error: error.message });
  }
});

app.post("/api/users", (req, res) => {
  try {
    const { username, email, password, role } = req.body;
    console.log('POST /api/users - Creating user:', { username, email, role });
    
    if (!username || !email || !password) {
      console.log('Validation failed: missing required fields');
      return res.status(400).json({ error: 'Campos obrigatórios faltando' });
    }
    
    // Verify table exists
    const tableExists = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='users'").get();
    if (!tableExists) {
      console.error('ERROR: users table does not exist!');
      return res.status(500).json({ error: 'Tabela users não existe. Reinicie o servidor.' });
    }
    
    const stmt = db.prepare("INSERT INTO users (username, email, password, role) VALUES (?, ?, ?, ?)");
    const result = stmt.run(username, email, password, role || 'user');
    console.log('User created successfully with ID:', result.lastInsertRowid);
    return res.status(200).json({ status: "created", id: result.lastInsertRowid });
  } catch (error: any) {
    console.error('Error creating user:', error.message);
    return res.status(400).json({ error: error.message });
  }
});

app.delete("/api/users/:id", (req, res) => {
  try {
    const { id } = req.params;
    db.prepare("DELETE FROM users WHERE id = ?").run(id);
    return res.json({ status: "deleted" });
  } catch (error: any) {
    console.error('Error deleting user:', error.message);
    return res.status(400).json({ error: error.message });
  }
});

// Roles routes
app.get("/api/roles", (req, res) => {
  try {
    console.log('GET /api/roles - Fetching roles');
    const roles = db.prepare("SELECT * FROM roles").all();
    console.log('Found roles:', roles.length);
    return res.json(roles);
  } catch (error: any) {
    console.error('Error fetching roles:', error.message);
    return res.status(500).json({ error: error.message });
  }
});

app.post("/api/roles", (req, res) => {
  try {
    const { name, description, permissions } = req.body;
    console.log('POST /api/roles - Creating role:', { name, description, permissions });
    
    if (!name) {
      console.log('Validation failed: name is required');
      return res.status(400).json({ error: 'Nome do grupo é obrigatório' });
    }
    
    // Verify table exists
    const tableExists = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='roles'").get();
    if (!tableExists) {
      console.error('ERROR: roles table does not exist!');
      return res.status(500).json({ error: 'Tabela roles não existe. Reinicie o servidor.' });
    }
    
    const stmt = db.prepare("INSERT INTO roles (name, description, permissions) VALUES (?, ?, ?)");
    const result = stmt.run(name, description || '', permissions || '');
    console.log('Role created successfully with ID:', result.lastInsertRowid);
    return res.status(200).json({ status: "created", id: result.lastInsertRowid });
  } catch (error: any) {
    console.error('Error creating role:', error.message);
    return res.status(400).json({ error: error.message });
  }
});

app.delete("/api/roles/:id", (req, res) => {
  try {
    const { id } = req.params;
    db.prepare("DELETE FROM roles WHERE id = ?").run(id);
    return res.json({ status: "deleted" });
  } catch (error: any) {
    console.error('Error deleting role:', error.message);
    return res.status(400).json({ error: error.message });
  }
});

// Cron job to check for scheduled messages
cron.schedule("* * * * *", async () => {
  const now = new Date().toISOString().slice(0, 16);
  const stmt = db.prepare("SELECT * FROM scheduled_messages WHERE scheduled_at <= ?");
  const messages = stmt.all(now);
  console.log(`Checking scheduled messages. Now: ${now}, Found: ${messages.length}`);
  
  for (const msg of messages) {
    const success = await sendWhatsAppMessage(msg.number, msg.message, msg.name);
    if (success) {
      db.prepare("DELETE FROM scheduled_messages WHERE id = ?").run(msg.id);
    }
    await new Promise(resolve => setTimeout(resolve, 2000));
  }
});

// Error handling middleware (must be after all routes)
app.use((err: any, req: any, res: any, next: any) => {
  console.error('Global error handler:', err);
  if (!res.headersSent) {
    res.status(500).json({ error: err.message || 'Internal server error' });
  }
});

async function startServer() {
  const PORT = 3000;

  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
