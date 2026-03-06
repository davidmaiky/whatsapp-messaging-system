/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, ChangeEvent, useEffect } from 'react';
import { CheckCircle2, AlertCircle, Send, Users, Clock, Settings, Upload, Trash2, Search, MessageCircle, History, UserPlus, Shield, Edit2, X, LogOut, Lock } from 'lucide-react';

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

interface User {
  id: number;
  username: string;
  email: string;
  role: string;
  created_at: string;
}

interface Role {
  id: number;
  name: string;
  permissions: string;
  description: string;
}

type Page = 'send-now' | 'bulk-send' | 'schedule' | 'history' | 'settings';
type SettingsTab = 'general' | 'users' | 'roles';

const availablePermissions = [
  { id: 'send-now', label: 'Enviar Mensagem Agora', description: 'Permite enviar mensagens individuais imediatamente' },
  { id: 'bulk-send', label: 'Envio em Massa', description: 'Permite enviar mensagens para múltiplos contatos' },
  { id: 'schedule', label: 'Agendar Mensagens', description: 'Permite agendar mensagens para envio futuro' },
  { id: 'view-history', label: 'Visualizar Histórico', description: 'Permite visualizar histórico de mensagens' },
  { id: 'clear-history', label: 'Limpar Histórico', description: 'Permite limpar histórico de mensagens' },
  { id: 'manage-users', label: 'Gerenciar Usuários', description: 'Permite criar, editar e excluir usuários' },
  { id: 'manage-roles', label: 'Gerenciar Grupos', description: 'Permite criar, editar e excluir grupos de permissões' },
  { id: 'system-settings', label: 'Configurações do Sistema', description: 'Permite alterar configurações gerais do sistema' },
];

export default function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [isLoggingIn, setIsLoggingIn] = useState(false);
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
  const [settingsTab, setSettingsTab] = useState<SettingsTab>('general');
  const [users, setUsers] = useState<User[]>([]);
  const [roles, setRoles] = useState<Role[]>([]);
  const [newUser, setNewUser] = useState({ username: '', email: '', password: '', role: 'user' });
  const [newRole, setNewRole] = useState({ name: '', description: '', permissions: [] as string[] });
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [editingRole, setEditingRole] = useState<Role | null>(null);
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
    // Check if user is already logged in
    const savedUser = localStorage.getItem('currentUser');
    if (savedUser) {
      try {
        const user = JSON.parse(savedUser);
        setCurrentUser(user);
        setIsAuthenticated(true);
      } catch (e) {
        localStorage.removeItem('currentUser');
      }
    }
  }, []);

  useEffect(() => {
    if (isAuthenticated) {
      fetchMessages();
      fetchScheduledMessages();
      fetchSettings();
      fetchUsers();
      fetchRoles();
      const interval = setInterval(() => {
        fetchMessages();
        fetchScheduledMessages();
      }, 5000);
      return () => clearInterval(interval);
    }
  }, [isAuthenticated]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoggingIn(true);
    try {
      console.log('Attempting login with email:', loginEmail);
      const response = await fetch('/api/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: loginEmail, password: loginPassword }),
      });
      
      console.log('Login response status:', response.status);
      
      if (!response.ok) {
        const text = await response.text();
        console.log('Login error response:', text);
        let error;
        try {
          error = JSON.parse(text);
        } catch (e) {
          console.error('Failed to parse error response:', e);
          showNotification('error', 'Erro no servidor. Verifique os logs.');
          return;
        }
        showNotification('error', error.error || 'Credenciais inválidas');
        return;
      }
      
      const text = await response.text();
      console.log('Login success response:', text);
      const data = JSON.parse(text);
      
      console.log('User data:', data.user);
      setCurrentUser(data.user);
      setIsAuthenticated(true);
      localStorage.setItem('currentUser', JSON.stringify(data.user));
      showNotification('success', `Bem-vindo, ${data.user.username}!`);
      setLoginEmail('');
      setLoginPassword('');
    } catch (error: any) {
      console.error('Login error:', error);
      showNotification('error', `Erro ao fazer login: ${error.message || 'Erro desconhecido'}`);
    } finally {
      setIsLoggingIn(false);
    }
  };

  const handleLogout = () => {
    setIsAuthenticated(false);
    setCurrentUser(null);
    localStorage.removeItem('currentUser');
    showNotification('success', 'Logout realizado com sucesso');
  };

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

  const fetchUsers = async () => {
    try {
      const res = await fetch('/api/users');
      if (!res.ok) {
        console.error('Error fetching users:', res.status);
        return;
      }
      const data = await res.json();
      setUsers(data);
    } catch (error) {
      console.error('Error fetching users:', error);
    }
  };

  const fetchRoles = async () => {
    try {
      const res = await fetch('/api/roles');
      if (!res.ok) {
        console.error('Error fetching roles:', res.status);
        return;
      }
      const data = await res.json();
      setRoles(data);
    } catch (error) {
      console.error('Error fetching roles:', error);
    }
  };

  const createUser = async () => {
    if (!newUser.username || !newUser.email || !newUser.password) {
      showNotification('error', 'Preencha todos os campos obrigatórios');
      return;
    }
    console.log('Creating user:', newUser);
    try {
      const response = await fetch('/api/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newUser),
      });
      console.log('Response status:', response.status);
      
      // Check if response has content
      const text = await response.text();
      console.log('Response text:', text);
      
      let data;
      try {
        data = text ? JSON.parse(text) : {};
      } catch (e) {
        console.error('Error parsing JSON:', e);
        showNotification('error', 'Erro ao processar resposta do servidor');
        return;
      }
      
      if (!response.ok) {
        showNotification('error', data.error || 'Erro ao criar usuário');
        return;
      }
      showNotification('success', 'Usuário criado com sucesso!');
      setNewUser({ username: '', email: '', password: '', role: 'user' });
      fetchUsers();
    } catch (error: any) {
      console.error('Error creating user:', error);
      showNotification('error', error.message || 'Erro ao criar usuário');
    }
  };

  const deleteUser = async (id: number) => {
    if (!confirm('Tem certeza que deseja excluir este usuário?')) return;
    try {
      await fetch(`/api/users/${id}`, { method: 'DELETE' });
      showNotification('success', 'Usuário excluído com sucesso!');
      fetchUsers();
    } catch {
      showNotification('error', 'Erro ao excluir usuário');
    }
  };

  const createRole = async () => {
    if (!newRole.name) {
      showNotification('error', 'Nome do grupo é obrigatório');
      return;
    }
    console.log('Creating role:', newRole);
    try {
      const roleData = {
        name: newRole.name,
        description: newRole.description,
        permissions: newRole.permissions.join(',')
      };
      console.log('Role data:', roleData);
      const response = await fetch('/api/roles', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(roleData),
      });
      console.log('Response status:', response.status);
      
      // Check if response has content
      const text = await response.text();
      console.log('Response text:', text);
      
      let data;
      try {
        data = text ? JSON.parse(text) : {};
      } catch (e) {
        console.error('Error parsing JSON:', e);
        showNotification('error', 'Erro ao processar resposta do servidor');
        return;
      }
      
      if (!response.ok) {
        showNotification('error', data.error || 'Erro ao criar grupo');
        return;
      }
      showNotification('success', 'Grupo criado com sucesso!');
      setNewRole({ name: '', description: '', permissions: [] });
      fetchRoles();
    } catch (error: any) {
      console.error('Error creating role:', error);
      showNotification('error', error.message || 'Erro ao criar grupo');
    }
  };

  const togglePermission = (permissionId: string) => {
    setNewRole(prev => ({
      ...prev,
      permissions: prev.permissions.includes(permissionId)
        ? prev.permissions.filter(p => p !== permissionId)
        : [...prev.permissions, permissionId]
    }));
  };

  const deleteRole = async (id: number) => {
    if (!confirm('Tem certeza que deseja excluir este grupo?')) return;
    try {
      await fetch(`/api/roles/${id}`, { method: 'DELETE' });
      showNotification('success', 'Grupo excluído com sucesso!');
      fetchRoles();
    } catch {
      showNotification('error', 'Erro ao excluir grupo');
    }
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
          <div className="bg-white rounded-xl shadow-lg p-8">
            <div className="flex items-center gap-3 mb-6">
              <Settings className="w-6 h-6 text-gray-600" />
              <h2 className="text-2xl font-bold text-gray-800">Configurações</h2>
            </div>

            {/* Tabs */}
            <div className="flex gap-2 mb-6 border-b">
              <button
                onClick={() => setSettingsTab('general')}
                className={`px-4 py-2 font-medium transition ${
                  settingsTab === 'general'
                    ? 'text-green-600 border-b-2 border-green-600'
                    : 'text-gray-600 hover:text-gray-800'
                }`}
              >
                Geral
              </button>
              <button
                onClick={() => setSettingsTab('users')}
                className={`px-4 py-2 font-medium transition flex items-center gap-2 ${
                  settingsTab === 'users'
                    ? 'text-green-600 border-b-2 border-green-600'
                    : 'text-gray-600 hover:text-gray-800'
                }`}
              >
                <UserPlus className="w-4 h-4" />
                Usuários
              </button>
              <button
                onClick={() => setSettingsTab('roles')}
                className={`px-4 py-2 font-medium transition flex items-center gap-2 ${
                  settingsTab === 'roles'
                    ? 'text-green-600 border-b-2 border-green-600'
                    : 'text-gray-600 hover:text-gray-800'
                }`}
              >
                <Shield className="w-4 h-4" />
                Grupos e Permissões
              </button>
            </div>

            {/* Tab Content */}
            {settingsTab === 'general' && (
              <div className="space-y-4 max-w-2xl">
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
                    <p><strong>Usuários Cadastrados:</strong> {users.length}</p>
                    <p><strong>Grupos de Permissões:</strong> {roles.length}</p>
                  </div>
                </div>
              </div>
            )}

            {settingsTab === 'users' && (
              <div className="space-y-6">
                {/* Create User Form */}
                <div className="bg-green-50 p-6 rounded-lg border border-green-200">
                  <h3 className="font-semibold text-gray-800 mb-4 flex items-center gap-2">
                    <UserPlus className="w-5 h-5 text-green-600" />
                    Criar Novo Usuário
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Nome de Usuário</label>
                      <input
                        className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                        value={newUser.username}
                        onChange={e => setNewUser({ ...newUser, username: e.target.value })}
                        placeholder="usuario123"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                      <input
                        type="email"
                        className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                        value={newUser.email}
                        onChange={e => setNewUser({ ...newUser, email: e.target.value })}
                        placeholder="usuario@exemplo.com"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Senha</label>
                      <input
                        type="password"
                        className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                        value={newUser.password}
                        onChange={e => setNewUser({ ...newUser, password: e.target.value })}
                        placeholder="••••••••"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Grupo</label>
                      <select
                        className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                        value={newUser.role}
                        onChange={e => setNewUser({ ...newUser, role: e.target.value })}
                      >
                        <option value="user">Usuário</option>
                        <option value="admin">Administrador</option>
                        {roles.map(role => (
                          <option key={role.id} value={role.name}>{role.name}</option>
                        ))}
                      </select>
                    </div>
                  </div>
                  <button
                    onClick={createUser}
                    className="mt-4 px-6 py-3 bg-green-600 hover:bg-green-700 text-white rounded-lg font-medium transition shadow-md"
                  >
                    Criar Usuário
                  </button>
                </div>

                {/* Users Table */}
                <div>
                  <h3 className="font-semibold text-gray-800 mb-4">Usuários Cadastrados ({users.length})</h3>
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead>
                        <tr className="border-b-2 border-gray-200 bg-gray-50">
                          <th className="p-3 text-left text-sm font-semibold text-gray-700">ID</th>
                          <th className="p-3 text-left text-sm font-semibold text-gray-700">Usuário</th>
                          <th className="p-3 text-left text-sm font-semibold text-gray-700">Email</th>
                          <th className="p-3 text-left text-sm font-semibold text-gray-700">Grupo</th>
                          <th className="p-3 text-left text-sm font-semibold text-gray-700">Criado em</th>
                          <th className="p-3 text-left text-sm font-semibold text-gray-700">Ações</th>
                        </tr>
                      </thead>
                      <tbody>
                        {users.map(user => (
                          <tr key={user.id} className="border-b border-gray-100 hover:bg-gray-50">
                            <td className="p-3 text-sm text-gray-600">{user.id}</td>
                            <td className="p-3 text-sm text-gray-800 font-medium">{user.username}</td>
                            <td className="p-3 text-sm text-gray-600">{user.email}</td>
                            <td className="p-3">
                              <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                                user.role === 'admin' ? 'bg-red-100 text-red-700' : 'bg-blue-100 text-blue-700'
                              }`}>
                                {user.role}
                              </span>
                            </td>
                            <td className="p-3 text-sm text-gray-500">
                              {new Date(user.created_at).toLocaleDateString('pt-BR')}
                            </td>
                            <td className="p-3">
                              <button
                                onClick={() => deleteUser(user.id)}
                                className="text-red-600 hover:text-red-800 transition"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            )}

            {settingsTab === 'roles' && (
              <div className="space-y-6">
                {/* Create Role Form */}
                <div className="bg-blue-50 p-6 rounded-lg border border-blue-200">
                  <h3 className="font-semibold text-gray-800 mb-4 flex items-center gap-2">
                    <Shield className="w-5 h-5 text-blue-600" />
                    Criar Novo Grupo de Permissões
                  </h3>
                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Nome do Grupo</label>
                      <input
                        className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        value={newRole.name}
                        onChange={e => setNewRole({ ...newRole, name: e.target.value })}
                        placeholder="Ex: Operador, Gestor, etc"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Descrição</label>
                      <input
                        className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        value={newRole.description}
                        onChange={e => setNewRole({ ...newRole, description: e.target.value })}
                        placeholder="Descreva as responsabilidades deste grupo"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-3">Permissões</label>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        {availablePermissions.map(permission => (
                          <div
                            key={permission.id}
                            className="flex items-start gap-3 p-3 border border-gray-200 rounded-lg hover:bg-blue-50 transition cursor-pointer"
                            onClick={() => togglePermission(permission.id)}
                          >
                            <input
                              type="checkbox"
                              checked={newRole.permissions.includes(permission.id)}
                              onChange={() => togglePermission(permission.id)}
                              className="mt-1 w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                              onClick={(e) => e.stopPropagation()}
                            />
                            <div className="flex-1">
                              <p className="text-sm font-medium text-gray-800">{permission.label}</p>
                              <p className="text-xs text-gray-500 mt-1">{permission.description}</p>
                            </div>
                          </div>
                        ))}
                      </div>
                      <p className="text-xs text-gray-500 mt-2">
                        {newRole.permissions.length} permiss{newRole.permissions.length !== 1 ? 'ões' : 'ão'} selecionada{newRole.permissions.length !== 1 ? 's' : ''}
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={createRole}
                    className="mt-4 px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition shadow-md"
                  >
                    Criar Grupo
                  </button>
                </div>

                {/* Roles Table */}
                <div>
                  <h3 className="font-semibold text-gray-800 mb-4">Grupos Cadastrados ({roles.length})</h3>
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead>
                        <tr className="border-b-2 border-gray-200 bg-gray-50">
                          <th className="p-3 text-left text-sm font-semibold text-gray-700">ID</th>
                          <th className="p-3 text-left text-sm font-semibold text-gray-700">Nome</th>
                          <th className="p-3 text-left text-sm font-semibold text-gray-700">Descrição</th>
                          <th className="p-3 text-left text-sm font-semibold text-gray-700">Permissões</th>
                          <th className="p-3 text-left text-sm font-semibold text-gray-700">Ações</th>
                        </tr>
                      </thead>
                      <tbody>
                        {roles.map(role => (
                          <tr key={role.id} className="border-b border-gray-100 hover:bg-gray-50">
                            <td className="p-3 text-sm text-gray-600">{role.id}</td>
                            <td className="p-3 text-sm text-gray-800 font-medium">{role.name}</td>
                            <td className="p-3 text-sm text-gray-600">{role.description}</td>
                            <td className="p-3">
                              <div className="flex flex-wrap gap-1">
                                {role.permissions.split(',').filter(p => p.trim()).map((permId, idx) => {
                                  const permission = availablePermissions.find(p => p.id === permId.trim());
                                  return (
                                    <span 
                                      key={idx} 
                                      className="inline-flex items-center px-2 py-1 rounded text-xs bg-blue-100 text-blue-700"
                                      title={permission?.description || permId.trim()}
                                    >
                                      {permission?.label || permId.trim()}
                                    </span>
                                  );
                                })}
                              </div>
                            </td>
                            <td className="p-3">
                              <button
                                onClick={() => deleteRole(role.id)}
                                className="text-red-600 hover:text-red-800 transition"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            )}
          </div>
        );

      default:
        return null;
    }
  };

  // Login screen
  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-green-50 to-emerald-50 flex items-center justify-center p-4">
        {notification && (
          <div className={`fixed top-4 right-4 p-4 rounded-lg shadow-lg flex items-center gap-3 z-50 animate-in slide-in-from-top ${notification.type === 'success' ? 'bg-green-600 text-white' : 'bg-red-500 text-white'}`}>
            {notification.type === 'success' ? <CheckCircle2 className="w-5 h-5" /> : <AlertCircle className="w-5 h-5" />}
            <span className="font-medium">{notification.message}</span>
          </div>
        )}

        <div className="bg-white rounded-2xl shadow-2xl p-8 w-full max-w-md">
          {/* Logo/Header */}
          <div className="text-center mb-8">
            <div className="inline-flex items-center justify-center w-16 h-16 bg-gradient-to-br from-green-500 to-green-600 rounded-full mb-4">
              <MessageCircle className="w-8 h-8 text-white" />
            </div>
            <h1 className="text-3xl font-bold text-gray-800 mb-2">WhatsApp Manager</h1>
            <p className="text-gray-600">Faça login para continuar</p>
          </div>

          {/* Login Form */}
          <form onSubmit={handleLogin} className="space-y-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Email
              </label>
              <input
                type="email"
                value={loginEmail}
                onChange={(e) => setLoginEmail(e.target.value)}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent transition"
                placeholder="seu@email.com"
                required
                disabled={isLoggingIn}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Senha
              </label>
              <input
                type="password"
                value={loginPassword}
                onChange={(e) => setLoginPassword(e.target.value)}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent transition"
                placeholder="••••••••"
                required
                disabled={isLoggingIn}
              />
            </div>

            <button
              type="submit"
              disabled={isLoggingIn}
              className="w-full bg-gradient-to-r from-green-600 to-green-700 text-white py-3 rounded-lg font-semibold hover:from-green-700 hover:to-green-800 transition shadow-lg disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {isLoggingIn ? (
                <>
                  <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                  <span>Entrando...</span>
                </>
              ) : (
                <>
                  <Lock className="w-5 h-5" />
                  <span>Entrar</span>
                </>
              )}
            </button>
          </form>

          <div className="mt-6 text-center text-sm text-gray-600">
            <p>Use suas credenciais cadastradas no sistema</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-green-50 to-emerald-50 flex">
      {notification && (
        <div className={`fixed top-4 right-4 p-4 rounded-lg shadow-lg flex items-center gap-3 z-50 animate-in slide-in-from-top ${notification.type === 'success' ? 'bg-green-600 text-white' : 'bg-red-500 text-white'}`}>
          {notification.type === 'success' ? <CheckCircle2 className="w-5 h-5" /> : <AlertCircle className="w-5 h-5" />}
          <span className="font-medium">{notification.message}</span>
        </div>
      )}

      {/* Sidebar Menu */}
      <div className="w-64 bg-white shadow-xl min-h-screen flex flex-col">
        {/* Header */}
        <div className="bg-gradient-to-r from-green-600 to-green-700 text-white p-6">
          <div className="flex items-center gap-3 mb-4">
            <MessageCircle className="w-8 h-8" />
            <div>
              <h1 className="text-xl font-bold">WhatsApp</h1>
              <p className="text-green-100 text-xs">Manager</p>
            </div>
          </div>
          {currentUser && (
            <div className="pt-3 border-t border-green-500/30">
              <p className="text-sm text-green-100">Olá,</p>
              <p className="text-sm font-semibold truncate">{currentUser.username}</p>
              <p className="text-xs text-green-200 truncate">{currentUser.email}</p>
            </div>
          )}
        </div>

        {/* Menu Items */}
        <nav className="p-4 flex-1">
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

        {/* Logout Button */}
        <div className="p-4 border-t border-gray-200">
          <button
            onClick={handleLogout}
            className="w-full flex items-center gap-3 p-3 rounded-lg text-red-600 hover:bg-red-50 transition font-medium"
          >
            <LogOut className="w-5 h-5" />
            <span>Sair</span>
          </button>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 p-8 overflow-y-auto">
        {renderPage()}
      </div>
    </div>
  );
}
