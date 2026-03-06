/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, ChangeEvent, useEffect } from 'react';
import { CheckCircle2, AlertCircle, Send, Users, Clock, Settings, Upload, Trash2, Search, MessageCircle } from 'lucide-react';

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
    <div className="min-h-screen bg-gradient-to-br from-green-50 to-emerald-50">
      {notification && (
        <div className={`fixed top-4 right-4 p-4 rounded-lg shadow-lg flex items-center gap-3 z-50 animate-in slide-in-from-top ${notification.type === 'success' ? 'bg-green-600 text-white' : 'bg-red-500 text-white'}`}>
          {notification.type === 'success' ? <CheckCircle2 className="w-5 h-5" /> : <AlertCircle className="w-5 h-5" />}
          <span className="font-medium">{notification.message}</span>
        </div>
      )}
      
      {/* Header */}
      <div className="bg-gradient-to-r from-green-600 to-green-700 text-white shadow-lg">
        <div className="max-w-7xl mx-auto px-8 py-6">
          <div className="flex items-center gap-3">
            <MessageCircle className="w-8 h-8" />
            <div>
              <h1 className="text-3xl font-bold">WhatsApp Manager</h1>
              <p className="text-green-100 text-sm">Sistema de Envio de Mensagens</p>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-8 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Left Column - Forms */}
          <div className="space-y-6">
            {/* Send Now Card */}
            <div className="bg-white rounded-xl shadow-lg p-6 border border-gray-100">
              <div className="flex items-center gap-2 mb-4">
                <Send className="w-5 h-5 text-green-600" />
                <h2 className="text-xl font-bold text-gray-800">Enviar Agora</h2>
              </div>
              <div className="space-y-3">
                <input 
                  className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent transition" 
                  placeholder="Nome (opcional)" 
                  value={name} 
                  onChange={e => setName(e.target.value)} 
                />
                <input 
                  className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent transition" 
                  placeholder="Número (ex: 5511999999999)" 
                  value={number} 
                  onChange={e => setNumber(e.target.value)} 
                />
                <textarea 
                  className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent transition min-h-[100px]" 
                  placeholder="Digite sua mensagem..." 
                  value={message} 
                  onChange={e => setMessage(e.target.value)} 
                />
                <button 
                  className="w-full p-3 bg-green-600 hover:bg-green-700 text-white rounded-lg font-medium flex items-center justify-center gap-2 transition shadow-md hover:shadow-lg" 
                  onClick={sendNow}
                >
                  <Send className="w-4 h-4" />
                  Enviar Mensagem
                </button>
              </div>
            </div>

            {/* Bulk Send Card */}
            <div className="bg-white rounded-xl shadow-lg p-6 border border-gray-100">
              <div className="flex items-center gap-2 mb-4">
                <Users className="w-5 h-5 text-purple-600" />
                <h2 className="text-xl font-bold text-gray-800">Envio em Massa</h2>
              </div>
              <div className="space-y-3">
                <div className="border-2 border-dashed border-gray-300 rounded-lg p-4 hover:border-purple-500 transition">
                  <label className="flex items-center justify-center gap-2 cursor-pointer">
                    <Upload className="w-5 h-5 text-gray-500" />
                    <span className="text-sm text-gray-600">
                      {bulkNumbers.length > 0 ? `${bulkNumbers.length} números carregados` : 'Carregar arquivo .txt com números'}
                    </span>
                    <input type="file" className="hidden" onChange={handleFileUpload} accept=".txt" />
                  </label>
                </div>
                <textarea 
                  className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent transition min-h-[100px]" 
                  placeholder="Mensagem para envio em massa..." 
                  value={message} 
                  onChange={e => setMessage(e.target.value)} 
                />
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Intervalo entre mensagens (segundos)
                  </label>
                  <input 
                    type="number" 
                    className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent transition" 
                    value={delay} 
                    onChange={e => setDelay(Number(e.target.value))} 
                    min="1" 
                  />
                </div>
                <div className="flex gap-2">
                  <button 
                    className="flex-1 p-3 bg-purple-600 hover:bg-purple-700 text-white rounded-lg font-medium flex items-center justify-center gap-2 transition shadow-md hover:shadow-lg disabled:opacity-50 disabled:cursor-not-allowed" 
                    onClick={sendBulk} 
                    disabled={bulkNumbers.length === 0}
                  >
                    <Users className="w-4 h-4" />
                    Enviar ({bulkNumbers.length})
                  </button>
                  <button 
                    className="p-3 bg-gray-200 hover:bg-gray-300 text-gray-700 rounded-lg transition disabled:opacity-50 disabled:cursor-not-allowed" 
                    onClick={() => setBulkNumbers([])} 
                    disabled={bulkNumbers.length === 0}
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>

            {/* Schedule Card */}
            <div className="bg-white rounded-xl shadow-lg p-6 border border-gray-100">
              <div className="flex items-center gap-2 mb-4">
                <Clock className="w-5 h-5 text-blue-600" />
                <h2 className="text-xl font-bold text-gray-800">Agendar Mensagem</h2>
              </div>
              <div className="space-y-3">
                <input 
                  className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition" 
                  placeholder="Nome (opcional)" 
                  value={scheduledName} 
                  onChange={e => setScheduledName(e.target.value)} 
                />
                <input 
                  className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition" 
                  placeholder="Número (ex: 5511999999999)" 
                  value={scheduledNumber} 
                  onChange={e => setScheduledNumber(e.target.value)} 
                />
                <textarea 
                  className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition min-h-[100px]" 
                  placeholder="Mensagem a ser agendada..." 
                  value={scheduledMessage} 
                  onChange={e => setScheduledMessage(e.target.value)} 
                />
                <input 
                  type="datetime-local" 
                  className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition" 
                  value={scheduledAt} 
                  onChange={e => setScheduledAt(e.target.value)} 
                />
                <button 
                  className="w-full p-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium flex items-center justify-center gap-2 transition shadow-md hover:shadow-lg" 
                  onClick={scheduleMessage}
                >
                  <Clock className="w-4 h-4" />
                  Agendar Mensagem
                </button>
              </div>
            </div>

            {/* Settings Card */}
            <div className="bg-white rounded-xl shadow-lg p-6 border border-gray-100">
              <div className="flex items-center gap-2 mb-4">
                <Settings className="w-5 h-5 text-gray-600" />
                <h2 className="text-xl font-bold text-gray-800">Configurações</h2>
              </div>
              <div className="space-y-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Nome da Instância
                  </label>
                  <input 
                    className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-gray-500 focus:border-transparent transition" 
                    value={instanceName} 
                    onChange={e => setInstanceName(e.target.value)} 
                    placeholder="Digite o nome da instância"
                  />
                </div>
                <button 
                  className="w-full p-3 bg-gray-700 hover:bg-gray-800 text-white rounded-lg font-medium transition shadow-md hover:shadow-lg" 
                  onClick={updateSettings}
                >
                  Salvar Configurações
                </button>
              </div>
            </div>
          </div>

          {/* Right Column - History */}
          <div className="space-y-6">
            <div className="bg-white rounded-xl shadow-lg p-6 border border-gray-100">
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-xl font-bold text-gray-800">Histórico de Mensagens</h2>
                <button 
                  className="p-2 px-4 bg-red-500 hover:bg-red-600 text-white text-sm rounded-lg transition flex items-center gap-2 shadow-md" 
                  onClick={clearHistory}
                >
                  <Trash2 className="w-4 h-4" />
                  Limpar
                </button>
              </div>
              
              <div className="relative mb-4">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
                <input
                  type="text"
                  placeholder="Pesquisar por nome, número ou mensagem..."
                  className="w-full pl-10 p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent transition"
                  value={searchTerm}
                  onChange={e => { setSearchTerm(e.target.value); setCurrentPage(1); }}
                />
              </div>

              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b-2 border-gray-200 bg-gray-50">
                      <th className="p-3 text-left text-sm font-semibold text-gray-700">Nome</th>
                      <th className="p-3 text-left text-sm font-semibold text-gray-700">Número</th>
                      <th className="p-3 text-left text-sm font-semibold text-gray-700">Mensagem</th>
                      <th className="p-3 text-left text-sm font-semibold text-gray-700">Horário</th>
                      <th className="p-3 text-left text-sm font-semibold text-gray-700">Status</th>
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
                        <tr key={msg.id} className="border-b border-gray-100 hover:bg-gray-50 transition">
                          <td className="p-3 text-sm text-gray-700">{msg.name || '-'}</td>
                          <td className="p-3 text-sm text-gray-700 font-mono">{msg.number}</td>
                          <td className="p-3 text-sm text-gray-600 max-w-xs truncate">{msg.message}</td>
                          <td className="p-3 text-sm text-gray-500">{new Date(msg.created_at).toLocaleString('pt-BR')}</td>
                          <td className="p-3">
                            <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                              msg.status === 'sent' ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'
                            }`}>
                              {msg.status}
                            </span>
                          </td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              </div>

              <div className="flex justify-between items-center mt-6">
                <button
                  className="p-2 px-4 bg-gray-200 hover:bg-gray-300 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed transition font-medium text-sm"
                  onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                  disabled={currentPage === 1}
                >
                  ← Anterior
                </button>
                <span className="text-sm text-gray-600 font-medium">
                  Página {currentPage} de {Math.max(1, Math.ceil(messages.filter(msg =>
                    msg.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                    msg.number.includes(searchTerm) ||
                    msg.message.toLowerCase().includes(searchTerm.toLowerCase())
                  ).length / itemsPerPage))}
                </span>
                <button
                  className="p-2 px-4 bg-gray-200 hover:bg-gray-300 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed transition font-medium text-sm"
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
                  Próximo →
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
