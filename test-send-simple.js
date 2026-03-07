// Script de teste para enviar uma mensagem simples
import fetch from 'node-fetch';

async function testSendMessage() {
  try {
    console.log('🧪 Testando envio de mensagem...\n');
    
    const response = await fetch('http://localhost:3000/api/send-now', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        name: 'Teste',
        number: '5511999999999',
        message: 'Mensagem de teste enviada via API'
      })
    });

    const data = await response.json();
    
    console.log('📊 Status da resposta:', response.status);
    console.log('📦 Dados recebidos:', JSON.stringify(data, null, 2));
    
    if (response.ok) {
      console.log('\n✅ Teste concluído! O envio de mensagens está funcionando.');
    } else {
      console.log('\n❌ Erro no envio:', data.error || 'Erro desconhecido');
    }
    
  } catch (error) {
    console.error('\n❌ Erro ao testar:', error.message);
  }
}

testSendMessage();
