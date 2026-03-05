/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, ChangeEvent, useEffect } from 'react';
import { CheckCircle2, AlertCircle } from 'lucide-react';

interface Message {
  id: string;
  number: string;
  name?: string;
  message: string;
  status: string;
  created_at: string;
}

interface ScheduledMessage {
  id: number;
  number: string;
  name?: string;
  message: string;
  scheduled_at: string;
  status: string;
}

export default function App() {
  const [name, setName] = useState('');
  const [number, setNumber] = useState('');
  const [message, setMessage] = useState('');
  const [scheduledAt, setScheduledAt] = useState('');
  const [scheduledName, setScheduledName] = useState('');
  const [scheduledNumber, setScheduledNumber] = useState('');
  const [scheduledMessage, setScheduledMessage] = useState('');
  const [bulkNumbers, setBulkNumbers] = useState<string[]>([]);
  const [bulkMessage, setBulkMessage] = useState('');
  const [delay, setDelay] = useState(1);
  const [messages, setMessages] = useState<Message[]>([]);
  const [scheduledMessages, setScheduledMessages] = useState<ScheduledMessage[]>([]);
  const [notification, setNotification] = useState<{ type: 'success' | 'error', message: string } | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [activeTab, setActiveTab] = useState<'messages' | 'settings'>('messages');
  const [instanceName, setInstanceName] = useState('');
  const itemsPerPage = 10;

  const showNotification = (type: 'success' | 'error', message: string) => {
    setNotification({ type, message });
    setTimeout(() => setNotification(null), 3000);
  };

  const fetchMessages = async () => {
    const res = await fetch('/api/messages');
    const data = await res.json();
    setMessages(data);
  };

  const fetchScheduledMessages = async () => {
    const res = await fetch('/api/scheduled-messages');
    const data = await res.json();
    setScheduledMessages(data);
  };

  useEffect(() => {
    fetchMessages();
    fetchScheduledMessages();
    fetchSettings();
    const interval = setInterval(() => {
      fetchMessages();
      fetchScheduledMessages();
    }, 5000);
    return () => clearInterval(interval);
  }, []);

  const fetchSettings = async () => {
    const res = await fetch('/api/settings');
    const data = await res.json();
    setInstanceName(data.instanceName);
  };

  const updateSettings = async () => {
    await fetch('/api/settings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ instanceName }),
    });
    showNotification('success', 'Nome da instância atualizado!');
  };

  const sendNow = async () => {
    try {
      await fetch('/api/send-now', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, number, message }),
      });
      showNotification('success', 'Mensagem enviada com sucesso!');
      fetchMessages();
    } catch {
      showNotification('error', 'Falha ao enviar mensagem.');
    }
  };

  const sendBulk = async () => {
    console.log('Sending bulk:', { bulkNumbers, message, delay });
    try {
      await fetch('/api/send-bulk', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ numbers: bulkNumbers, message, delay }),
      });
      showNotification('success', 'Envio em massa iniciado!');
      fetchMessages();
    } catch {
      showNotification('error', 'Falha ao iniciar envio em massa.');
    }
  };

  const handleFileUpload = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (e) => {
        const text = e.target?.result as string;
        setBulkNumbers(text.split('\n').map(n => n.trim()).filter(n => n));
      };
      reader.readAsText(file);
    }
  };

  const scheduleMessage = async () => {
    try {
      await fetch('/api/schedule', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: scheduledName, number: scheduledNumber, message: scheduledMessage, scheduledAt }),
      });
      showNotification('success', 'Mensagem agendada com sucesso!');
      fetchScheduledMessages();
      setScheduledName('');
      setScheduledNumber('');
      setScheduledMessage('');
      setScheduledAt('');
    } catch {
      showNotification('error', 'Falha ao agendar mensagem.');
    }
  };

  const clearHistory = async () => {
    await fetch('/api/messages/clear', { method: 'POST' });
    fetchMessages();
    showNotification('success', 'Histórico limpo!');
  };

  return (
    <div className="p-8 max-w-4xl mx-auto">
      {notification && (
        <div className={`fixed top-4 right-4 p-4 rounded-lg shadow-lg flex items-center gap-2 ${notification.type === 'success' ? 'bg-green-500 text-white' : 'bg-red-500 text-white'}`}>
          {notification.type === 'success' ? <CheckCircle2 /> : <AlertCircle />}
          {notification.message}
        </div>
      )}
      <h1 className="text-2xl font-bold mb-4">Mensagens WhatsApp</h1>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        <div>
          <input className="w-full p-2 mb-2 border" placeholder="Nome" value={name} onChange={e => setName(e.target.value)} />
          <input className="w-full p-2 mb-2 border" placeholder="Número" value={number} onChange={e => setNumber(e.target.value)} />
          <textarea className="w-full p-2 mb-2 border" placeholder="Mensagem" value={message} onChange={e => setMessage(e.target.value)} />
          <button className="w-full p-2 bg-blue-500 text-white mb-2" onClick={sendNow}>Enviar Agora</button>
          
          <h2 className="text-xl font-bold mt-4 mb-2">Envio em Massa</h2>
          <input type="file" className="w-full p-2 mb-2 border" onChange={handleFileUpload} />
          <textarea className="w-full p-2 mb-2 border" placeholder="Mensagem para envio em massa" value={message} onChange={e => setMessage(e.target.value)} />
          <div className="mb-2">
            <label className="block text-sm font-medium">Atraso entre mensagens (segundos):</label>
            <input type="number" className="w-full p-2 border" value={delay} onChange={e => setDelay(Number(e.target.value))} min="1" />
          </div>
          <div className="flex gap-2">
            <button className="flex-1 p-2 bg-purple-500 text-white mb-2" onClick={sendBulk} disabled={bulkNumbers.length === 0}>Enviar Massa ({bulkNumbers.length} números)</button>
            <button className="p-2 bg-gray-500 text-white mb-2" onClick={() => setBulkNumbers([])} disabled={bulkNumbers.length === 0}>Limpar</button>
          </div>

          <h2 className="text-xl font-bold mt-4 mb-2">Agendar</h2>
          <input className="w-full p-2 mb-2 border" placeholder="Nome" value={scheduledName} onChange={e => setScheduledName(e.target.value)} />
          <input className="w-full p-2 mb-2 border" placeholder="Número" value={scheduledNumber} onChange={e => setScheduledNumber(e.target.value)} />
          <textarea className="w-full p-2 mb-2 border" placeholder="Mensagem" value={scheduledMessage} onChange={e => setScheduledMessage(e.target.value)} />
          <input type="datetime-local" className="w-full p-2 mb-2 border" value={scheduledAt} onChange={e => setScheduledAt(e.target.value)} />
          <button className="w-full p-2 bg-green-500 text-white" onClick={scheduleMessage}>Agendar</button>
        </div>
        <div>
          <div className="flex justify-between items-center mb-2">
            <h2 className="text-xl font-bold">Histórico de Mensagens</h2>
            <button className="p-1 px-2 bg-red-500 text-white text-sm rounded" onClick={clearHistory}>Limpar Histórico</button>
          </div>
          <input
            type="text"
            placeholder="Pesquisar por nome, número ou mensagem..."
            className="w-full p-2 mb-4 border rounded"
            value={searchTerm}
            onChange={e => { setSearchTerm(e.target.value); setCurrentPage(1); }}
          />
          <table className="w-full border-collapse">
            <thead>
              <tr className="border-b">
                <th className="p-2 text-left">Nome</th>
                <th className="p-2 text-left">Número</th>
                <th className="p-2 text-left">Mensagem</th>
                <th className="p-2 text-left">Horário</th>
                <th className="p-2 text-left">Status</th>
              </tr>
            </thead>
            <tbody>
              {messages
                .filter(msg =>
                  msg.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                  msg.number.includes(searchTerm) ||
                  msg.message.toLowerCase().includes(searchTerm.toLowerCase())
                )
                .slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage)
                .map(msg => (
                  <tr key={msg.id} className="border-b">
                    <td className="p-2">{msg.name || '-'}</td>
                    <td className="p-2">{msg.number}</td>
                    <td className="p-2">{msg.message}</td>
                    <td className="p-2">{new Date(msg.created_at).toLocaleString()}</td>
                    <td className="p-2">{msg.status}</td>
                  </tr>
                ))}
            </tbody>
          </table>
          <div className="flex justify-between items-center mt-4">
            <button
              className="p-2 bg-gray-200 rounded disabled:opacity-50"
              onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
              disabled={currentPage === 1}
            >
              Anterior
            </button>
            <span>Página {currentPage} de {Math.max(1, Math.ceil(messages.filter(msg =>
              msg.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
              msg.number.includes(searchTerm) ||
              msg.message.toLowerCase().includes(searchTerm.toLowerCase())
            ).length / itemsPerPage))}</span>
            <button
              className="p-2 bg-gray-200 rounded disabled:opacity-50"
              onClick={() => setCurrentPage(prev => Math.min(prev + 1, Math.max(1, Math.ceil(messages.filter(msg =>
                msg.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                msg.number.includes(searchTerm) ||
                msg.message.toLowerCase().includes(searchTerm.toLowerCase())
              ).length / itemsPerPage))))}
              disabled={currentPage === Math.max(1, Math.ceil(messages.filter(msg =>
                msg.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                msg.number.includes(searchTerm) ||
                msg.message.toLowerCase().includes(searchTerm.toLowerCase())
              ).length / itemsPerPage))}
            >
              Próximo
            </button>
          </div>
        </div>
      </div>
      <div className="mt-8 p-4 border rounded">
        <h2 className="text-xl font-bold mb-2">Configurações</h2>
        <label className="block text-sm font-medium">Nome da Instância:</label>
        <input className="w-full p-2 mb-2 border" value={instanceName} onChange={e => setInstanceName(e.target.value)} />
        <button className="p-2 bg-blue-500 text-white" onClick={updateSettings}>Salvar</button>
      </div>
    </div>
  );
}
