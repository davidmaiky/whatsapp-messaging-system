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
  
  // Create default admin user if no users exist
  const userCount = db.prepare("SELECT COUNT(*) as count FROM users").get() as any;
  if (userCount.count === 0) {
    console.log('Creating default admin user...');
    db.prepare("INSERT INTO users (username, email, password, role) VALUES (?, ?, ?, ?)").run(
      'admin',
      'admin@admin.com',
      'admin123',
      'admin'
    );
    console.log('✓ Default admin user created (email: admin@admin.com, password: admin123)');
  }
  
} catch (error) {
  console.error('Error creating database tables:', error);
  throw error;
}

db.prepare("INSERT OR IGNORE INTO settings (key, value) VALUES (?, ?)").run('instance_name', process.env.EVOLUTION_INSTANCE || 'default');
db.prepare("INSERT OR IGNORE INTO settings (key, value) VALUES (?, ?)").run('timezone', 'America/Sao_Paulo');

const app = express();
app.use(express.json());

// Log all requests
app.use((req, res, next) => {
  console.log(`${req.method} ${req.path}`);
  next();
});

// Test endpoint
app.get("/api/test", (req, res) => {
  console.log('GET /api/test - Test endpoint called');
  res.json({ status: 'ok', message: 'API is working!' });
});

// Serve reset password page
app.get("/reset-password", (req, res) => {
  res.sendFile(path.join(__dirname, "reset-password.html"));
});

const EVOLUTION_API_URL = process.env.EVOLUTION_API_URL;
const EVOLUTION_API_KEY = process.env.EVOLUTION_API_KEY;
const EVOLUTION_INSTANCE = process.env.EVOLUTION_INSTANCE;
const APP_PERMISSION_IDS = [
  'send-now',
  'bulk-send',
  'schedule',
  'view-history',
  'clear-history',
  'manage-users',
  'manage-roles',
  'system-settings',
];

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

app.put("/api/scheduled-messages/:id", (req, res) => {
  const { id } = req.params;
  const { name, number, message, scheduledAt } = req.body;
  console.log(`Updating scheduled message ${id}. Name: ${name}, Number: ${number}, Message: ${message}, ScheduledAt: ${scheduledAt}`);
  
  if (!message || message.trim() === "") {
    console.error("Attempted to update message with empty text");
    return res.status(400).json({ error: "Message is required" });
  }
  
  const stmt = db.prepare("UPDATE scheduled_messages SET name = ?, number = ?, message = ?, scheduled_at = ? WHERE id = ?");
  const result = stmt.run(name, number, message, scheduledAt, id);
  
  if (result.changes === 0) {
    return res.status(404).json({ error: "Scheduled message not found" });
  }
  
  res.json({ status: "updated" });
});

app.delete("/api/scheduled-messages/:id", (req, res) => {
  const { id } = req.params;
  console.log(`Deleting scheduled message ${id}`);
  
  const stmt = db.prepare("DELETE FROM scheduled_messages WHERE id = ?");
  const result = stmt.run(id);
  
  if (result.changes === 0) {
    return res.status(404).json({ error: "Scheduled message not found" });
  }
  
  res.json({ status: "deleted" });
});

// Authentication route
app.post("/api/login", (req, res) => {
  try {
    console.log('POST /api/login - Request received');
    const { email, password } = req.body;
    console.log('POST /api/login - Login attempt for email:', email);
    
    if (!email || !password) {
      console.log('Login failed: Missing email or password');
      return res.status(400).json({ error: 'Email e senha são obrigatórios' });
    }
    
    // Verify users table exists
    const tableExists = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='users'").get();
    if (!tableExists) {
      console.error('ERROR: users table does not exist!');
      return res.status(500).json({ error: 'Tabela de usuários não existe. Reinicie o servidor.' });
    }
    
    // Find user by email
    console.log('Searching for user with email:', email);
    const user = db.prepare("SELECT * FROM users WHERE email = ?").get(email) as any;
    console.log('User found:', user ? 'Yes' : 'No');
    
    if (!user) {
      console.log('Login failed: User not found for email:', email);
      // List all users for debugging
      const allUsers = db.prepare("SELECT email FROM users").all();
      console.log('Available users:', allUsers);
      return res.status(401).json({ error: 'Email ou senha inválidos' });
    }
    
    console.log('Checking password for user:', user.username);
    // Check password (in production, use bcrypt.compare)
    if (user.password !== password) {
      console.log('Login failed: Invalid password for user:', user.username);
      return res.status(401).json({ error: 'Email ou senha inválidos' });
    }
    
    console.log('Login successful for user:', user.username);

    const rolePermissions = db
      .prepare("SELECT permissions FROM roles WHERE name = ?")
      .get(user.role) as { permissions?: string } | undefined;

    const effectivePermissions =
      user.role === 'admin'
        ? APP_PERMISSION_IDS.join(',')
        : (rolePermissions?.permissions || '');
    
    // Return user data without password
    const { password: _, ...userWithoutPassword } = user;
    return res.json({ 
      success: true,
      user: {
        ...userWithoutPassword,
        permissions: effectivePermissions,
      }
    });
  } catch (error: any) {
    console.error('Error during login:', error);
    console.error('Error stack:', error.stack);
    return res.status(500).json({ error: `Erro ao fazer login: ${error.message}` });
  }
});

// Diagnostic endpoint
app.get("/api/system/check", (req, res) => {
  console.log('GET /api/system/check - Endpoint called');
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
    
    console.log('System check result:', JSON.stringify(response, null, 2));
    return res.json(response);
  } catch (error: any) {
    console.error('Error in system check:', error);
    return res.status(500).json({ error: error.message });
  }
});

// Create admin user endpoint
app.post("/api/system/create-admin", (req, res) => {
  try {
    // Check if admin already exists
    const existingAdmin = db.prepare("SELECT * FROM users WHERE email = ?").get('admin@admin.com');
    if (existingAdmin) {
      return res.json({ message: 'Admin user already exists', user: existingAdmin });
    }
    
    // Create admin user
    db.prepare("INSERT INTO users (username, email, password, role) VALUES (?, ?, ?, ?)").run(
      'admin',
      'admin@admin.com',
      'admin123',
      'admin'
    );
    
    const newAdmin = db.prepare("SELECT id, username, email, role FROM users WHERE email = ?").get('admin@admin.com');
    return res.json({ message: 'Admin user created successfully', user: newAdmin });
  } catch (error: any) {
    console.error('Error creating admin:', error);
    return res.status(500).json({ error: error.message });
  }
});

// Reset admin password endpoint
app.post("/api/system/reset-password", (req, res) => {
  console.log('POST /api/system/reset-password - Endpoint called');
  console.log('Request body:', req.body);
  try {
    const { email, newPassword } = req.body;
    
    if (!email || !newPassword) {
      console.log('Missing email or password');
      return res.status(400).json({ error: 'Email e nova senha são obrigatórios' });
    }
    
    // Check if user exists
    const user = db.prepare("SELECT * FROM users WHERE email = ?").get(email);
    if (!user) {
      console.log('User not found:', email);
      return res.status(404).json({ error: 'Usuário não encontrado' });
    }
    
    // Update password
    db.prepare("UPDATE users SET password = ? WHERE email = ?").run(newPassword, email);
    console.log('Password updated successfully for:', email);
    
    return res.json({ 
      message: 'Senha atualizada com sucesso',
      email: email
    });
  } catch (error: any) {
    console.error('Error resetting password:', error);
    return res.status(500).json({ error: error.message });
  }
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

app.put("/api/users/:id", (req, res) => {
  try {
    const { id } = req.params;
    const { username, email, password, role } = req.body;
    console.log('PUT /api/users/:id - Updating user:', { id, username, email, role, hasPassword: !!password });
    console.log('Request body:', req.body);
    
    if (!username || !email) {
      console.log('Validation failed: missing required fields');
      return res.status(400).json({ error: 'Username e email são obrigatórios' });
    }
    
    // Check if user exists
    const existingUser = db.prepare("SELECT * FROM users WHERE id = ?").get(id);
    if (!existingUser) {
      console.log('User not found:', id);
      return res.status(404).json({ error: 'Usuário não encontrado' });
    }
    
    console.log('Existing user found:', { id: existingUser.id, username: existingUser.username, email: existingUser.email });
    
    // Update user (only update password if provided)
    if (password && password.trim() !== '') {
      console.log('Updating with new password');
      db.prepare("UPDATE users SET username = ?, email = ?, password = ?, role = ? WHERE id = ?")
        .run(username, email, password, role || 'user', id);
    } else {
      console.log('Updating without password change');
      db.prepare("UPDATE users SET username = ?, email = ?, role = ? WHERE id = ?")
        .run(username, email, role || 'user', id);
    }
    
    console.log('User updated successfully:', id);
    
    // Return updated user data
    const updatedUser = db.prepare("SELECT id, username, email, role, created_at FROM users WHERE id = ?").get(id);
    console.log('Updated user data:', updatedUser);
    
    return res.json({ status: "updated", user: updatedUser });
  } catch (error: any) {
    console.error('Error updating user:', error.message);
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

app.put("/api/roles/:id", (req, res) => {
  try {
    const { id } = req.params;
    const { name, description, permissions } = req.body;
    console.log('PUT /api/roles/:id - Updating role:', { id, name, description, permissions });
    
    if (!name) {
      console.log('Validation failed: name is required');
      return res.status(400).json({ error: 'Nome do grupo é obrigatório' });
    }
    
    // Check if role exists
    const existingRole = db.prepare("SELECT * FROM roles WHERE id = ?").get(id);
    if (!existingRole) {
      return res.status(404).json({ error: 'Grupo não encontrado' });
    }
    
    // Update role
    db.prepare("UPDATE roles SET name = ?, description = ?, permissions = ? WHERE id = ?")
      .run(name, description || '', permissions || '', id);
    
    console.log('Role updated successfully:', id);
    return res.json({ status: "updated" });
  } catch (error: any) {
    console.error('Error updating role:', error.message);
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
  const distPath = path.join(__dirname, 'dist');
  const hasDistFolder = existsSync(distPath);

  // Serve dist only when NODE_ENV=production (prevents stale frontend in dev)
  const isProduction = process.env.NODE_ENV === "production";

  if (!isProduction) {
    console.log('Starting in development mode with Vite...');
    console.log('Dist folder exists:', hasDistFolder);
    const vite = await createViteServer({
      server: {
        middlewareMode: true,
        allowedHosts: ['maikysoft-uatizapi.iomi94.easypanel.host'],
      },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    console.log('Starting in production mode...');
    // Serve static files from dist folder in production (except index.html)
    app.use(express.static(distPath, { index: false }));
    
    // Serve index.html for all non-API routes (must be after all API routes)
    app.get('*', (req, res) => {
      // Don't serve index.html for API routes
      if (req.path.startsWith('/api/') || req.path === '/reset-password') {
        return res.status(404).json({ error: 'Not found' });
      }
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
    console.log(`Mode: ${isProduction ? 'production' : 'development'}`);
    console.log(`NODE_ENV: ${process.env.NODE_ENV || 'not set'}`);
  });
}

startServer();
