import 'dotenv/config';
import express from "express";
import { createServer as createViteServer } from "vite";
import axios from "axios";
import cron from "node-cron";
import Database from "better-sqlite3";
import path from "path";
import { fileURLToPath } from "url";
import { existsSync } from "fs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const db = new Database("messages.db");

const addColumnIfNotExists = (tableName: string, columnName: string, definition: string) => {
  const existingColumns = db.prepare(`PRAGMA table_info(${tableName})`).all() as Array<{ name: string }>;
  const hasColumn = existingColumns.some((column) => column.name === columnName);

  if (!hasColumn) {
    db.prepare(`ALTER TABLE ${tableName} ADD COLUMN ${columnName} ${definition}`).run();
  }
};

// Criar tabelas
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
  
  // Verificar se as tabelas existem
  const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table'").all();
  console.log('Tabelas disponíveis:', tables.map((t: any) => t.name).join(', '));
  
  // Criar usuário admin padrão caso não existam usuários
  const userCount = db.prepare("SELECT COUNT(*) as count FROM users").get() as any;
  if (userCount.count === 0) {
    console.log('Criando usuário admin padrão...');
    db.prepare("INSERT INTO users (username, email, password, role) VALUES (?, ?, ?, ?)").run(
      'admin',
      'admin@admin.com',
      'admin123',
      'admin'
    );
    console.log('✓ Usuário admin padrão criado (email: admin@admin.com, senha: admin123)');
  }
  
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
db.prepare("UPDATE scheduled_messages SET status = 'Agendado' WHERE status IS NULL OR TRIM(status) = ''").run();

const app = express();
app.use(express.json({ limit: '30mb' }));

// Log de todas as requisições
app.use((req, res, next) => {
  console.log(`${req.method} ${req.path}`);
  next();
});

// Endpoint de teste
app.get("/api/test", (req, res) => {
  console.log('GET /api/test - Endpoint de teste chamado');
  res.json({ status: 'ok', message: 'API está funcionando!' });
});

// Servir página de redefinição de senha
app.get("/reset-password", (req, res) => {
  res.sendFile(path.join(__dirname, "reset-password.html"));
});

const EVOLUTION_API_URL = process.env.EVOLUTION_API_URL;
const EVOLUTION_API_KEY = process.env.EVOLUTION_API_KEY;
const EVOLUTION_INSTANCE = process.env.EVOLUTION_INSTANCE;
const APP_PERMISSION_IDS = [
  'send-now',
  'contacts',
  'bulk-send',
  'schedule',
  'view-history',
  'clear-history',
  'manage-users',
  'manage-roles',
  'system-settings',
];

type MediaType = 'image' | 'document' | 'video';

type MediaPayload = {
  type: MediaType;
  data: string;
  fileName?: string;
  mimeType?: string;
};

type BulkCampaignStatus = {
  isRunning: boolean;
  stopRequested: boolean;
  total: number;
  processed: number;
  sent: number;
  failed: number;
  startedAt: string | null;
  endedAt: string | null;
  messagePreview: string;
};

const bulkCampaignStatus: BulkCampaignStatus = {
  isRunning: false,
  stopRequested: false,
  total: 0,
  processed: 0,
  sent: 0,
  failed: 0,
  startedAt: null,
  endedAt: null,
  messagePreview: '',
};

const resetBulkCampaignCounters = () => {
  bulkCampaignStatus.total = 0;
  bulkCampaignStatus.processed = 0;
  bulkCampaignStatus.sent = 0;
  bulkCampaignStatus.failed = 0;
};

const waitWithStopCheck = async (ms: number) => {
  const step = 250;
  let elapsed = 0;

  while (elapsed < ms) {
    if (bulkCampaignStatus.stopRequested) {
      return false;
    }

    const sleepTime = Math.min(step, ms - elapsed);
    await new Promise(resolve => setTimeout(resolve, sleepTime));
    elapsed += sleepTime;
  }

  return true;
};

const mediaTypeToEndpoint: Record<MediaType, string> = {
  image: 'sendImage',
  document: 'sendDocument',
  video: 'sendVideo',
};

const normalizeMediaPayload = (media: any): MediaPayload | null => {
  if (!media || typeof media !== 'object') return null;

  const type = typeof media.type === 'string' ? media.type.trim().toLowerCase() : '';
  const incomingData = typeof media.data === 'string' ? media.data.trim() : '';

  if (!['image', 'document', 'video'].includes(type) || !incomingData) {
    return null;
  }

  const dataUrlMatch = incomingData.match(/^data:([^;]+);base64,(.+)$/i);
  const normalizedData = dataUrlMatch ? dataUrlMatch[2] : incomingData;
  const normalizedMimeType =
    (typeof media.mimeType === 'string' ? media.mimeType.trim() : '') ||
    (dataUrlMatch ? dataUrlMatch[1] : '');

  return {
    type: type as MediaType,
    data: normalizedData,
    fileName: typeof media.fileName === 'string' ? media.fileName.trim() || undefined : undefined,
    mimeType: normalizedMimeType || undefined,
  };
};

const sendMediaMessage = async (
  instanceName: string,
  number: string,
  message: string,
  media: MediaPayload,
) => {
  const caption = message && message.trim() ? message : '.';
  const mimeType = media.mimeType || 'application/octet-stream';
  const extensionFromMime = mimeType.includes('/') ? mimeType.split('/')[1].split(';')[0] : 'bin';
  const safeFileName = (media.fileName && media.fileName.trim()) || `${media.type}.${extensionFromMime}`;
  const mediaAsDataUrl = `data:${mimeType};base64,${media.data}`;

  const typeSpecificBodyRaw =
    media.type === 'image'
      ? {
          number,
          image: media.data,
          caption,
          fileName: media.fileName,
          mimetype: mimeType,
        }
      : media.type === 'video'
        ? {
            number,
            video: media.data,
            caption,
            fileName: media.fileName,
            mimetype: mimeType,
          }
        : {
            number,
            document: media.data,
            caption,
            fileName: media.fileName || 'documento',
            mimetype: mimeType,
          };

  const typeSpecificBodyDataUrl =
    media.type === 'image'
      ? {
          number,
          image: mediaAsDataUrl,
          caption,
          fileName: media.fileName,
          mimetype: mimeType,
        }
      : media.type === 'video'
        ? {
            number,
            video: mediaAsDataUrl,
            caption,
            fileName: media.fileName,
            mimetype: mimeType,
          }
        : {
            number,
            document: mediaAsDataUrl,
            caption,
            fileName: media.fileName || 'documento',
            mimetype: mimeType,
          };

  const attempts = [
    {
      endpoint: `${EVOLUTION_API_URL}/message/sendMedia/${instanceName}`,
      payload: {
        number,
        mediatype: media.type,
        media: media.data,
        caption,
        fileName: safeFileName,
        mimetype: mimeType,
      },
    },
    {
      endpoint: `${EVOLUTION_API_URL}/message/sendMedia/${instanceName}`,
      payload: {
        number,
        mediatype: media.type,
        media: mediaAsDataUrl,
        caption,
        fileName: safeFileName,
        mimetype: mimeType,
      },
    },
    {
      endpoint: `${EVOLUTION_API_URL}/message/sendMedia/${instanceName}`,
      payload: {
        ...typeSpecificBodyRaw,
        fileName: safeFileName,
      },
    },
    {
      endpoint: `${EVOLUTION_API_URL}/message/sendMedia/${instanceName}`,
      payload: {
        ...typeSpecificBodyDataUrl,
        fileName: safeFileName,
      },
    },
  ];

  let lastError: any = null;

  for (const attempt of attempts) {
    try {
      const response = await axios.post(attempt.endpoint, attempt.payload, {
        headers: {
          apikey: EVOLUTION_API_KEY,
          "Content-Type": "application/json",
        },
      });
      return response;
    } catch (error: any) {
      lastError = error;
      const detailedError = {
        status: error.response?.status,
        data: error.response?.data,
        payloadValidation: {
          mediatype: media.type,
          mimetype: mimeType,
          hasCaption: Boolean(caption),
          hasFileName: Boolean(safeFileName),
          mediaLength: media.data?.length || 0,
        },
        message: error.message,
      };
      console.warn('Falha em tentativa de envio de mídia:', {
        endpoint: attempt.endpoint,
        error: JSON.parse(JSON.stringify(detailedError)),
      });
    }
  }

  throw lastError;
};

async function sendWhatsAppMessage(number: string, message: string, name?: string, media?: MediaPayload | null) {
  const instanceName = db.prepare("SELECT value FROM settings WHERE key = 'instance_name'").get().value;
  console.log(`Enviando mensagem para ${number}: "${message}"`);
  const actualNumber = (number.includes(';') ? number.split(';')[1] : number).replace(/[^0-9]/g, '');
  const actualName = name || (number.includes(';') ? number.split(';')[0] : undefined);
  const payload = media
    ? {
        number: actualNumber,
        mediaType: media.type,
        hasMedia: true,
        text: message,
      }
    : {
        number: actualNumber,
        text: message,
      };
  try {
    console.log(`Enviando payload para ${instanceName}:`, payload);
    const response = media
      ? await sendMediaMessage(instanceName, actualNumber, message, media)
      : await axios.post(
          `${EVOLUTION_API_URL}/message/sendText/${instanceName}`,
          { number: actualNumber, text: message },
          {
            headers: {
              apikey: EVOLUTION_API_KEY,
              "Content-Type": "application/json",
            },
          }
        );
    const messageId = response.data?.key?.id || response.data?.key?.remoteJid || `${Date.now()}-${actualNumber}`;
    const now = new Date().toISOString();
    db.prepare("INSERT INTO messages (id, number, name, message, status, created_at, media_type, media_name) VALUES (?, ?, ?, ?, ?, ?, ?, ?)")
      .run(
        messageId,
        actualNumber,
        actualName || null,
        message,
        'sent',
        now,
        media?.type || null,
        media?.fileName || null,
      );
    console.log(`Mensagem enviada para ${actualNumber}, ID: ${messageId}`);
  } catch (error: any) {
    console.error(`Falha ao enviar mensagem para ${actualNumber}. Payload:`, JSON.stringify(payload));
    console.error(`Resposta de erro:`, JSON.stringify(error.response?.data || error.message));
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

app.get('/api/contacts', (req, res) => {
  try {
    const contacts = db.prepare('SELECT * FROM contacts ORDER BY name COLLATE NOCASE ASC, created_at DESC').all();
    return res.json(contacts);
  } catch (error: any) {
    console.error('Erro ao buscar contatos:', error.message);
    return res.status(500).json({ error: error.message });
  }
});

app.post('/api/contacts', (req, res) => {
  try {
    const { name, number } = req.body;
    const normalizedNumber = String(number || '').replace(/[^0-9]/g, '');

    if (!normalizedNumber) {
      return res.status(400).json({ error: 'Número é obrigatório' });
    }

    const stmt = db.prepare('INSERT INTO contacts (name, number) VALUES (?, ?)');
    const result = stmt.run((name || '').trim() || null, normalizedNumber);
    return res.status(201).json({ status: 'created', id: result.lastInsertRowid });
  } catch (error: any) {
    console.error('Erro ao criar contato:', error.message);
    if (error.message?.includes('UNIQUE constraint failed: contacts.number')) {
      return res.status(409).json({ error: 'Este número já está cadastrado' });
    }
    return res.status(400).json({ error: error.message });
  }
});

app.put('/api/contacts/:id', (req, res) => {
  try {
    const { id } = req.params;
    const { name, number } = req.body;
    const normalizedNumber = String(number || '').replace(/[^0-9]/g, '');

    if (!normalizedNumber) {
      return res.status(400).json({ error: 'Número é obrigatório' });
    }

    const stmt = db.prepare('UPDATE contacts SET name = ?, number = ? WHERE id = ?');
    const result = stmt.run((name || '').trim() || null, normalizedNumber, id);

    if (result.changes === 0) {
      return res.status(404).json({ error: 'Contato não encontrado' });
    }

    return res.json({ status: 'updated' });
  } catch (error: any) {
    console.error('Erro ao atualizar contato:', error.message);
    if (error.message?.includes('UNIQUE constraint failed: contacts.number')) {
      return res.status(409).json({ error: 'Este número já está cadastrado' });
    }
    return res.status(400).json({ error: error.message });
  }
});

app.delete('/api/contacts/:id', (req, res) => {
  try {
    const { id } = req.params;
    const stmt = db.prepare('DELETE FROM contacts WHERE id = ?');
    const result = stmt.run(id);

    if (result.changes === 0) {
      return res.status(404).json({ error: 'Contato não encontrado' });
    }

    return res.json({ status: 'deleted' });
  } catch (error: any) {
    console.error('Erro ao excluir contato:', error.message);
    return res.status(400).json({ error: error.message });
  }
});

app.post("/api/send-now", async (req, res) => {
  const { name, number, message, media } = req.body;
  const normalizedMedia = normalizeMediaPayload(media);

  if ((!message || String(message).trim() === '') && !normalizedMedia) {
    return res.status(400).json({ error: 'Mensagem ou mídia é obrigatória.' });
  }

  const success = await sendWhatsAppMessage(number, message || '', name, normalizedMedia);
  if (!success) {
    return res.status(502).json({ status: 'failed', error: 'Falha ao enviar mensagem.' });
  }

  res.json({ status: "sent" });
});

app.post("/api/send-bulk", async (req, res) => {
  const { numbers, message, delay, media } = req.body;
  const parsedNumbers = Array.isArray(numbers) ? numbers.filter((number) => typeof number === 'string' && number.trim() !== '') : [];
  const parsedDelay = Math.max(1, Number(delay) || 1);
  const normalizedMedia = normalizeMediaPayload(media);

  if (bulkCampaignStatus.isRunning) {
    return res.status(409).json({ error: 'Já existe uma campanha em andamento.' });
  }

  if ((!message || typeof message !== 'string' || message.trim() === '') && !normalizedMedia) {
    return res.status(400).json({ error: 'Mensagem ou mídia da campanha é obrigatória.' });
  }

  if (parsedNumbers.length === 0) {
    return res.status(400).json({ error: 'Nenhum número válido foi informado.' });
  }

  bulkCampaignStatus.isRunning = true;
  bulkCampaignStatus.stopRequested = false;
  bulkCampaignStatus.startedAt = new Date().toISOString();
  bulkCampaignStatus.endedAt = null;
  bulkCampaignStatus.messagePreview = normalizedMedia ? `[${normalizedMedia.type}] ${String(message || '').slice(0, 100)}` : message.slice(0, 120);
  resetBulkCampaignCounters();
  bulkCampaignStatus.total = parsedNumbers.length;

  console.log(`Campanha em massa iniciada. Total: ${parsedNumbers.length}, Intervalo: ${parsedDelay}s`);

  (async () => {
    try {
      for (let i = 0; i < parsedNumbers.length; i++) {
        if (bulkCampaignStatus.stopRequested) {
          console.log('Parada da campanha em massa solicitada. Finalizando loop.');
          break;
        }

        const number = parsedNumbers[i];
        console.log(`Enviando mensagem em massa para ${number}`);

        if (i > 0) {
          const canContinue = await waitWithStopCheck(parsedDelay * 1000);
          if (!canContinue) {
            console.log('Campanha em massa interrompida durante o intervalo de espera.');
            break;
          }
        }

        const success = await sendWhatsAppMessage(number, message || '', undefined, normalizedMedia);

        bulkCampaignStatus.processed += 1;
        if (success) {
          bulkCampaignStatus.sent += 1;
        } else {
          bulkCampaignStatus.failed += 1;
        }
      }
    } catch (error: any) {
      console.error('Erro inesperado durante a campanha em massa:', error?.message || error);
    } finally {
      bulkCampaignStatus.isRunning = false;
      bulkCampaignStatus.endedAt = new Date().toISOString();
      bulkCampaignStatus.stopRequested = false;
      console.log(`Campanha em massa finalizada. Processadas: ${bulkCampaignStatus.processed}/${bulkCampaignStatus.total}, Enviadas: ${bulkCampaignStatus.sent}, Falhas: ${bulkCampaignStatus.failed}`);
    }
  })();

  res.json({ status: "bulk-initiated", total: parsedNumbers.length, delay: parsedDelay });
});

app.get('/api/bulk-campaign/status', (req, res) => {
  const progress = bulkCampaignStatus.total > 0
    ? Math.round((bulkCampaignStatus.processed / bulkCampaignStatus.total) * 100)
    : 0;

  res.json({
    ...bulkCampaignStatus,
    progress,
  });
});

app.post('/api/bulk-campaign/stop', (req, res) => {
  if (!bulkCampaignStatus.isRunning) {
    return res.status(409).json({ error: 'Não há campanha em andamento para parar.' });
  }

  bulkCampaignStatus.stopRequested = true;
  return res.json({ status: 'stop-requested' });
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
  const { name, number, message, scheduledAt, media } = req.body;
  const normalizedMedia = normalizeMediaPayload(media);
  console.log(`Agendando mensagem. Nome: ${name}, Número: ${number}, Mensagem: ${message}, AgendadoPara: ${scheduledAt}`);
  if ((!message || message.trim() === "") && !normalizedMedia) {
    console.error("Tentativa de agendar mensagem sem texto e sem mídia");
    return res.status(400).json({ error: "Mensagem ou mídia é obrigatória" });
  }
  const stmt = db.prepare("INSERT INTO scheduled_messages (name, number, message, media_type, media_data, media_name, media_mime_type, scheduled_at, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'Agendado')");
  stmt.run(name, number, message || '', normalizedMedia?.type || null, normalizedMedia?.data || null, normalizedMedia?.fileName || null, normalizedMedia?.mimeType || null, scheduledAt);
  res.json({ status: "scheduled" });
});

app.get("/api/scheduled-messages", (req, res) => {
  const messages = db.prepare("SELECT * FROM scheduled_messages").all();
  res.json(messages);
});

app.put("/api/scheduled-messages/:id", (req, res) => {
  const { id } = req.params;
  const { name, number, message, scheduledAt, media } = req.body;
  const normalizedMedia = normalizeMediaPayload(media);
  console.log(`Atualizando mensagem agendada ${id}. Nome: ${name}, Número: ${number}, Mensagem: ${message}, AgendadoPara: ${scheduledAt}`);
  
  if ((!message || message.trim() === "") && !normalizedMedia) {
    console.error("Tentativa de atualizar mensagem sem texto e sem mídia");
    return res.status(400).json({ error: "Mensagem ou mídia é obrigatória" });
  }
  
  const stmt = db.prepare("UPDATE scheduled_messages SET name = ?, number = ?, message = ?, media_type = ?, media_data = ?, media_name = ?, media_mime_type = ?, scheduled_at = ? WHERE id = ?");
  const result = stmt.run(name, number, message || '', normalizedMedia?.type || null, normalizedMedia?.data || null, normalizedMedia?.fileName || null, normalizedMedia?.mimeType || null, scheduledAt, id);
  
  if (result.changes === 0) {
    return res.status(404).json({ error: "Mensagem agendada não encontrada" });
  }
  
  res.json({ status: "updated" });
});

app.delete("/api/scheduled-messages/:id", (req, res) => {
  const { id } = req.params;
  console.log(`Excluindo mensagem agendada ${id}`);
  
  const stmt = db.prepare("DELETE FROM scheduled_messages WHERE id = ?");
  const result = stmt.run(id);
  
  if (result.changes === 0) {
    return res.status(404).json({ error: "Mensagem agendada não encontrada" });
  }
  
  res.json({ status: "deleted" });
});

// Rota de autenticação
app.post("/api/login", (req, res) => {
  try {
    console.log('POST /api/login - Requisição recebida');
    const { email, password } = req.body;
    console.log('POST /api/login - Tentativa de login para o email:', email);
    
    if (!email || !password) {
      console.log('Login falhou: email ou senha ausentes');
      return res.status(400).json({ error: 'Email e senha são obrigatórios' });
    }
    
    // Verificar se a tabela de usuários existe
    const tableExists = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='users'").get();
    if (!tableExists) {
      console.error('ERRO: tabela users não existe!');
      return res.status(500).json({ error: 'Tabela de usuários não existe. Reinicie o servidor.' });
    }
    
    // Buscar usuário por email
    console.log('Buscando usuário com email:', email);
    const user = db.prepare("SELECT * FROM users WHERE email = ?").get(email) as any;
    console.log('Usuário encontrado:', user ? 'Sim' : 'Não');
    
    if (!user) {
      console.log('Login falhou: usuário não encontrado para o email:', email);
      // Listar todos os usuários para depuração
      const allUsers = db.prepare("SELECT email FROM users").all();
      console.log('Usuários disponíveis:', allUsers);
      return res.status(401).json({ error: 'Email ou senha inválidos' });
    }
    
    console.log('Verificando senha do usuário:', user.username);
    // Verificar senha (em produção, usar bcrypt.compare)
    if (user.password !== password) {
      console.log('Login falhou: senha inválida para o usuário:', user.username);
      return res.status(401).json({ error: 'Email ou senha inválidos' });
    }
    
    console.log('Login realizado com sucesso para o usuário:', user.username);

    const rolePermissions = db
      .prepare("SELECT permissions FROM roles WHERE name = ?")
      .get(user.role) as { permissions?: string } | undefined;

    const effectivePermissions =
      user.role === 'admin'
        ? APP_PERMISSION_IDS.join(',')
        : (rolePermissions?.permissions || '');
    
    // Retornar dados do usuário sem senha
    const { password: _, ...userWithoutPassword } = user;
    return res.json({ 
      success: true,
      user: {
        ...userWithoutPassword,
        permissions: effectivePermissions,
      }
    });
  } catch (error: any) {
    console.error('Erro durante o login:', error);
    console.error('Stack do erro:', error.stack);
    return res.status(500).json({ error: `Erro ao fazer login: ${error.message}` });
  }
});

// Endpoint de diagnóstico
app.get("/api/system/check", (req, res) => {
  console.log('GET /api/system/check - Endpoint chamado');
  try {
    const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table'").all();
    const userCount = db.prepare("SELECT COUNT(*) as count FROM users").get() as any;
    const users = db.prepare("SELECT id, username, email, role FROM users").all();
    
    const response = {
      status: 'ok',
      tables: tables,
      userCount: userCount.count,
      users: users
    };
    
    console.log('Resultado da verificação do sistema:', JSON.stringify(response, null, 2));
    return res.json(response);
  } catch (error: any) {
    console.error('Erro na verificação do sistema:', error);
    return res.status(500).json({ error: error.message });
  }
});

// Endpoint para criar usuário admin
app.post("/api/system/create-admin", (req, res) => {
  try {
    // Verificar se admin já existe
    const existingAdmin = db.prepare("SELECT * FROM users WHERE email = ?").get('admin@admin.com');
    if (existingAdmin) {
      return res.json({ message: 'Usuário admin já existe', user: existingAdmin });
    }
    
    // Criar usuário admin
    db.prepare("INSERT INTO users (username, email, password, role) VALUES (?, ?, ?, ?)").run(
      'admin',
      'admin@admin.com',
      'admin123',
      'admin'
    );
    
    const newAdmin = db.prepare("SELECT id, username, email, role FROM users WHERE email = ?").get('admin@admin.com');
    return res.json({ message: 'Usuário admin criado com sucesso', user: newAdmin });
  } catch (error: any) {
    console.error('Erro ao criar admin:', error);
    return res.status(500).json({ error: error.message });
  }
});

// Endpoint para redefinir senha
app.post("/api/system/reset-password", (req, res) => {
  console.log('POST /api/system/reset-password - Endpoint chamado');
  console.log('Corpo da requisição:', req.body);
  try {
    const { email, newPassword } = req.body;
    
    if (!email || !newPassword) {
      console.log('Email ou senha ausentes');
      return res.status(400).json({ error: 'Email e nova senha são obrigatórios' });
    }
    
    // Verificar se o usuário existe
    const user = db.prepare("SELECT * FROM users WHERE email = ?").get(email);
    if (!user) {
      console.log('Usuário não encontrado:', email);
      return res.status(404).json({ error: 'Usuário não encontrado' });
    }
    
    // Atualizar senha
    db.prepare("UPDATE users SET password = ? WHERE email = ?").run(newPassword, email);
    console.log('Senha atualizada com sucesso para:', email);
    
    return res.json({ 
      message: 'Senha atualizada com sucesso',
      email: email
    });
  } catch (error: any) {
    console.error('Erro ao redefinir senha:', error);
    return res.status(500).json({ error: error.message });
  }
});

// Rotas de usuários
app.get("/api/users", (req, res) => {
  try {
    console.log('GET /api/users - Buscando usuários');
    const users = db.prepare("SELECT id, username, email, role, created_at FROM users").all();
    console.log('Usuários encontrados:', users.length);
    return res.json(users);
  } catch (error: any) {
    console.error('Erro ao buscar usuários:', error.message);
    return res.status(500).json({ error: error.message });
  }
});

app.post("/api/users", (req, res) => {
  try {
    const { username, email, password, role } = req.body;
    console.log('POST /api/users - Criando usuário:', { username, email, role });
    
    if (!username || !email || !password) {
      console.log('Validação falhou: campos obrigatórios ausentes');
      return res.status(400).json({ error: 'Campos obrigatórios faltando' });
    }
    
    // Verificar se a tabela existe
    const tableExists = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='users'").get();
    if (!tableExists) {
      console.error('ERRO: tabela users não existe!');
      return res.status(500).json({ error: 'Tabela users não existe. Reinicie o servidor.' });
    }
    
    const stmt = db.prepare("INSERT INTO users (username, email, password, role) VALUES (?, ?, ?, ?)");
    const result = stmt.run(username, email, password, role || 'user');
    console.log('Usuário criado com sucesso com ID:', result.lastInsertRowid);
    return res.status(200).json({ status: "created", id: result.lastInsertRowid });
  } catch (error: any) {
    console.error('Erro ao criar usuário:', error.message);
    return res.status(400).json({ error: error.message });
  }
});

app.put("/api/users/:id", (req, res) => {
  try {
    const { id } = req.params;
    const { username, email, password, role } = req.body;
    console.log('PUT /api/users/:id - Atualizando usuário:', { id, username, email, role, hasPassword: !!password });
    console.log('Corpo da requisição:', req.body);
    
    if (!username || !email) {
      console.log('Validação falhou: campos obrigatórios ausentes');
      return res.status(400).json({ error: 'Nome de usuário e email são obrigatórios' });
    }
    
    // Verificar se o usuário existe
    const existingUser = db.prepare("SELECT * FROM users WHERE id = ?").get(id);
    if (!existingUser) {
      console.log('Usuário não encontrado:', id);
      return res.status(404).json({ error: 'Usuário não encontrado' });
    }
    
    console.log('Usuário existente encontrado:', { id: existingUser.id, username: existingUser.username, email: existingUser.email });
    
    // Atualizar usuário (atualiza senha somente se enviada)
    if (password && password.trim() !== '') {
      console.log('Atualizando com nova senha');
      db.prepare("UPDATE users SET username = ?, email = ?, password = ?, role = ? WHERE id = ?")
        .run(username, email, password, role || 'user', id);
    } else {
      console.log('Atualizando sem alterar senha');
      db.prepare("UPDATE users SET username = ?, email = ?, role = ? WHERE id = ?")
        .run(username, email, role || 'user', id);
    }
    
    console.log('Usuário atualizado com sucesso:', id);
    
    // Retornar dados atualizados do usuário
    const updatedUser = db.prepare("SELECT id, username, email, role, created_at FROM users WHERE id = ?").get(id);
    console.log('Dados atualizados do usuário:', updatedUser);
    
    return res.json({ status: "updated", user: updatedUser });
  } catch (error: any) {
    console.error('Erro ao atualizar usuário:', error.message);
    console.error('Stack:', error.stack);
    return res.status(400).json({ error: error.message });
  }
});

app.delete("/api/users/:id", (req, res) => {
  try {
    const { id } = req.params;
    db.prepare("DELETE FROM users WHERE id = ?").run(id);
    return res.json({ status: "deleted" });
  } catch (error: any) {
    console.error('Erro ao excluir usuário:', error.message);
    return res.status(400).json({ error: error.message });
  }
});

// Rotas de grupos
app.get("/api/roles", (req, res) => {
  try {
    console.log('GET /api/roles - Buscando grupos');
    const roles = db.prepare("SELECT * FROM roles").all();
    console.log('Grupos encontrados:', roles.length);
    return res.json(roles);
  } catch (error: any) {
    console.error('Erro ao buscar grupos:', error.message);
    return res.status(500).json({ error: error.message });
  }
});

app.post("/api/roles", (req, res) => {
  try {
    const { name, description, permissions } = req.body;
    console.log('POST /api/roles - Criando grupo:', { name, description, permissions });
    
    if (!name) {
      console.log('Validação falhou: nome é obrigatório');
      return res.status(400).json({ error: 'Nome do grupo é obrigatório' });
    }
    
    // Verificar se a tabela existe
    const tableExists = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='roles'").get();
    if (!tableExists) {
      console.error('ERRO: tabela roles não existe!');
      return res.status(500).json({ error: 'Tabela roles não existe. Reinicie o servidor.' });
    }
    
    const stmt = db.prepare("INSERT INTO roles (name, description, permissions) VALUES (?, ?, ?)");
    const result = stmt.run(name, description || '', permissions || '');
    console.log('Grupo criado com sucesso com ID:', result.lastInsertRowid);
    return res.status(200).json({ status: "created", id: result.lastInsertRowid });
  } catch (error: any) {
    console.error('Erro ao criar grupo:', error.message);
    return res.status(400).json({ error: error.message });
  }
});

app.put("/api/roles/:id", (req, res) => {
  try {
    const { id } = req.params;
    const { name, description, permissions } = req.body;
    console.log('PUT /api/roles/:id - Atualizando grupo:', { id, name, description, permissions });
    
    if (!name) {
      console.log('Validação falhou: nome é obrigatório');
      return res.status(400).json({ error: 'Nome do grupo é obrigatório' });
    }
    
    // Verificar se o grupo existe
    const existingRole = db.prepare("SELECT * FROM roles WHERE id = ?").get(id);
    if (!existingRole) {
      return res.status(404).json({ error: 'Grupo não encontrado' });
    }
    
    // Atualizar grupo
    db.prepare("UPDATE roles SET name = ?, description = ?, permissions = ? WHERE id = ?")
      .run(name, description || '', permissions || '', id);
    
    console.log('Grupo atualizado com sucesso:', id);
    return res.json({ status: "updated" });
  } catch (error: any) {
    console.error('Erro ao atualizar grupo:', error.message);
    return res.status(400).json({ error: error.message });
  }
});

app.delete("/api/roles/:id", (req, res) => {
  try {
    const { id } = req.params;
    db.prepare("DELETE FROM roles WHERE id = ?").run(id);
    return res.json({ status: "deleted" });
  } catch (error: any) {
    console.error('Erro ao excluir grupo:', error.message);
    return res.status(400).json({ error: error.message });
  }
});

// Tarefa cron para verificar mensagens agendadas
cron.schedule("* * * * *", async () => {
  const now = new Date().toISOString().slice(0, 16);
  const stmt = db.prepare("SELECT * FROM scheduled_messages WHERE scheduled_at <= ? AND status = 'Agendado'");
  const messages = stmt.all(now);
  console.log(`Verificando mensagens agendadas. Agora: ${now}, Encontradas: ${messages.length}`);
  
  for (const msg of messages) {
    const claim = db
      .prepare("UPDATE scheduled_messages SET status = 'Processando' WHERE id = ? AND status = 'Agendado'")
      .run(msg.id);

    if (claim.changes === 0) {
      continue;
    }

    const success = await sendWhatsAppMessage(
      msg.number,
      msg.message,
      msg.name,
      normalizeMediaPayload({
        type: msg.media_type,
        data: msg.media_data,
        fileName: msg.media_name,
        mimeType: msg.media_mime_type,
      })
    );
    if (success) {
      db.prepare("DELETE FROM scheduled_messages WHERE id = ?").run(msg.id);
    } else {
      db.prepare("UPDATE scheduled_messages SET status = 'Agendado' WHERE id = ?").run(msg.id);
    }

    await new Promise(resolve => setTimeout(resolve, 2000));
  }
});

// Middleware global de erro (deve ficar após todas as rotas)
app.use((err: any, req: any, res: any, next: any) => {
  console.error('Tratador global de erro:', err);
  if (!res.headersSent) {
    res.status(500).json({ error: err.message || 'Erro interno do servidor' });
  }
});

async function startServer() {
  const PORT = 3000;
  const distPath = path.join(__dirname, 'dist');
  const hasDistFolder = existsSync(distPath);
  const APP_RUNTIME_SIGNATURE = 'UATIZAPI_MEDIA_FIX_V3';

  // Servir dist apenas quando NODE_ENV=production (evita frontend desatualizado no dev)
  const isProduction = process.env.NODE_ENV === "production";

  if (!isProduction) {
    console.log('Iniciando em modo de desenvolvimento com Vite...');
    console.log('Pasta dist existe:', hasDistFolder);
    const vite = await createViteServer({
      server: {
        middlewareMode: true,
        allowedHosts: ['uatizapi.brazilianpremier.com.br'],
      },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    console.log('Iniciando em modo de produção...');
    // Servir arquivos estáticos da pasta dist em produção (exceto index.html)
    app.use(express.static(distPath, { index: false }));
    
    // Servir index.html para todas as rotas não-API (deve ficar após as rotas da API)
    app.get('*', (req, res) => {
      // Não servir index.html para rotas da API
      if (req.path.startsWith('/api/') || req.path === '/reset-password') {
        return res.status(404).json({ error: 'Não encontrado' });
      }
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Runtime: ${APP_RUNTIME_SIGNATURE}`);
    console.log(`Servidor rodando em http://localhost:${PORT}`);
    console.log(`Modo: ${isProduction ? 'produção' : 'desenvolvimento'}`);
    console.log(`NODE_ENV: ${process.env.NODE_ENV || 'não definido'}`);
  });
}

startServer();
