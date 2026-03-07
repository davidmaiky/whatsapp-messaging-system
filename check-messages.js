import Database from 'better-sqlite3';

const db = new Database('messages.db');

console.log('=== VERIFICANDO TABELA messages ===');
const messages = db.prepare('SELECT * FROM messages ORDER BY created_at DESC LIMIT 10').all();
console.log(`Total de mensagens encontradas: ${messages.length}`);
if (messages.length > 0) {
  console.log('\nÚltimas mensagens:');
  messages.forEach((msg, i) => {
    console.log(`\n${i + 1}. ID: ${msg.id}`);
    console.log(`   Número: ${msg.number}`);
    console.log(`   Nome: ${msg.name || 'N/A'}`);
    console.log(`   Mensagem: ${msg.message}`);
    console.log(`   Status: ${msg.status}`);
    console.log(`   Criado em: ${msg.created_at}`);
  });
} else {
  console.log('\n❌ Nenhuma mensagem encontrada na tabela!');
}

console.log('\n=== VERIFICANDO TABELA scheduled_messages ===');
const scheduled = db.prepare('SELECT * FROM scheduled_messages ORDER BY scheduled_at DESC LIMIT 10').all();
console.log(`Total de mensagens agendadas: ${scheduled.length}`);

console.log('\n=== ESTRUTURA DA TABELA messages ===');
const tableInfo = db.prepare('PRAGMA table_info(messages)').all();
console.log('Colunas:', tableInfo.map(col => `${col.name} (${col.type})`).join(', '));

db.close();
