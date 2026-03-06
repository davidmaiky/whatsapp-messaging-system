/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, ChangeEvent, useEffect } from 'react';
import { CheckCircle2, AlertCircle, Send, Users, Clock, Settings, Upload, Trash2, Search, MessageCircle, History } from 'lucide-react';

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

type Page = 'send-now' | 'bulk-send' | 'schedule' | 'history' | 'settings';

export default function App() {
  const [activePage, setActivePage] = useState<Page>('send-now');
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
  const [instanceName, setInstanceName] = useState('');
  const [timezone, setTimezone] = useState('America/Sao_Paulo');
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
    setTimezone(data.timezone || 'America/Sao_Paulo');
  };

  const updateSettings = async () => {
    await fetch('/api/settings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ instanceName, timezone }),
    });
    showNotification('success', 'Configurações atualizadas com sucesso!');
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
    console.log('Sending bulk:', { bulkNumbers, bulkMessage, delay });
    try {
      await fetch('/api/send-bulk', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ numbers: bulkNumbers, message: bulkMessage, delay }),
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

  const menuItems = [
    { id: 'send-now' as Page, icon: Send, label: 'Enviar Agora', color: 'text-green-600' },
    { id: 'bulk-send' as Page, icon: Users, label: 'Envio em Massa', color: 'text-purple-600' },
    { id: 'schedule' as Page, icon: Clock, label: 'Agendar', color: 'text-blue-600' },
    { id: 'history' as Page, icon: History, label: 'Histórico', color: 'text-orange-600' },
    { id: 'settings' as Page, icon: Settings, label: 'Configurações', color: 'text-gray-600' },
  ];

  const renderPage = () => {
    switch (activePage) {
      case 'send-now':
        return (
          <div className="bg-white rounded-xl shadow-lg p-8 max-w-2xl mx-auto">
            <div className="flex items-center gap-3 mb-6">
              <Send className="w-6 h-6 text-green-600" />
              <h2 className="text-2xl font-bold text-gray-800">Enviar Mensagem Agora</h2>
            </div>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Nome (opcional)</label>
                <input 
                  className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent transition" 
                  placeholder="Digite o nome do contato" 
                  value={name} 
                  onChange={e => setName(e.target.value)} 
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Número do WhatsApp</label>
                <input 
                  className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent transition" 
                  placeholder="Ex: 5511999999999" 
                  value={number} 
                  onChange={e => setNumber(e.target.value)} 
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Mensagem</label>
                <textarea 
                  className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent transition min-h-[150px]" 
                  placeholder="Digite sua mensagem aqui..." 
                  value={message} 
                  onChange={e => setMessage(e.target.value)} 
                />
              </div>
              <button 
                className="w-full p-4 bg-green-600 hover:bg-green-700 text-white rounded-lg font-medium flex items-center justify-center gap-2 transition shadow-md hover:shadow-lg text-lg" 
                onClick={sendNow}
              >
                <Send className="w-5 h-5" />
                Enviar Mensagem
              </button>
            </div>
          </div>
        );

      case 'bulk-send':
        return (
          <div className="bg-white rounded-xl shadow-lg p-8 max-w-2xl mx-auto">
            <div className="flex items-center gap-3 mb-6">
              <Users className="w-6 h-6 text-purple-600" />
              <h2 className="text-2xl font-bold text-gray-800">Envio em Massa</h2>
            </div>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Arquivo com Números</label>
                <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 hover:border-purple-500 transition bg-gray-50">
                  <label className="flex flex-col items-center justify-center gap-2 cursor-pointer">
                    <Upload className="w-8 h-8 text-gray-400" />
                    <span className="text-sm text-gray-600 font-medium">
                      {bulkNumbers.length > 0 ? `✓ ${bulkNumbers.length} números carregados` : 'Clique para carregar arquivo .txt'}
                    </span>
                    <span className="text-xs text-gray-500">Um número por linha</span>
                    <input type="file" className="hidden" onChange={handleFileUpload} accept=".txt" />
                  </label>
                </div>
              </div>
              {bulkNumbers.length > 0 && (
                <div className="bg-purple-50 border border-purple-200 rounded-lg p-4">
                  <p className="text-sm text-purple-800 font-medium">
                    📋 {bulkNumbers.length} números prontos para envio
                  </p>
                  <div className="mt-2 max-h-32 overflow-y-auto text-xs text-purple-700 font-mono">
                    {bulkNumbers.slice(0, 5).join(', ')}
                    {bulkNumbers.length > 5 && '...'}
                  </div>
                </div>
              )}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Mensagem</label>
                <textarea 
                  className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent transition min-h-[150px]" 
                  placeholder="Digite a mensagem que será enviada para todos os números..." 
                  value={bulkMessage} 
                  onChange={e => setBulkMessage(e.target.value)} 
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Intervalo entre mensagens
                </label>
                <div className="flex items-center gap-3">
                  <input 
                    type="number" 
                    className="flex-1 p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent transition" 
                    value={delay} 
                    onChange={e => setDelay(Number(e.target.value))} 
                    min="1" 
                  />
                  <span className="text-sm text-gray-600 font-medium">segundos</span>
                </div>
                <p className="text-xs text-gray-500 mt-1">Tempo de espera entre cada envio para evitar bloqueios</p>
              </div>
              <div className="flex gap-2">
                <button 
                  className="flex-1 p-4 bg-purple-600 hover:bg-purple-700 text-white rounded-lg font-medium flex items-center justify-center gap-2 transition shadow-md hover:shadow-lg disabled:opacity-50 disabled:cursor-not-allowed text-lg" 
                  onClick={sendBulk} 
                  disabled={bulkNumbers.length === 0}
                >
                  <Users className="w-5 h-5" />
                  Iniciar Envio ({bulkNumbers.length})
                </button>
                <button 
                  className="p-4 bg-gray-200 hover:bg-gray-300 text-gray-700 rounded-lg transition disabled:opacity-50 disabled:cursor-not-allowed" 
                  onClick={() => setBulkNumbers([])} 
                  disabled={bulkNumbers.length === 0}
                >
                  <Trash2 className="w-5 h-5" />
                </button>
              </div>
            </div>
          </div>
        );

      case 'schedule':
        return (
          <div className="bg-white rounded-xl shadow-lg p-8 max-w-2xl mx-auto">
            <div className="flex items-center gap-3 mb-6">
              <Clock className="w-6 h-6 text-blue-600" />
              <h2 className="text-2xl font-bold text-gray-800">Agendar Mensagem</h2>
            </div>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Nome (opcional)</label>
                <input 
                  className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition" 
                  placeholder="Digite o nome do contato" 
                  value={scheduledName} 
                  onChange={e => setScheduledName(e.target.value)} 
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Número do WhatsApp</label>
                <input 
                  className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition" 
                  placeholder="Ex: 5511999999999" 
                  value={scheduledNumber} 
                  onChange={e => setScheduledNumber(e.target.value)} 
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Mensagem</label>
                <textarea 
                  className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition min-h-[150px]" 
                  placeholder="Digite a mensagem a ser agendada..." 
                  value={scheduledMessage} 
                  onChange={e => setScheduledMessage(e.target.value)} 
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Data e Hora do Envio</label>
                <input 
                  type="datetime-local" 
                  className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition" 
                  value={scheduledAt} 
                  onChange={e => setScheduledAt(e.target.value)} 
                />
              </div>
              <button 
                className="w-full p-4 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium flex items-center justify-center gap-2 transition shadow-md hover:shadow-lg text-lg" 
                onClick={scheduleMessage}
              >
                <Clock className="w-5 h-5" />
                Agendar Mensagem
              </button>
            </div>
            
            {scheduledMessages.length > 0 && (
              <div className="mt-8 border-t pt-6">
                <h3 className="font-semibold text-gray-800 mb-4 text-lg">Mensagens Agendadas ({scheduledMessages.length})</h3>
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b-2 border-gray-200 bg-blue-50">
                        <th className="p-3 text-left text-sm font-semibold text-gray-700">Nome</th>
                        <th className="p-3 text-left text-sm font-semibold text-gray-700">Número</th>
                        <th className="p-3 text-left text-sm font-semibold text-gray-700">Mensagem</th>
                        <th className="p-3 text-left text-sm font-semibold text-gray-700">Hora Agendada</th>
                        <th className="p-3 text-left text-sm font-semibold text-gray-700">Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {scheduledMessages.map(msg => (
                        <tr key={msg.id} className="border-b border-gray-100 hover:bg-blue-50 transition">
                          <td className="p-3 text-sm text-gray-700">{msg.name || '-'}</td>
                          <td className="p-3 text-sm text-gray-700 font-mono">{msg.number}</td>
                          <td className="p-3 text-sm text-gray-600 max-w-xs truncate">{msg.message}</td>
                          <td className="p-3 text-sm text-gray-500">
                            {new Date(msg.scheduled_at.includes('Z') || msg.scheduled_at.includes('+') ? msg.scheduled_at : msg.scheduled_at + 'Z').toLocaleString('pt-BR', {
                              timeZone: timezone,
                              day: '2-digit',
                              month: '2-digit',
                              year: 'numeric',
                              hour: '2-digit',
                              minute: '2-digit'
                            })}
                          </td>
                          <td className="p-3">
                            <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                              msg.status === 'Agendado' ? 'bg-blue-100 text-blue-700' : 
                              msg.status === 'Enviado' ? 'bg-green-100 text-green-700' : 
                              'bg-yellow-100 text-yellow-700'
                            }`}>
                              {msg.status}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        );

      case 'history':
        return (
          <div className="bg-white rounded-xl shadow-lg p-8">
            <div className="flex justify-between items-center mb-6">
              <div className="flex items-center gap-3">
                <History className="w-6 h-6 text-orange-600" />
                <h2 className="text-2xl font-bold text-gray-800">Histórico de Mensagens</h2>
              </div>
              <button 
                className="p-2 px-4 bg-red-500 hover:bg-red-600 text-white text-sm rounded-lg transition flex items-center gap-2 shadow-md" 
                onClick={clearHistory}
              >
                <Trash2 className="w-4 h-4" />
                Limpar Histórico
              </button>
            </div>
            
            <div className="relative mb-6">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
              <input
                type="text"
                placeholder="Pesquisar por nome, número ou mensagem..."
                className="w-full pl-10 p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent transition"
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
                        <td className="p-3 text-sm text-gray-500">
                          {new Date(msg.created_at.includes('Z') || msg.created_at.includes('+') ? msg.created_at : msg.created_at + 'Z').toLocaleString('pt-BR', {
                            timeZone: timezone,
                            day: '2-digit',
                            month: '2-digit',
                            year: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit',
                            second: '2-digit'
                          })}
                        </td>
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
        );

      case 'settings':
        return (
          <div className="bg-white rounded-xl shadow-lg p-8 max-w-2xl mx-auto">
            <div className="flex items-center gap-3 mb-6">
              <Settings className="w-6 h-6 text-gray-600" />
              <h2 className="text-2xl font-bold text-gray-800">Configurações</h2>
            </div>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Nome da Instância Evolution API
                </label>
                <input 
                  className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-gray-500 focus:border-transparent transition" 
                  value={instanceName} 
                  onChange={e => setInstanceName(e.target.value)} 
                  placeholder="Ex: minha-instancia"
                />
                <p className="text-xs text-gray-500 mt-1">
                  Nome da instância configurada no Evolution API
                </p>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Fuso Horário do Sistema
                </label>
                <select 
                  className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-gray-500 focus:border-transparent transition" 
                  value={timezone} 
                  onChange={e => setTimezone(e.target.value)}
                >
                  <option value="America/Sao_Paulo">São Paulo (GMT-3)</option>
                  <option value="America/Rio_Branco">Rio Branco (GMT-5)</option>
                  <option value="America/Manaus">Manaus (GMT-4)</option>
                  <option value="America/Fortaleza">Fortaleza (GMT-3)</option>
                  <option value="America/Recife">Recife (GMT-3)</option>
                  <option value="America/Bahia">Salvador (GMT-3)</option>
                  <option value="America/Belem">Belém (GMT-3)</option>
                  <option value="America/Cuiaba">Cuiabá (GMT-4)</option>
                  <option value="America/Campo_Grande">Campo Grande (GMT-4)</option>
                  <option value="America/Porto_Velho">Porto Velho (GMT-4)</option>
                  <option value="America/Boa_Vista">Boa Vista (GMT-4)</option>
                  <option value="America/Maceio">Maceió (GMT-3)</option>
                  <option value="America/Araguaina">Araguaína (GMT-3)</option>
                  <option value="America/Santarem">Santarém (GMT-3)</option>
                  <option value="America/Noronha">Fernando de Noronha (GMT-2)</option>
                </select>
                <p className="text-xs text-gray-500 mt-1">
                  Fuso horário usado para exibir datas e horários no sistema
                </p>
              </div>
              <button 
                className="w-full p-4 bg-gray-700 hover:bg-gray-800 text-white rounded-lg font-medium transition shadow-md hover:shadow-lg text-lg" 
                onClick={updateSettings}
              >
                Salvar Configurações
              </button>
              <div className="mt-6 p-4 bg-gray-50 rounded-lg border border-gray-200">
                <h3 className="font-semibold text-gray-800 mb-2">Informações do Sistema</h3>
                <div className="space-y-2 text-sm text-gray-600">
                  <p><strong>Versão:</strong> 1.0.0</p>
                  <p><strong>Instância Ativa:</strong> {instanceName || 'Não configurada'}</p>
                  <p><strong>Fuso Horário:</strong> {timezone}</p>
                  <p><strong>Total de Mensagens:</strong> {messages.length}</p>
                  <p><strong>Mensagens Agendadas:</strong> {scheduledMessages.length}</p>
                </div>
              </div>
            </div>
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-green-50 to-emerald-50 flex">
      {notification && (
        <div className={`fixed top-4 right-4 p-4 rounded-lg shadow-lg flex items-center gap-3 z-50 animate-in slide-in-from-top ${notification.type === 'success' ? 'bg-green-600 text-white' : 'bg-red-500 text-white'}`}>
          {notification.type === 'success' ? <CheckCircle2 className="w-5 h-5" /> : <AlertCircle className="w-5 h-5" />}
          <span className="font-medium">{notification.message}</span>
        </div>
      )}

      {/* Sidebar Menu */}
      <div className="w-64 bg-white shadow-xl min-h-screen">
        {/* Header */}
        <div className="bg-gradient-to-r from-green-600 to-green-700 text-white p-6">
          <div className="flex items-center gap-3">
            <MessageCircle className="w-8 h-8" />
            <div>
              <h1 className="text-xl font-bold">WhatsApp</h1>
              <p className="text-green-100 text-xs">Manager</p>
            </div>
          </div>
        </div>

        {/* Menu Items */}
        <nav className="p-4">
          <ul className="space-y-2">
            {menuItems.map(item => {
              const Icon = item.icon;
              const isActive = activePage === item.id;
              return (
                <li key={item.id}>
                  <button
                    onClick={() => setActivePage(item.id)}
                    className={`w-full flex items-center gap-3 p-3 rounded-lg transition ${
                      isActive 
                        ? 'bg-green-100 text-green-700 font-semibold' 
                        : 'text-gray-700 hover:bg-gray-100'
                    }`}
                  >
                    <Icon className={`w-5 h-5 ${isActive ? 'text-green-600' : item.color}`} />
                    <span>{item.label}</span>
                  </button>
                </li>
              );
            })}
          </ul>
        </nav>
      </div>

      {/* Main Content */}
      <div className="flex-1 p-8 overflow-y-auto">
        {renderPage()}
      </div>
    </div>
  );
}
