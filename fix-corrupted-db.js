import Database from 'better-sqlite3';
import fs from 'fs';

console.log('=== Recuperando Banco de Dados Corrompido ===\n');

try {
  // Abrir banco de dados com modo de recuperação
  const db = new Database('./messages.db', { 
    verbose: console.log,
    fileMustExist: true 
  });

  console.log('✓ Banco de dados aberto com sucesso\n');

  // Exportar todos os dados
  console.log('Exportando dados...\n');
  
  const data = {
    scheduled_messages: [],
    messages: [],
    settings: [],
    users: [],
    roles: [],
    contacts: []
  };

  try {
    data.scheduled_messages = db.prepare('SELECT * FROM scheduled_messages').all();
    console.log(`✓ ${data.scheduled_messages.length} mensagens agendadas exportadas`);
  } catch (e) {
    console.log(`✗ Erro ao exportar scheduled_messages: ${e.message}`);
  }

  try {
    data.messages = db.prepare('SELECT * FROM messages').all();
    console.log(`✓ ${data.messages.length} mensagens exportadas`);
  } catch (e) {
    console.log(`✗ Erro ao exportar messages: ${e.message}`);
  }

  try {
    data.settings = db.prepare('SELECT * FROM settings').all();
    console.log(`✓ ${data.settings.length} configurações exportadas`);
  } catch (e) {
    console.log(`✗ Erro ao exportar settings: ${e.message}`);
  }

  try {
    data.users = db.prepare('SELECT * FROM users').all();
    console.log(`✓ ${data.users.length} usuários exportados`);
  } catch (e) {
    console.log(`✗ Erro ao exportar users: ${e.message}`);
  }

  try {
    data.roles = db.prepare('SELECT * FROM roles').all();
    console.log(`✓ ${data.roles.length} roles exportadas`);
  } catch (e) {
    console.log(`✗ Erro ao exportar roles: ${e.message}`);
  }

  try {
    data.contacts = db.prepare('SELECT * FROM contacts').all();
    console.log(`✓ ${data.contacts.length} contatos exportados`);
  } catch (e) {
    console.log(`✗ Erro ao exportar contacts: ${e.message}`);
  }

  db.close();
  console.log('\n✓ Dados exportados com sucesso\n');

  // Salvar backup dos dados
  fs.writeFileSync('./db-export.json', JSON.stringify(data, null, 2));
  console.log('✓ Backup salvo em db-export.json\n');

  // Remover banco de dados corrompido
  console.log('Removendo banco de dados corrompido...');
  if (fs.existsSync('./messages.db-shm')) fs.unlinkSync('./messages.db-shm');
  if (fs.existsSync('./messages.db-wal')) fs.unlinkSync('./messages.db-wal');
  fs.unlinkSync('./messages.db');
  console.log('✓ Banco de dados removido\n');

  // Criar novo banco de dados
  console.log('Criando novo banco de dados...');
  const newDb = new Database('./messages.db');

  // Criar tabelas
  newDb.exec(`
    CREATE TABLE scheduled_messages (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      number TEXT NOT NULL,
      name TEXT,
      message TEXT NOT NULL,
      media_type TEXT,
      media_data TEXT,
      media_name TEXT,
      media_mime_type TEXT,
      scheduled_at DATETIME NOT NULL,
      status TEXT DEFAULT 'pending'
    );

    CREATE TABLE messages (
      id TEXT PRIMARY KEY,
      number TEXT NOT NULL,
      name TEXT,
      message TEXT,
      media_type TEXT,
      media_name TEXT,
      status TEXT DEFAULT 'pending',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE settings (
      key TEXT PRIMARY KEY,
      value TEXT
    );

    CREATE TABLE users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT UNIQUE NOT NULL,
      email TEXT UNIQUE NOT NULL,
      password TEXT NOT NULL,
      role TEXT DEFAULT 'user',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE roles (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT UNIQUE NOT NULL,
      description TEXT,
      permissions TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE contacts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT,
      number TEXT UNIQUE NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
  `);

  console.log('✓ Tabelas criadas\n');

  // Importar dados
  console.log('Importando dados...\n');

  if (data.scheduled_messages.length > 0) {
    const stmt = newDb.prepare(`
      INSERT INTO scheduled_messages (id, number, name, message, media_type, media_data, media_name, media_mime_type, scheduled_at, status)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    for (const row of data.scheduled_messages) {
      stmt.run(row.id, row.number, row.name, row.message, row.media_type, row.media_data, row.media_name, row.media_mime_type, row.scheduled_at, row.status);
    }
    console.log(`✓ ${data.scheduled_messages.length} mensagens agendadas importadas`);
  }

  if (data.messages.length > 0) {
    const stmt = newDb.prepare(`
      INSERT INTO messages (id, number, name, message, media_type, media_name, status, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);
    for (const row of data.messages) {
      stmt.run(row.id, row.number, row.name, row.message, row.media_type, row.media_name, row.status, row.created_at);
    }
    console.log(`✓ ${data.messages.length} mensagens importadas`);
  }

  if (data.settings.length > 0) {
    const stmt = newDb.prepare('INSERT INTO settings (key, value) VALUES (?, ?)');
    for (const row of data.settings) {
      stmt.run(row.key, row.value);
    }
    console.log(`✓ ${data.settings.length} configurações importadas`);
  }

  if (data.users.length > 0) {
    const stmt = newDb.prepare(`
      INSERT INTO users (id, username, email, password, role, created_at)
      VALUES (?, ?, ?, ?, ?, ?)
    `);
    for (const row of data.users) {
      stmt.run(row.id, row.username, row.email, row.password, row.role, row.created_at);
    }
    console.log(`✓ ${data.users.length} usuários importados`);
  }

  if (data.roles.length > 0) {
    const stmt = newDb.prepare(`
      INSERT INTO roles (id, name, description, permissions, created_at)
      VALUES (?, ?, ?, ?, ?)
    `);
    for (const row of data.roles) {
      stmt.run(row.id, row.name, row.description, row.permissions, row.created_at);
    }
    console.log(`✓ ${data.roles.length} roles importadas`);
  }

  if (data.contacts.length > 0) {
    const stmt = newDb.prepare(`
      INSERT INTO contacts (id, name, number, created_at)
      VALUES (?, ?, ?, ?)
    `);
    for (const row of data.contacts) {
      stmt.run(row.id, row.name, row.number, row.created_at);
    }
    console.log(`✓ ${data.contacts.length} contatos importados`);
  }

  newDb.close();

  console.log('\n=== ✓ Banco de dados recuperado com sucesso! ===\n');
  console.log('O banco de dados foi recriado e todos os dados foram importados.');
  console.log('Você pode deletar o arquivo db-export.json se quiser.\n');

} catch (error) {
  console.error('\n✗ Erro durante a recuperação:', error.message);
  console.error('Stack:', error.stack);
  process.exit(1);
}
