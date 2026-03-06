import Database from 'better-sqlite3';

const db = new Database('./messages.db');

console.log('=== Verificando banco de dados ===\n');

// Lista todas as tabelas
const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table'").all();
console.log('Tabelas existentes:');
tables.forEach(table => {
  console.log(`  - ${table.name}`);
  
  // Mostra a estrutura de cada tabela
  const columns = db.prepare(`PRAGMA table_info(${table.name})`).all();
  console.log('    Colunas:');
  columns.forEach(col => {
    console.log(`      ${col.name} (${col.type})`);
  });
  
  // Conta registros
  const count = db.prepare(`SELECT COUNT(*) as count FROM ${table.name}`).get();
  console.log(`    Registros: ${count.count}\n`);
});

// Criar tabelas se não existirem
console.log('\n=== Criando tabelas (se não existirem) ===\n');

try {
  db.exec(`
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
  console.log('✓ Tabelas users e roles criadas/verificadas com sucesso');
} catch (error) {
  console.error('✗ Erro ao criar tabelas:', error.message);
}

// Verificar novamente
const tablesAfter = db.prepare("SELECT name FROM sqlite_master WHERE type='table'").all();
console.log('\nTabelas após verificação:');
tablesAfter.forEach(table => {
  console.log(`  - ${table.name}`);
});

db.close();
