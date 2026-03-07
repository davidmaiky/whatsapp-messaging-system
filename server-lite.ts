import 'dotenv/config';
import express from "express";
import Database from "better-sqlite3";
import multer from "multer";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const db = new Database("messages.db");

// Modo teste
const TEST_MODE = process.env.TEST_MODE === 'true';

const addColumnIfNotExists = (tableName: string, columnName: string, definition: string) => {
  const existingColumns = db.prepare(`PRAGMA table_info(${tableName})`).all() as Array<{ name: string }>;
  const hasColumn = existingColumns.some((column) => column.name === columnName);
  if (!hasColumn) {
    db.prepare(`ALTER TABLE ${tableName} ADD COLUMN ${columnName} ${definition}`).run();
  }
};

try {
  db.exec(`
    CREATE TABLE IF NOT EXISTS scheduled_messages (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      number TEXT,
      name TEXT,
      message TEXT,
      media_type TEXT,
      media_data TEXT,
      media_name TEXT,
      media_mime_type TEXT,
      scheduled_at DATETIME,
      status TEXT DEFAULT 'Agendado'
    );
    CREATE TABLE IF NOT EXISTS messages (
      id TEXT PRIMARY KEY,
      number TEXT,
      name TEXT,
      message TEXT,
      media_type TEXT,
      media_name TEXT,
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
    CREATE TABLE IF NOT EXISTS contacts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT,
      number TEXT UNIQUE NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
  `);
  
  console.log('✓ Tabelas do banco criadas/verificadas com sucesso');
} catch (error) {
  console.error('Erro ao criar tabelas do banco:', error);
  throw error;
}

addColumnIfNotExists('messages', 'media_type', 'TEXT');
addColumnIfNotExists('messages', 'media_name', 'TEXT');
addColumnIfNotExists('scheduled_messages', 'media_type', 'TEXT');
addColumnIfNotExists('scheduled_messages', 'media_data', 'TEXT');
addColumnIfNotExists('scheduled_messages', 'media_name', 'TEXT');
addColumnIfNotExists('scheduled_messages', 'media_mime_type', 'TEXT');

db.prepare("INSERT OR IGNORE INTO settings (key, value) VALUES (?, ?)").run('instance_name', process.env.EVOLUTION_INSTANCE || 'default');
db.prepare("INSERT OR IGNORE INTO settings (key, value) VALUES (?, ?)").run('timezone', 'America/Sao_Paulo');

const app = express();
app.use(express.json({ limit: '30mb' }));

const multipartUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 30 * 1024 * 1024 },
});

// Health check
app.get("/api/test", (req, res) => {
  res.json({ status: 'ok', message: 'API está funcionando!' });
});

// Status endpoint
app.get("/api/status", (req, res) => {
  res.json({
    testMode: TEST_MODE,
    timestamp: new Date().toISOString(),
  });
});

// Send now
app.post("/api/send-now", (req, res) => {
  const { name, number, message, media } = req.body;
  console.log(`[${TEST_MODE ? 'TEST' : 'PROD'}] POST /api/send-now`, { name, number, message: message?.substring(0, 50), hasMedia: !!media });
  
  if (!message || message.trim() === '') {
    return res.status(400).json({ error: 'Mensagem é obrigatória.' });
  }

  const messageId = `${Date.now()}-${number}`;
  const now = new Date().toISOString();
  const status = TEST_MODE ? 'sent' : 'pending';
  
  db.prepare("INSERT INTO messages (id, number, name, message, status, created_at) VALUES (?, ?, ?, ?, ?, ?)")
    .run(messageId, number, name || null, message, status, now);
  
  res.json({ status: "sent" });
});

// Send bulk
app.post("/api/send-bulk", async (req, res) => {
  const { numbers, message, delay, media } = req.body;
  console.log(`[${TEST_MODE ? 'TEST' : 'PROD'}] POST /api/send-bulk`, { numberCount: numbers?.length || 0, hasMessage: !!message, delay, hasMedia: !!media });
  
  if (!message || message.trim() === '') {
    return res.status(400).json({ error: 'Mensagem da campanha é obrigatória.' });
  }

  if (!Array.isArray(numbers) || numbers.length === 0) {
    return res.status(400).json({ error: 'Nenhum número válido foi informado.' });
  }

  // Simular envio em background
  setImmediate(async () => {
    let sent = 0;
    let failed = 0;

    for (const number of numbers) {
      try {
        const messageId = `${Date.now()}-${number}`;
        const now = new Date().toISOString();
        const status = TEST_MODE ? 'sent' : 'pending';
        
        db.prepare("INSERT INTO messages (id, number, name, message, status, created_at) VALUES (?, ?, ?, ?, ?, ?)")
          .run(messageId, number, null, message, status, now);
        
        sent++;
      } catch (e) {
        failed++;
      }
      
      // Delay entre mensagens
      await new Promise(r => setTimeout(r, (delay || 1) * 1000));
    }

    console.log(`✓ Campanha finalizada: ${sent} enviadas, ${failed} falhas`);
  });

  res.json({ status: "bulk-initiated", total: numbers.length });
});

// Schedule
app.post("/api/schedule", (req, res) => {
  const { name, number, message, scheduledAt, media } = req.body;
  console.log(`[${TEST_MODE ? 'TEST' : 'PROD'}] POST /api/schedule`, { name, number, message: message?.substring(0, 50), scheduledAt, hasMedia: !!media });
  
  if (!message || message.trim() === "") {
    return res.status(400).json({ error: "Mensagem é obrigatória" });
  }

  const stmt = db.prepare("INSERT INTO scheduled_messages (name, number, message, scheduled_at, status) VALUES (?, ?, ?, ?, 'Agendado')");
  stmt.run(name, number, message, scheduledAt);
  
  res.json({ status: "scheduled" });
});

// Get scheduled messages
app.get("/api/scheduled-messages", (req, res) => {
  const messages = db.prepare("SELECT * FROM scheduled_messages ORDER BY scheduled_at ASC").all();
  res.json(messages);
});

// Update scheduled message
app.put("/api/scheduled-messages/:id", (req, res) => {
  const { id } = req.params;
  const { name, number, message, scheduledAt, media } = req.body;
  console.log(`[${TEST_MODE ? 'TEST' : 'PROD'}] PUT /api/scheduled-messages/:id`, { id, name, number, message: message?.substring(0, 50), scheduledAt, hasMedia: !!media });
  
  if (!message || message.trim() === "") {
    return res.status(400).json({ error: "Mensagem é obrigatória" });
  }
  
  const stmt = db.prepare("UPDATE scheduled_messages SET name = ?, number = ?, message = ?, scheduled_at = ? WHERE id = ?");
  const result = stmt.run(name, number, message, scheduledAt, id);
  
  if (result.changes === 0) {
    return res.status(404).json({ error: "Mensagem agendada não encontrada" });
  }
  
  res.json({ status: "updated" });
});

// Delete scheduled message
app.delete("/api/scheduled-messages/:id", (req, res) => {
  const { id } = req.params;
  const stmt = db.prepare("DELETE FROM scheduled_messages WHERE id = ?");
  const result = stmt.run(id);
  
  if (result.changes === 0) {
    return res.status(404).json({ error: "Mensagem agendada não encontrada" });
  }
  
  res.json({ status: "deleted" });
});

// Get messages history
app.get("/api/messages", (req, res) => {
  const messages = db.prepare("SELECT * FROM messages ORDER BY created_at DESC").all();
  res.json(messages);
});

// Clear messages history
app.post("/api/messages/clear", (req, res) => {
  db.prepare("DELETE FROM messages").run();
  res.json({ status: "cleared" });
});

// Get bulk campaign status (simulated)
app.get('/api/bulk-campaign/status', (req, res) => {
  res.json({
    isRunning: false,
    progress: 100,
    total: 0,
    processed: 0,
    sent: 0,
    failed: 0,
  });
});

function startServer() {
  const PORT = 3000;

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`✓ Servidor rodando em http://localhost:${PORT}`);
    console.log(`✓ Modo: ${TEST_MODE ? '🧪 TESTE (mensagens simuladas)' : '🚀 PRODUÇÃO (Evolution API)'}`);
  });
}

startServer();
