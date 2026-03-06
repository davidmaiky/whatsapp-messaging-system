/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, ChangeEvent, useEffect, FormEvent } from 'react';
import { CheckCircle2, AlertCircle, Send, Users, Clock, Settings, Upload, Trash2, Search, MessageCircle, History, UserPlus, Shield, Edit2, X, LogOut, Lock, Menu, Bell, ChevronRight, Rocket, Smartphone } from 'lucide-react';

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
  permissions?: string;
  created_at: string;
}

interface EditableUser extends User {
  password?: string;
}

interface Role {
  id: number;
  name: string;
  permissions: string;
  description: string;
}

interface Contact {
  id: number;
  name?: string;
  number: string;
  created_at: string;
}

interface BulkCampaignStatus {
  isRunning: boolean;
  stopRequested: boolean;
  total: number;
  processed: number;
  sent: number;
  failed: number;
  startedAt: string | null;
  endedAt: string | null;
  messagePreview: string;
  progress: number;
}

type Page = 'send-now' | 'contacts' | 'bulk-send' | 'schedule' | 'history' | 'settings';
type SettingsTab = 'general' | 'users' | 'roles';

const availablePermissions = [
  { id: 'send-now', label: 'Enviar Mensagem Agora', description: 'Permite enviar mensagens individuais imediatamente' },
  { id: 'contacts', label: 'Gerenciar Contatos', description: 'Permite cadastrar e usar contatos' },
  { id: 'bulk-send', label: 'Envio em Massa', description: 'Permite enviar mensagens para múltiplos contatos' },
  { id: 'schedule', label: 'Agendar Mensagens', description: 'Permite agendar mensagens para envio futuro' },
  { id: 'view-history', label: 'Visualizar Histórico', description: 'Permite visualizar histórico de mensagens' },
  { id: 'clear-history', label: 'Limpar Histórico', description: 'Permite limpar histórico de mensagens' },
  { id: 'manage-users', label: 'Gerenciar Usuários', description: 'Permite criar, editar e excluir usuários' },
  { id: 'manage-roles', label: 'Gerenciar Grupos', description: 'Permite criar, editar e excluir grupos de permissões' },
  { id: 'system-settings', label: 'Configurações do Sistema', description: 'Permite alterar configurações gerais do sistema' },
];

type PermissionId = (typeof availablePermissions)[number]['id'];

const allPermissionIds = availablePermissions.map((permission) => permission.id);

const pagePermissionMap: Record<Page, PermissionId[]> = {
  'send-now': ['send-now'],
  'contacts': ['contacts'],
  'bulk-send': ['bulk-send'],
  'schedule': ['schedule'],
  'history': ['view-history'],
  'settings': ['system-settings', 'manage-users', 'manage-roles'],
};

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
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [contactName, setContactName] = useState('');
  const [contactNumber, setContactNumber] = useState('');
  const [editingContactId, setEditingContactId] = useState<number | null>(null);
  const [newUser, setNewUser] = useState({ username: '', email: '', password: '', role: 'user' });
  const [newRole, setNewRole] = useState({ name: '', description: '', permissions: [] as string[] });
  const [editingUser, setEditingUser] = useState<EditableUser | null>(null);
  const [editingRole, setEditingRole] = useState<Role | null>(null);
  const [editingScheduledMessage, setEditingScheduledMessage] = useState<number | null>(null);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [bulkCampaignStatus, setBulkCampaignStatus] = useState<BulkCampaignStatus | null>(null);
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
    try {
      const res = await fetch('/api/scheduled-messages', { cache: 'no-store' });
      if (!res.ok) {
        console.error('Error fetching scheduled messages:', res.status);
        return;
      }
      const data = await res.json();
      setScheduledMessages(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error('Error fetching scheduled messages:', error);
    }
  };

  const fetchBulkCampaignStatus = async () => {
    try {
      const res = await fetch('/api/bulk-campaign/status', { cache: 'no-store' });
      if (!res.ok) {
        return;
      }
      const data = await res.json();
      setBulkCampaignStatus(data);
    } catch (error) {
      console.error('Error fetching bulk campaign status:', error);
    }
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
      fetchBulkCampaignStatus();
      fetchSettings();
      fetchUsers();
      fetchRoles();
      fetchContacts();
      const interval = setInterval(() => {
        fetchMessages();
        fetchScheduledMessages();
        fetchBulkCampaignStatus();
      }, 5000);
      return () => clearInterval(interval);
    }
  }, [isAuthenticated]);

  useEffect(() => {
    if (!isAuthenticated) return;

    const interval = setInterval(() => {
      fetchBulkCampaignStatus();
    }, 2000);

    return () => clearInterval(interval);
  }, [isAuthenticated]);

  const handleLogin = async (e: FormEvent) => {
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
      const res = await fetch('/api/users', { cache: 'no-store' });
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

  const fetchContacts = async () => {
    try {
      const res = await fetch('/api/contacts', { cache: 'no-store' });
      if (!res.ok) {
        console.error('Error fetching contacts:', res.status);
        return;
      }
      const data = await res.json();
      setContacts(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error('Error fetching contacts:', error);
    }
  };

  const resetContactForm = () => {
    setContactName('');
    setContactNumber('');
    setEditingContactId(null);
  };

  const saveContact = async () => {
    if (!contactNumber.trim()) {
      showNotification('error', 'Número do contato é obrigatório');
      return;
    }

    const payload = {
      name: contactName.trim(),
      number: contactNumber.trim(),
    };

    try {
      const url = editingContactId ? `/api/contacts/${editingContactId}` : '/api/contacts';
      const method = editingContactId ? 'PUT' : 'POST';

      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        showNotification('error', data.error || 'Erro ao salvar contato');
        return;
      }

      showNotification('success', editingContactId ? 'Contato atualizado com sucesso!' : 'Contato criado com sucesso!');
      resetContactForm();
      fetchContacts();
    } catch {
      showNotification('error', 'Erro ao salvar contato');
    }
  };

  const editContact = (contact: Contact) => {
    setEditingContactId(contact.id);
    setContactName(contact.name || '');
    setContactNumber(contact.number);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const deleteContact = async (id: number) => {
    if (!confirm('Tem certeza que deseja excluir este contato?')) return;

    try {
      const response = await fetch(`/api/contacts/${id}`, { method: 'DELETE' });
      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        showNotification('error', data.error || 'Erro ao excluir contato');
        return;
      }

      showNotification('success', 'Contato excluído com sucesso!');
      fetchContacts();

      if (editingContactId === id) {
        resetContactForm();
      }
    } catch {
      showNotification('error', 'Erro ao excluir contato');
    }
  };

  const loadContactsForBulk = () => {
    if (contacts.length === 0) {
      showNotification('error', 'Nenhum contato cadastrado para carregar');
      return;
    }

    const contactEntries = contacts.map((contact) => {
      const safeName = (contact.name || '').trim();
      return safeName ? `${safeName};${contact.number}` : contact.number;
    });

    setBulkNumbers(contactEntries);
    showNotification('success', `${contactEntries.length} contatos carregados da agenda`);
  };

  const fillSendNowWithContact = (contactId: string) => {
    const selectedContact = contacts.find((contact) => String(contact.id) === contactId);
    if (!selectedContact) return;
    setName(selectedContact.name || '');
    setNumber(selectedContact.number);
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

  const updateUser = async () => {
    if (!editingUser) return;
    if (!editingUser.username || !editingUser.email) {
      showNotification('error', 'Preencha todos os campos obrigatórios');
      return;
    }
    try {
      // Prepare data to send - include password only if it's set
      const userData: {
        username: string;
        email: string;
        role: string;
        password?: string;
      } = {
        username: editingUser.username,
        email: editingUser.email,
        role: editingUser.role
      };
      
      // Add password if it's been changed
      if (editingUser.password && editingUser.password.trim() !== '') {
        userData.password = editingUser.password;
      }
      
      console.log('Updating user with data:', { ...userData, password: userData.password ? '***' : undefined });
      
      const response = await fetch(`/api/users/${editingUser.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(userData),
      });
      
      const text = await response.text();
      console.log('Update response:', text);
      
      let data;
      try {
        data = text ? JSON.parse(text) : {};
      } catch (e) {
        showNotification('error', 'Erro ao processar resposta do servidor');
        return;
      }
      
      if (!response.ok) {
        showNotification('error', data.error || 'Erro ao atualizar usuário');
        return;
      }

      if (data?.user) {
        setUsers(prevUsers =>
          prevUsers.map(user => (user.id === data.user.id ? data.user : user))
        );
      }

      showNotification('success', 'Usuário atualizado com sucesso!');
      setEditingUser(null);
      fetchUsers();
    } catch (error: any) {
      console.error('Error updating user:', error);
      showNotification('error', error.message || 'Erro ao atualizar usuário');
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

  const toggleEditPermission = (permissionId: string) => {
    if (!editingRole) return;
    const currentPerms = editingRole.permissions.split(',').filter(p => p.trim());
    const newPerms = currentPerms.includes(permissionId)
      ? currentPerms.filter(p => p !== permissionId)
      : [...currentPerms, permissionId];
    setEditingRole({
      ...editingRole,
      permissions: newPerms.join(',')
    });
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

  const updateRole = async () => {
    if (!editingRole) return;
    if (!editingRole.name) {
      showNotification('error', 'Nome do grupo é obrigatório');
      return;
    }
    try {
      const response = await fetch(`/api/roles/${editingRole.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: editingRole.name,
          description: editingRole.description,
          permissions: editingRole.permissions
        }),
      });
      
      const text = await response.text();
      let data;
      try {
        data = text ? JSON.parse(text) : {};
      } catch (e) {
        showNotification('error', 'Erro ao processar resposta do servidor');
        return;
      }
      
      if (!response.ok) {
        showNotification('error', data.error || 'Erro ao atualizar grupo');
        return;
      }
      showNotification('success', 'Grupo atualizado com sucesso!');
      setEditingRole(null);
      fetchRoles();
    } catch (error: any) {
      showNotification('error', error.message || 'Erro ao atualizar grupo');
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
      const response = await fetch('/api/send-bulk', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ numbers: bulkNumbers, message: bulkMessage, delay }),
      });

      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        showNotification('error', data.error || 'Falha ao iniciar envio em massa.');
        return;
      }

      showNotification('success', 'Envio em massa iniciado!');
      fetchBulkCampaignStatus();
      fetchMessages();
    } catch {
      showNotification('error', 'Falha ao iniciar envio em massa.');
    }
  };

  const stopBulkCampaign = async () => {
    try {
      const response = await fetch('/api/bulk-campaign/stop', {
        method: 'POST',
      });

      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        showNotification('error', data.error || 'Não foi possível parar a campanha.');
        return;
      }

      showNotification('success', 'Solicitação para parar campanha enviada.');
      fetchBulkCampaignStatus();
    } catch {
      showNotification('error', 'Falha ao parar campanha.');
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
      // Converter o horário local para ISO UTC
      const localDate = new Date(scheduledAt);
      const utcDate = localDate.toISOString();
      
      if (editingScheduledMessage) {
        // Editando uma mensagem existente
        const response = await fetch(`/api/scheduled-messages/${editingScheduledMessage}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name: scheduledName, number: scheduledNumber, message: scheduledMessage, scheduledAt: utcDate }),
        });

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          throw new Error(errorData.error || 'Falha ao atualizar mensagem.');
        }

        showNotification('success', 'Mensagem atualizada com sucesso!');
        setEditingScheduledMessage(null);
      } else {
        // Criando uma nova mensagem
        const response = await fetch('/api/schedule', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name: scheduledName, number: scheduledNumber, message: scheduledMessage, scheduledAt: utcDate }),
        });

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          throw new Error(errorData.error || 'Falha ao agendar mensagem.');
        }

        showNotification('success', 'Mensagem agendada com sucesso!');
      }
      await fetchScheduledMessages();
      setScheduledName('');
      setScheduledNumber('');
      setScheduledMessage('');
      setScheduledAt('');
    } catch (error: any) {
      showNotification('error', error?.message || (editingScheduledMessage ? 'Falha ao atualizar mensagem.' : 'Falha ao agendar mensagem.'));
    }
  };

  const editScheduledMessage = (msg: ScheduledMessage) => {
    setScheduledName(msg.name || '');
    setScheduledNumber(msg.number);
    setScheduledMessage(msg.message);
    
    // Converter de UTC para o formato datetime-local
    const utcDate = new Date(msg.scheduled_at);
    const localDateString = new Date(utcDate.getTime() - utcDate.getTimezoneOffset() * 60000)
      .toISOString()
      .slice(0, 16);
    setScheduledAt(localDateString);
    
    setEditingScheduledMessage(msg.id);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const cancelEditScheduledMessage = () => {
    setEditingScheduledMessage(null);
    setScheduledName('');
    setScheduledNumber('');
    setScheduledMessage('');
    setScheduledAt('');
  };

  const deleteScheduledMessage = async (id: number) => {
    if (!confirm('Tem certeza que deseja excluir este agendamento?')) {
      return;
    }
    try {
      await fetch(`/api/scheduled-messages/${id}`, {
        method: 'DELETE',
      });
      showNotification('success', 'Agendamento excluído com sucesso!');
      fetchScheduledMessages();
      if (editingScheduledMessage === id) {
        cancelEditScheduledMessage();
      }
    } catch {
      showNotification('error', 'Falha ao excluir agendamento.');
    }
  };

  const clearHistory = async () => {
    await fetch('/api/messages/clear', { method: 'POST' });
    fetchMessages();
    showNotification('success', 'Histórico limpo!');
  };

  const normalizePermissions = (permissions?: string) =>
    (permissions || '')
      .split(',')
      .map((permission) => permission.trim())
      .filter(Boolean);

  const getCurrentUserPermissions = (): string[] => {
    if (!currentUser) return [];

    if (currentUser.role === 'admin') {
      return allPermissionIds;
    }

    const rolePermissions = roles.find(role => role.name === currentUser.role)?.permissions;
    const permissionsFromRole = normalizePermissions(rolePermissions);

    if (permissionsFromRole.length > 0) {
      return permissionsFromRole;
    }

    return normalizePermissions(currentUser.permissions);
  };

  const currentUserPermissions = getCurrentUserPermissions();

  const hasPermission = (permissionId: PermissionId) => currentUserPermissions.includes(permissionId);

  const canAccessPage = (page: Page) => pagePermissionMap[page].some(hasPermission);

  const canAccessSettingsTab = (tab: SettingsTab) => {
    if (tab === 'general') return hasPermission('system-settings');
    if (tab === 'users') return hasPermission('manage-users');
    if (tab === 'roles') return hasPermission('manage-roles');
    return false;
  };

  const menuItems = [
    { id: 'send-now' as Page, icon: Send, label: 'Nova Mensagem', color: 'text-emerald-600', description: 'Compositor individual' },
    { id: 'contacts' as Page, icon: UserPlus, label: 'Contatos', color: 'text-emerald-600', description: 'Agenda para envios' },
    { id: 'bulk-send' as Page, icon: Users, label: 'Campanhas', color: 'text-emerald-600', description: 'Envio em massa' },
    { id: 'schedule' as Page, icon: Clock, label: 'Agendamentos', color: 'text-emerald-600', description: 'Fila de envio' },
    { id: 'history' as Page, icon: History, label: 'Histórico', color: 'text-slate-600', description: 'Mensagens enviadas' },
    { id: 'settings' as Page, icon: Settings, label: 'Configurações', color: 'text-slate-600', description: 'Sistema e acessos' },
  ];

  const accessibleMenuItems = menuItems.filter(item => canAccessPage(item.id));

  useEffect(() => {
    if (!isAuthenticated) return;
    if (accessibleMenuItems.length === 0) return;

    const hasActivePageAccess = accessibleMenuItems.some(item => item.id === activePage);
    if (!hasActivePageAccess) {
      setActivePage(accessibleMenuItems[0].id);
    }
  }, [isAuthenticated, activePage, accessibleMenuItems]);

  useEffect(() => {
    if (!isAuthenticated || activePage !== 'settings') return;
    if (canAccessSettingsTab(settingsTab)) return;

    if (canAccessSettingsTab('general')) {
      setSettingsTab('general');
      return;
    }

    if (canAccessSettingsTab('users')) {
      setSettingsTab('users');
      return;
    }

    if (canAccessSettingsTab('roles')) {
      setSettingsTab('roles');
    }
  }, [isAuthenticated, activePage, settingsTab, currentUserPermissions.join(',')]);

  useEffect(() => {
    setIsMobileMenuOpen(false);
  }, [activePage]);

  const renderPage = () => {
    if (!canAccessPage(activePage)) {
      return (
        <div className="bg-white rounded-xl shadow-lg p-8 max-w-2xl mx-auto text-center">
          <AlertCircle className="w-8 h-8 text-amber-500 mx-auto mb-3" />
          <h2 className="text-xl font-bold text-gray-800 mb-2">Acesso não permitido</h2>
          <p className="text-gray-600">Você não tem permissão para visualizar esta página.</p>
        </div>
      );
    }

    switch (activePage) {
      case 'send-now':
        return (
          <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
            <div className="xl:col-span-2 space-y-6">
              <div className="bg-white border border-slate-200 rounded-2xl p-4 sm:p-6 shadow-sm">
                <h2 className="text-lg sm:text-xl font-black text-slate-900 mb-1">Nova Mensagem</h2>
                <p className="text-sm text-slate-500">Envio rápido com preview em tempo real.</p>
              </div>

              <section className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4 sm:p-6 space-y-4">
                <h3 className="text-xs tracking-[0.16em] uppercase font-bold text-slate-400">Detalhes do Destinatário</h3>
                <div>
                  <label className="text-sm font-medium text-slate-700 block mb-2">Selecionar contato salvo</label>
                  <select
                    className="w-full rounded-xl border-slate-200 bg-slate-50 text-sm focus:border-emerald-500 focus:ring-emerald-500"
                    onChange={(e) => fillSendNowWithContact(e.target.value)}
                    defaultValue=""
                  >
                    <option value="">Escolha um contato...</option>
                    {contacts.map((contact) => (
                      <option key={contact.id} value={contact.id}>
                        {(contact.name || 'Sem nome')} - {contact.number}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="text-sm font-medium text-slate-700 block mb-2">Nome do contato</label>
                    <input
                      className="w-full rounded-xl border-slate-200 bg-slate-50 text-sm focus:border-emerald-500 focus:ring-emerald-500"
                      placeholder="Ex: João Silva"
                      value={name}
                      onChange={e => setName(e.target.value)}
                    />
                  </div>
                  <div>
                    <label className="text-sm font-medium text-slate-700 block mb-2">Número WhatsApp</label>
                    <input
                      className="w-full rounded-xl border-slate-200 bg-slate-50 text-sm font-mono focus:border-emerald-500 focus:ring-emerald-500"
                      placeholder="5511999999999"
                      value={number}
                      onChange={e => setNumber(e.target.value)}
                    />
                  </div>
                </div>
              </section>

              <section className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4 sm:p-6 space-y-4">
                <h3 className="text-xs tracking-[0.16em] uppercase font-bold text-slate-400">Escrever Mensagem</h3>
                <textarea
                  className="w-full min-h-[220px] rounded-xl border-slate-200 bg-slate-50 text-sm leading-relaxed focus:border-emerald-500 focus:ring-emerald-500"
                  placeholder="Digite sua mensagem aqui... use {{name}} para personalizar."
                  value={message}
                  onChange={e => setMessage(e.target.value)}
                />
                <div className="flex flex-wrap gap-3">
                  <button className="px-4 py-2 rounded-xl bg-slate-100 text-xs font-semibold text-slate-700">+ Imagem</button>
                  <button className="px-4 py-2 rounded-xl bg-slate-100 text-xs font-semibold text-slate-700">+ PDF</button>
                  <button className="px-4 py-2 rounded-xl bg-slate-100 text-xs font-semibold text-slate-700">+ Vídeo</button>
                </div>
              </section>

              <section className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4 sm:p-6">
                <h3 className="text-xs tracking-[0.16em] uppercase font-bold text-slate-400 mb-4">Agendamento de Envio</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4">
                    <p className="font-semibold text-slate-900 text-sm">Enviar Imediatamente</p>
                    <p className="text-xs text-slate-500 mt-1">A mensagem será enviada agora.</p>
                  </div>
                  <button
                    onClick={() => setActivePage('schedule')}
                    className="rounded-xl border border-slate-200 bg-white p-4 text-left hover:border-emerald-300 transition"
                  >
                    <p className="font-semibold text-slate-900 text-sm">Agendar para depois</p>
                    <p className="text-xs text-slate-500 mt-1">Ir para a fila de agendamentos.</p>
                  </button>
                </div>
              </section>

              <button
                className="w-full h-12 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-slate-900 font-bold transition flex items-center justify-center gap-2"
                onClick={sendNow}
              >
                <Rocket className="w-4 h-4" />
                Enviar Campanha
              </button>
            </div>

            <aside className="space-y-4">
              <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5">
                <h3 className="font-bold text-slate-800 mb-4">Resumo da Campanha</h3>
                <div className="space-y-3 text-sm">
                  <div className="flex justify-between"><span className="text-slate-500">Contato</span><span className="font-semibold">{name || 'Não definido'}</span></div>
                  <div className="flex justify-between"><span className="text-slate-500">Número</span><span className="font-semibold">{number || '-'}</span></div>
                  <div className="flex justify-between"><span className="text-slate-500">Tipo</span><span className="font-semibold">Texto</span></div>
                  <div className="flex justify-between"><span className="text-slate-500">Tamanho</span><span className="font-semibold">{message.length} caracteres</span></div>
                </div>
              </div>
              <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5">
                <p className="text-xs font-bold tracking-[0.14em] uppercase text-slate-400 mb-4 text-center">Pré-visualização ao Vivo</p>
                <div className="max-w-[280px] mx-auto rounded-[2rem] border-[7px] border-slate-800 bg-slate-100 overflow-hidden">
                  <div className="bg-[#075e54] text-white p-3 text-xs font-semibold">{name || 'Contato'}</div>
                  <div className="p-3 min-h-[260px] bg-[#e5ddd5]">
                    <div className="ml-auto max-w-[85%] bg-[#d9fdd3] rounded-lg rounded-tr-sm px-3 py-2 text-xs leading-relaxed text-slate-800 shadow-sm whitespace-pre-wrap">
                      {message || 'Sua mensagem vai aparecer aqui.'}
                    </div>
                  </div>
                  <div className="h-12 bg-white px-3 flex items-center justify-between text-slate-400">
                    <Smartphone className="w-4 h-4" />
                    <div className="h-2 w-32 rounded-full bg-slate-200" />
                  </div>
                </div>
              </div>
            </aside>
          </div>
        );

      case 'bulk-send':
        return (
          <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
            <div className="xl:col-span-2 space-y-6">
              <div>
                <h2 className="text-3xl font-black text-slate-900">Criar Nova Campanha</h2>
                <p className="text-slate-500 mt-1">Alcance seus clientes diretamente no WhatsApp com envio em massa.</p>
              </div>

              <section className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                <div className="p-5 sm:p-6 border-b border-slate-100 flex items-center justify-between">
                  <h3 className="font-bold text-slate-900">1. Selecionar Contatos Alvo</h3>
                  <button className="text-emerald-500 text-sm font-semibold">Baixar Modelo CSV</button>
                </div>
                <div className="p-5 sm:p-6 space-y-4">
                  <label className="border-2 border-dashed border-slate-200 rounded-2xl p-8 sm:p-10 text-center bg-slate-50 block cursor-pointer hover:border-emerald-300 transition">
                    <Upload className="w-10 h-10 mx-auto text-emerald-500 mb-3" />
                    <p className="font-semibold text-slate-800">Upload CSV ou TXT</p>
                    <p className="text-sm text-slate-500 mt-1">Arraste o arquivo ou clique para selecionar.</p>
                    <p className="text-xs text-slate-400 mt-3">Suporte atual: .txt (um número por linha)</p>
                    <input type="file" className="hidden" onChange={handleFileUpload} accept=".txt" />
                  </label>

                  {bulkNumbers.length > 0 && (
                    <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm">
                      <p className="font-semibold text-emerald-800">{bulkNumbers.length} contatos carregados</p>
                      <p className="text-emerald-700 font-mono text-xs mt-1 break-all">{bulkNumbers.slice(0, 4).join(', ')}{bulkNumbers.length > 4 ? '...' : ''}</p>
                    </div>
                  )}

                  <div>
                    <label className="text-sm font-medium text-slate-700 block mb-2">Selecionar lista existente</label>
                    <div className="flex flex-col sm:flex-row gap-2">
                      <button
                        onClick={loadContactsForBulk}
                        className="px-4 py-2 rounded-xl bg-emerald-100 hover:bg-emerald-200 text-emerald-800 text-sm font-semibold transition"
                      >
                        Carregar contatos cadastrados ({contacts.length})
                      </button>
                      <button
                        onClick={() => setActivePage('contacts')}
                        className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-sm font-semibold transition"
                      >
                        Gerenciar contatos
                      </button>
                    </div>
                  </div>
                </div>
              </section>

              <section className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                <div className="p-5 sm:p-6 border-b border-slate-100">
                  <h3 className="font-bold text-slate-900">2. Escrever Mensagem</h3>
                </div>
                <div className="p-5 sm:p-6 grid gap-4">
                  <textarea
                    className="w-full min-h-[170px] rounded-xl border-slate-200 bg-slate-50 text-sm leading-relaxed focus:border-emerald-500 focus:ring-emerald-500"
                    placeholder="Mensagem para todos os contatos... use {{name}} para personalizar."
                    value={bulkMessage}
                    onChange={e => setBulkMessage(e.target.value)}
                  />
                  <div>
                    <label className="text-sm font-medium text-slate-700 block mb-2">Intervalo entre mensagens</label>
                    <div className="flex items-center gap-3">
                      <input
                        type="number"
                        className="w-full rounded-xl border-slate-200 bg-slate-50 text-sm focus:border-emerald-500 focus:ring-emerald-500"
                        value={delay}
                        onChange={e => setDelay(Number(e.target.value))}
                        min="1"
                      />
                      <span className="text-sm text-slate-500">segundos</span>
                    </div>
                  </div>
                </div>
              </section>

              <section className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                <div className="p-5 sm:p-6 border-b border-slate-100">
                  <h3 className="font-bold text-slate-900">3. Agendar Campanha</h3>
                </div>
                <div className="p-5 sm:p-6 grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4">
                    <p className="font-semibold text-slate-900">Enviar imediatamente</p>
                    <p className="text-xs text-slate-500 mt-1">As mensagens começam após o lançamento.</p>
                  </div>
                  <button
                    onClick={() => setActivePage('schedule')}
                    className="rounded-xl border border-slate-200 p-4 text-left hover:border-emerald-300 transition"
                  >
                    <p className="font-semibold text-slate-900">Agendar para depois</p>
                    <p className="text-xs text-slate-500 mt-1">Gerencie horários na tela de agendamento.</p>
                  </button>
                </div>
              </section>

              {bulkCampaignStatus && bulkCampaignStatus.total > 0 && (
                <section className={`rounded-2xl border p-4 sm:p-5 ${bulkCampaignStatus.isRunning ? 'border-amber-200 bg-amber-50' : 'border-emerald-200 bg-emerald-50'}`}>
                  <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
                    <p className="font-bold text-slate-900 text-sm">
                      {bulkCampaignStatus.isRunning ? 'Campanha em andamento' : 'Última campanha finalizada'}
                    </p>
                    <span className={`px-2 py-1 rounded-full text-xs font-semibold ${bulkCampaignStatus.isRunning ? 'bg-amber-100 text-amber-700' : 'bg-emerald-100 text-emerald-700'}`}>
                      {bulkCampaignStatus.isRunning
                        ? (bulkCampaignStatus.stopRequested ? 'Parando...' : 'Rodando')
                        : 'Concluída'}
                    </span>
                  </div>

                  <div className="h-2 w-full rounded-full bg-white/80 border border-slate-200 overflow-hidden">
                    <div
                      className={`h-full transition-all ${bulkCampaignStatus.isRunning ? 'bg-amber-500' : 'bg-emerald-500'}`}
                      style={{ width: `${bulkCampaignStatus.progress}%` }}
                    />
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-3 text-xs sm:text-sm">
                    <div><p className="text-slate-500">Processadas</p><p className="font-bold text-slate-900">{bulkCampaignStatus.processed}/{bulkCampaignStatus.total}</p></div>
                    <div><p className="text-slate-500">Enviadas</p><p className="font-bold text-emerald-700">{bulkCampaignStatus.sent}</p></div>
                    <div><p className="text-slate-500">Falhas</p><p className="font-bold text-red-600">{bulkCampaignStatus.failed}</p></div>
                    <div><p className="text-slate-500">Progresso</p><p className="font-bold text-slate-900">{bulkCampaignStatus.progress}%</p></div>
                  </div>
                </section>
              )}

              <div className="flex flex-col sm:flex-row gap-3">
                <button
                  className="flex-1 h-12 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-slate-900 font-bold transition disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                  onClick={sendBulk}
                  disabled={bulkNumbers.length === 0 || !!bulkCampaignStatus?.isRunning}
                >
                  <Rocket className="w-4 h-4" />
                  {bulkCampaignStatus?.isRunning ? 'Campanha em execução' : `Iniciar Campanha (${bulkNumbers.length})`}
                </button>
                <button
                  className="h-12 px-5 rounded-xl bg-slate-200 hover:bg-slate-300 text-slate-700 font-semibold transition disabled:opacity-60"
                  onClick={() => setBulkNumbers([])}
                  disabled={bulkNumbers.length === 0 || !!bulkCampaignStatus?.isRunning}
                >
                  Limpar Lista
                </button>
                <button
                  className="h-12 px-5 rounded-xl bg-red-500 hover:bg-red-600 text-white font-semibold transition disabled:opacity-60 disabled:cursor-not-allowed"
                  onClick={stopBulkCampaign}
                  disabled={!bulkCampaignStatus?.isRunning || !!bulkCampaignStatus?.stopRequested}
                >
                  {bulkCampaignStatus?.stopRequested ? 'Parando...' : 'Parar Campanha'}
                </button>
              </div>
            </div>

            <aside className="space-y-6">
              <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5">
                <h3 className="font-bold text-slate-800 mb-4">Resumo da Campanha</h3>
                <div className="space-y-3 text-sm">
                  <div className="flex justify-between"><span className="text-slate-500">Público</span><span className="font-semibold">{bulkCampaignStatus?.isRunning ? bulkCampaignStatus.total : bulkNumbers.length} contatos</span></div>
                  <div className="flex justify-between"><span className="text-slate-500">Tipo de Mensagem</span><span className="font-semibold">Texto</span></div>
                  <div className="flex justify-between"><span className="text-slate-500">Intervalo</span><span className="font-semibold">{delay}s</span></div>
                  <div className="flex justify-between"><span className="text-slate-500">Status</span><span className="font-semibold">{bulkCampaignStatus?.isRunning ? 'Em andamento' : 'Parada'}</span></div>
                  <div className="pt-3 border-t border-slate-100 flex justify-between text-base">
                    <span className="font-semibold text-slate-900">Progresso</span>
                    <span className="font-black text-emerald-600">{bulkCampaignStatus?.progress ?? 0}%</span>
                  </div>
                </div>
              </div>
              <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                <div className="px-4 py-2 bg-slate-100 border-b border-slate-200 text-xs font-bold text-slate-500">PRÉVIA</div>
                <div className="p-4 bg-[#e5ddd5] min-h-[260px] flex items-end">
                  <div className="bg-white rounded-lg rounded-tl-none shadow-sm p-3 max-w-[90%]">
                    <p className="text-sm text-slate-800 break-words">{bulkMessage || 'Prévia da mensagem da campanha.'}</p>
                    <p className="text-[10px] text-slate-400 text-right mt-1">10:45</p>
                  </div>
                </div>
              </div>
            </aside>
          </div>
        );

      case 'contacts':
        return (
          <div className="space-y-6">
            <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
              <div className="xl:col-span-2 bg-white rounded-2xl border border-slate-200 shadow-sm p-4 sm:p-6 space-y-4">
                <div className="flex items-center justify-between gap-3">
                  <h2 className="text-xl sm:text-2xl font-black text-slate-900">
                    {editingContactId ? 'Editar Contato' : 'Novo Contato'}
                  </h2>
                  {editingContactId && (
                    <button
                      className="px-3 py-2 rounded-lg bg-slate-200 hover:bg-slate-300 text-slate-700 text-sm font-semibold"
                      onClick={resetContactForm}
                    >
                      Cancelar edição
                    </button>
                  )}
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="text-sm font-medium text-slate-700 block mb-2">Nome</label>
                    <input
                      className="w-full rounded-xl border-slate-200 bg-slate-50 text-sm focus:border-emerald-500 focus:ring-emerald-500"
                      value={contactName}
                      onChange={e => setContactName(e.target.value)}
                      placeholder="Nome do contato"
                    />
                  </div>
                  <div>
                    <label className="text-sm font-medium text-slate-700 block mb-2">Número WhatsApp</label>
                    <input
                      className="w-full rounded-xl border-slate-200 bg-slate-50 text-sm font-mono focus:border-emerald-500 focus:ring-emerald-500"
                      value={contactNumber}
                      onChange={e => setContactNumber(e.target.value)}
                      placeholder="5511999999999"
                    />
                  </div>
                </div>

                <button
                  className="w-full h-12 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-slate-900 font-bold transition flex items-center justify-center gap-2"
                  onClick={saveContact}
                >
                  <UserPlus className="w-4 h-4" />
                  {editingContactId ? 'Atualizar Contato' : 'Salvar Contato'}
                </button>
              </div>

              <aside className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5 h-fit">
                <h3 className="font-bold text-slate-900 mb-4">Resumo</h3>
                <div className="space-y-3 text-sm">
                  <div className="flex justify-between"><span className="text-slate-500">Total de contatos</span><span className="font-semibold">{contacts.length}</span></div>
                  <div className="flex justify-between"><span className="text-slate-500">Uso rápido</span><span className="font-semibold">Nova Mensagem</span></div>
                  <div className="flex justify-between"><span className="text-slate-500">Uso em massa</span><span className="font-semibold">Campanhas</span></div>
                </div>
              </aside>
            </div>

            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4 sm:p-6">
              <h3 className="font-semibold text-slate-800 mb-4 text-lg">Contatos Cadastrados ({contacts.length})</h3>
              <div className="overflow-x-auto -mx-4 sm:mx-0">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-slate-200 bg-slate-50">
                      <th className="p-3 text-left text-xs sm:text-sm font-semibold text-slate-700">Nome</th>
                      <th className="p-3 text-left text-xs sm:text-sm font-semibold text-slate-700">Número</th>
                      <th className="p-3 text-left text-xs sm:text-sm font-semibold text-slate-700">Criado em</th>
                      <th className="p-3 text-center text-xs sm:text-sm font-semibold text-slate-700">Ações</th>
                    </tr>
                  </thead>
                  <tbody>
                    {contacts.length === 0 ? (
                      <tr>
                        <td colSpan={4} className="p-4 text-center text-sm text-slate-500">
                          Nenhum contato cadastrado.
                        </td>
                      </tr>
                    ) : (
                      contacts.map(contact => (
                        <tr key={contact.id} className="border-b border-slate-100 hover:bg-slate-50 transition">
                          <td className="p-3 text-sm text-slate-700">{contact.name || '-'}</td>
                          <td className="p-3 text-sm text-slate-700 font-mono">{contact.number}</td>
                          <td className="p-3 text-sm text-slate-500">
                            {new Date(contact.created_at.includes('Z') || contact.created_at.includes('+') ? contact.created_at : contact.created_at + 'Z').toLocaleString('pt-BR', {
                              timeZone: timezone,
                              day: '2-digit',
                              month: '2-digit',
                              year: 'numeric',
                              hour: '2-digit',
                              minute: '2-digit'
                            })}
                          </td>
                          <td className="p-3">
                            <div className="flex items-center justify-center gap-2">
                              <button
                                onClick={() => editContact(contact)}
                                className="p-2 bg-slate-700 hover:bg-slate-800 text-white rounded-lg transition shadow-sm"
                                title="Editar"
                              >
                                <Edit2 className="w-4 h-4" />
                              </button>
                              <button
                                onClick={() => deleteContact(contact.id)}
                                className="p-2 bg-red-500 hover:bg-red-600 text-white rounded-lg transition shadow-sm"
                                title="Excluir"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        );

      case 'schedule':
        return (
          <div className="space-y-6">
            <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
              <div className="xl:col-span-2 bg-white rounded-2xl border border-slate-200 shadow-sm p-4 sm:p-6 space-y-4">
                <div className="flex items-center justify-between gap-3">
                  <h2 className="text-xl sm:text-2xl font-black text-slate-900">
                    {editingScheduledMessage ? 'Editar Agendamento' : 'Agendar Campanha'}
                  </h2>
                  {editingScheduledMessage && (
                    <button
                      className="px-3 py-2 rounded-lg bg-slate-200 hover:bg-slate-300 text-slate-700 text-sm font-semibold"
                      onClick={cancelEditScheduledMessage}
                    >
                      Cancelar edição
                    </button>
                  )}
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="text-sm font-medium text-slate-700 block mb-2">Nome</label>
                    <input
                      className="w-full rounded-xl border-slate-200 bg-slate-50 text-sm focus:border-emerald-500 focus:ring-emerald-500"
                      value={scheduledName}
                      onChange={e => setScheduledName(e.target.value)}
                      placeholder="Nome do contato"
                    />
                  </div>
                  <div>
                    <label className="text-sm font-medium text-slate-700 block mb-2">Número</label>
                    <input
                      className="w-full rounded-xl border-slate-200 bg-slate-50 text-sm font-mono focus:border-emerald-500 focus:ring-emerald-500"
                      value={scheduledNumber}
                      onChange={e => setScheduledNumber(e.target.value)}
                      placeholder="5511999999999"
                    />
                  </div>
                </div>

                <div>
                  <label className="text-sm font-medium text-slate-700 block mb-2">Mensagem</label>
                  <textarea
                    className="w-full min-h-[140px] rounded-xl border-slate-200 bg-slate-50 text-sm focus:border-emerald-500 focus:ring-emerald-500"
                    value={scheduledMessage}
                    onChange={e => setScheduledMessage(e.target.value)}
                    placeholder="Mensagem do agendamento"
                  />
                </div>

                <div>
                  <label className="text-sm font-medium text-slate-700 block mb-2">Data e hora</label>
                  <input
                    type="datetime-local"
                    className="w-full rounded-xl border-slate-200 bg-slate-50 text-sm focus:border-emerald-500 focus:ring-emerald-500"
                    value={scheduledAt}
                    onChange={e => setScheduledAt(e.target.value)}
                  />
                </div>

                <button
                  className="w-full h-12 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-slate-900 font-bold transition flex items-center justify-center gap-2"
                  onClick={scheduleMessage}
                >
                  <Clock className="w-4 h-4" />
                  {editingScheduledMessage ? 'Atualizar Agendamento' : 'Salvar Agendamento'}
                </button>
              </div>

              <aside className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5 h-fit">
                <h3 className="font-bold text-slate-900 mb-4">Resumo</h3>
                <div className="space-y-3 text-sm">
                  <div className="flex justify-between"><span className="text-slate-500">Fila total</span><span className="font-semibold">{scheduledMessages.length}</span></div>
                  <div className="flex justify-between"><span className="text-slate-500">Fuso horário</span><span className="font-semibold">{timezone}</span></div>
                  <div className="flex justify-between"><span className="text-slate-500">Status edição</span><span className="font-semibold">{editingScheduledMessage ? 'Ativa' : 'Nova'}</span></div>
                </div>
              </aside>
            </div>
            
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4 sm:p-6">
              <h3 className="font-semibold text-slate-800 mb-4 text-lg">Mensagens Agendadas ({scheduledMessages.length})</h3>
              <div className="overflow-x-auto -mx-4 sm:mx-0">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-slate-200 bg-slate-50">
                      <th className="p-3 text-left text-xs sm:text-sm font-semibold text-slate-700">Nome</th>
                      <th className="p-3 text-left text-xs sm:text-sm font-semibold text-slate-700">Número</th>
                      <th className="p-3 text-left text-xs sm:text-sm font-semibold text-slate-700">Mensagem</th>
                      <th className="p-3 text-left text-xs sm:text-sm font-semibold text-slate-700">Hora</th>
                      <th className="p-3 text-left text-xs sm:text-sm font-semibold text-slate-700">Status</th>
                      <th className="p-3 text-center text-xs sm:text-sm font-semibold text-slate-700">Ações</th>
                    </tr>
                  </thead>
                  <tbody>
                    {scheduledMessages.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="p-4 text-center text-sm text-slate-500">
                          Nenhum agendamento encontrado.
                        </td>
                      </tr>
                    ) : (
                      scheduledMessages.map(msg => (
                        <tr key={msg.id} className="border-b border-slate-100 hover:bg-slate-50 transition">
                          <td className="p-3 text-sm text-slate-700">{msg.name || '-'}</td>
                          <td className="p-3 text-sm text-slate-700 font-mono">{msg.number}</td>
                          <td className="p-3 text-sm text-slate-600 max-w-xs truncate">{msg.message}</td>
                          <td className="p-3 text-sm text-slate-500 whitespace-nowrap">
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
                              msg.status === 'Agendado' ? 'bg-emerald-100 text-emerald-700' : 
                              msg.status === 'Enviado' ? 'bg-green-100 text-green-700' : 
                              'bg-yellow-100 text-yellow-700'
                            }`}>
                              {msg.status}
                            </span>
                          </td>
                          <td className="p-3">
                            <div className="flex items-center justify-center gap-2">
                              <button
                                onClick={() => editScheduledMessage(msg)}
                                className="p-2 bg-slate-700 hover:bg-slate-800 text-white rounded-lg transition shadow-sm"
                                title="Editar"
                              >
                                <Edit2 className="w-4 h-4" />
                              </button>
                              <button
                                onClick={() => deleteScheduledMessage(msg.id)}
                                className="p-2 bg-red-500 hover:bg-red-600 text-white rounded-lg transition shadow-sm"
                                title="Excluir"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
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
              {hasPermission('clear-history') && (
                <button 
                  className="p-2 px-4 bg-red-500 hover:bg-red-600 text-white text-sm rounded-lg transition flex items-center gap-2 shadow-md" 
                  onClick={clearHistory}
                >
                  <Trash2 className="w-4 h-4" />
                  Limpar Histórico
                </button>
              )}
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
                            {msg.status === 'sent' ? 'Enviado' : msg.status === 'delivered' ? 'Entregue' : msg.status}
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
              {canAccessSettingsTab('general') && (
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
              )}
              {canAccessSettingsTab('users') && (
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
              )}
              {canAccessSettingsTab('roles') && (
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
              )}
            </div>

            {!canAccessSettingsTab('general') && !canAccessSettingsTab('users') && !canAccessSettingsTab('roles') && (
              <div className="p-4 rounded-lg bg-yellow-50 border border-yellow-200 text-yellow-800">
                Você não tem permissões para as seções de configurações.
              </div>
            )}

            {/* Tab Content */}
            {settingsTab === 'general' && canAccessSettingsTab('general') && (
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

            {settingsTab === 'users' && canAccessSettingsTab('users') && (
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

                {/* Edit User Modal */}
                {editingUser && (
                  <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
                    <div className="bg-white rounded-xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
                      <div className="p-6 border-b border-gray-200 flex justify-between items-center">
                        <h3 className="text-xl font-semibold text-gray-800 flex items-center gap-2">
                          <Edit2 className="w-5 h-5 text-blue-600" />
                          Editar Usuário
                        </h3>
                        <button 
                          onClick={() => setEditingUser(null)}
                          className="text-gray-400 hover:text-gray-600 transition"
                        >
                          <X className="w-6 h-6" />
                        </button>
                      </div>
                      <div className="p-6">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Nome de Usuário</label>
                            <input
                              className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                              value={editingUser.username}
                              onChange={e => setEditingUser({ ...editingUser, username: e.target.value })}
                            />
                          </div>
                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                            <input
                              type="email"
                              className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                              value={editingUser.email}
                              onChange={e => setEditingUser({ ...editingUser, email: e.target.value })}
                            />
                          </div>
                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                              Nova Senha <span className="text-xs text-gray-500">(deixe vazio para não alterar)</span>
                            </label>
                            <input
                              type="password"
                              className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                              value={editingUser.password || ''}
                              onChange={e => setEditingUser({ ...editingUser, password: e.target.value })}
                              placeholder="••••••••"
                            />
                          </div>
                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Grupo</label>
                            <select
                              className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                              value={editingUser.role}
                              onChange={e => setEditingUser({ ...editingUser, role: e.target.value })}
                            >
                              <option value="user">Usuário</option>
                              <option value="admin">Administrador</option>
                              {roles.map(role => (
                                <option key={role.id} value={role.name}>{role.name}</option>
                              ))}
                            </select>
                          </div>
                        </div>
                        <div className="flex gap-3 mt-6">
                          <button
                            onClick={updateUser}
                            className="flex-1 px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition shadow-md"
                          >
                            Salvar Alterações
                          </button>
                          <button
                            onClick={() => setEditingUser(null)}
                            className="px-6 py-3 bg-gray-200 hover:bg-gray-300 text-gray-700 rounded-lg font-medium transition"
                          >
                            Cancelar
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

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
                              <div className="flex gap-2">
                                <button
                                  onClick={() => setEditingUser({ ...user, password: '' })}
                                  className="text-blue-600 hover:text-blue-800 transition"
                                  title="Editar usuário"
                                >
                                  <Edit2 className="w-4 h-4" />
                                </button>
                                <button
                                  onClick={() => deleteUser(user.id)}
                                  className="text-red-600 hover:text-red-800 transition"
                                  title="Excluir usuário"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </button>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            )}

            {settingsTab === 'roles' && canAccessSettingsTab('roles') && (
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

                {/* Edit Role Modal */}
                {editingRole && (
                  <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
                    <div className="bg-white rounded-xl shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
                      <div className="p-6 border-b border-gray-200 flex justify-between items-center">
                        <h3 className="text-xl font-semibold text-gray-800 flex items-center gap-2">
                          <Edit2 className="w-5 h-5 text-blue-600" />
                          Editar Grupo de Permissões
                        </h3>
                        <button 
                          onClick={() => setEditingRole(null)}
                          className="text-gray-400 hover:text-gray-600 transition"
                        >
                          <X className="w-6 h-6" />
                        </button>
                      </div>
                      <div className="p-6">
                        <div className="space-y-4">
                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Nome do Grupo</label>
                            <input
                              className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                              value={editingRole.name}
                              onChange={e => setEditingRole({ ...editingRole, name: e.target.value })}
                            />
                          </div>
                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Descrição</label>
                            <input
                              className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                              value={editingRole.description}
                              onChange={e => setEditingRole({ ...editingRole, description: e.target.value })}
                            />
                          </div>
                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-3">Permissões</label>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                              {availablePermissions.map(permission => {
                                const currentPerms = editingRole.permissions.split(',').filter(p => p.trim());
                                return (
                                  <div
                                    key={permission.id}
                                    className="flex items-start gap-3 p-3 border border-gray-200 rounded-lg hover:bg-blue-50 transition cursor-pointer"
                                    onClick={() => toggleEditPermission(permission.id)}
                                  >
                                    <input
                                      type="checkbox"
                                      checked={currentPerms.includes(permission.id)}
                                      onChange={() => toggleEditPermission(permission.id)}
                                      className="mt-1 w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                                      onClick={(e) => e.stopPropagation()}
                                    />
                                    <div className="flex-1">
                                      <p className="text-sm font-medium text-gray-800">{permission.label}</p>
                                      <p className="text-xs text-gray-500 mt-1">{permission.description}</p>
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                            <p className="text-xs text-gray-500 mt-2">
                              {editingRole.permissions.split(',').filter(p => p.trim()).length} permiss{editingRole.permissions.split(',').filter(p => p.trim()).length !== 1 ? 'ões' : 'ão'} selecionada{editingRole.permissions.split(',').filter(p => p.trim()).length !== 1 ? 's' : ''}
                            </p>
                          </div>
                        </div>
                        <div className="flex gap-3 mt-6">
                          <button
                            onClick={updateRole}
                            className="flex-1 px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition shadow-md"
                          >
                            Salvar Alterações
                          </button>
                          <button
                            onClick={() => setEditingRole(null)}
                            className="px-6 py-3 bg-gray-200 hover:bg-gray-300 text-gray-700 rounded-lg font-medium transition"
                          >
                            Cancelar
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

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
                              <div className="flex gap-2">
                                <button
                                  onClick={() => setEditingRole(role)}
                                  className="text-blue-600 hover:text-blue-800 transition"
                                  title="Editar grupo"
                                >
                                  <Edit2 className="w-4 h-4" />
                                </button>
                                <button
                                  onClick={() => deleteRole(role.id)}
                                  className="text-red-600 hover:text-red-800 transition"
                                  title="Excluir grupo"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </button>
                              </div>
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
      <div className="min-h-screen bg-slate-100 flex items-center justify-center p-4">
        {notification && (
          <div className={`fixed top-4 right-4 p-4 rounded-xl shadow-lg flex items-center gap-3 z-50 ${notification.type === 'success' ? 'bg-emerald-500 text-slate-900' : 'bg-red-500 text-white'}`}>
            {notification.type === 'success' ? <CheckCircle2 className="w-5 h-5" /> : <AlertCircle className="w-5 h-5" />}
            <span className="font-medium">{notification.message}</span>
          </div>
        )}

        <div className="bg-white rounded-3xl border border-slate-200 shadow-xl p-6 sm:p-8 w-full max-w-md">
          <div className="text-center mb-8">
            <div className="inline-flex items-center justify-center w-16 h-16 bg-emerald-500 rounded-2xl mb-4">
              <MessageCircle className="w-8 h-8 text-white" />
            </div>
            <h1 className="text-3xl font-black text-slate-900 mb-2">WBM Pro</h1>
            <p className="text-slate-500">Faça login para continuar</p>
          </div>

          <form onSubmit={handleLogin} className="space-y-6">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">Email</label>
              <input
                type="email"
                value={loginEmail}
                onChange={(e) => setLoginEmail(e.target.value)}
                className="w-full px-4 py-3 border border-slate-200 bg-slate-50 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition"
                placeholder="seu@email.com"
                required
                disabled={isLoggingIn}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">Senha</label>
              <input
                type="password"
                value={loginPassword}
                onChange={(e) => setLoginPassword(e.target.value)}
                className="w-full px-4 py-3 border border-slate-200 bg-slate-50 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition"
                placeholder="••••••••"
                required
                disabled={isLoggingIn}
              />
            </div>

            <button
              type="submit"
              disabled={isLoggingIn}
              className="w-full bg-emerald-500 text-slate-900 py-3 rounded-xl font-bold hover:bg-emerald-600 transition shadow-lg disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
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

          <div className="mt-6 text-center text-sm text-slate-500">
            <p>Use suas credenciais cadastradas no sistema</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-100 flex">
      {notification && (
        <div className={`fixed top-4 right-4 p-4 rounded-xl shadow-lg flex items-center gap-3 z-50 ${notification.type === 'success' ? 'bg-emerald-500 text-slate-900' : 'bg-red-500 text-white'}`}>
          {notification.type === 'success' ? <CheckCircle2 className="w-5 h-5" /> : <AlertCircle className="w-5 h-5" />}
          <span className="font-medium">{notification.message}</span>
        </div>
      )}

      <aside className="hidden md:flex w-72 bg-white border-r border-slate-200 min-h-screen flex-col">
        <div className="p-6 border-b border-slate-200">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 rounded-xl bg-emerald-500 text-slate-900 flex items-center justify-center">
              <MessageCircle className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-xl font-black text-slate-900">WBM Pro</h1>
              <p className="text-xs text-slate-500">Mensageria Empresarial</p>
            </div>
          </div>
          {currentUser && (
            <div className="pt-3 border-t border-slate-200">
              <p className="text-xs text-slate-500">Logado como</p>
              <p className="text-sm font-semibold text-slate-800 truncate">{currentUser.username}</p>
              <p className="text-xs text-slate-500 truncate">{currentUser.email}</p>
            </div>
          )}
        </div>

        <nav className="p-4 flex-1 overflow-y-auto">
          <ul className="space-y-1">
            {accessibleMenuItems.map(item => {
              const Icon = item.icon;
              const isActive = activePage === item.id;
              return (
                <li key={item.id}>
                  <button
                    onClick={() => setActivePage(item.id)}
                    className={`w-full flex items-center justify-between gap-3 p-3 rounded-xl transition ${
                      isActive 
                        ? 'bg-emerald-50 text-emerald-700' 
                        : 'text-slate-700 hover:bg-slate-100'
                    }`}
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <Icon className={`w-5 h-5 shrink-0 ${isActive ? 'text-emerald-600' : item.color}`} />
                      <div className="text-left min-w-0">
                        <p className={`text-sm font-semibold truncate ${isActive ? 'text-emerald-700' : 'text-slate-700'}`}>{item.label}</p>
                        <p className="text-[11px] text-slate-400 truncate">{item.description}</p>
                      </div>
                    </div>
                    <ChevronRight className={`w-4 h-4 ${isActive ? 'text-emerald-500' : 'text-slate-300'}`} />
                  </button>
                </li>
              );
            })}
          </ul>
        </nav>

        <div className="p-4 border-t border-slate-200">
          <button
            onClick={handleLogout}
            className="w-full flex items-center gap-3 p-3 rounded-xl text-red-600 hover:bg-red-50 transition font-medium"
          >
            <LogOut className="w-5 h-5" />
            <span>Sair</span>
          </button>
        </div>
      </aside>

      {isMobileMenuOpen && (
        <div className="fixed inset-0 z-40 md:hidden">
          <button className="absolute inset-0 bg-black/30" onClick={() => setIsMobileMenuOpen(false)} aria-label="Fechar menu" />
          <div className="absolute left-0 top-0 h-full w-72 bg-white border-r border-slate-200 p-4 flex flex-col">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-emerald-500 flex items-center justify-center text-slate-900">
                  <MessageCircle className="w-4 h-4" />
                </div>
                <p className="font-black text-slate-900">WBM Pro</p>
              </div>
              <button onClick={() => setIsMobileMenuOpen(false)} className="p-2 rounded-lg hover:bg-slate-100">
                <X className="w-4 h-4" />
              </button>
            </div>
            <nav className="space-y-1 flex-1">
              {accessibleMenuItems.map(item => {
                const Icon = item.icon;
                const isActive = activePage === item.id;
                return (
                  <button
                    key={item.id}
                    onClick={() => setActivePage(item.id)}
                    className={`w-full flex items-center gap-3 p-3 rounded-xl ${isActive ? 'bg-emerald-50 text-emerald-700' : 'text-slate-700 hover:bg-slate-100'}`}
                  >
                    <Icon className="w-4 h-4" />
                    <span className="text-sm font-semibold">{item.label}</span>
                  </button>
                );
              })}
            </nav>
            <button onClick={handleLogout} className="w-full mt-4 p-3 rounded-xl bg-red-50 text-red-600 font-semibold">Sair</button>
          </div>
        </div>
      )}

      <div className="flex-1 min-w-0 flex flex-col">
        <header className="h-16 bg-white border-b border-slate-200 px-4 sm:px-6 flex items-center justify-between sticky top-0 z-30">
          <div className="flex items-center gap-3 min-w-0">
            <button onClick={() => setIsMobileMenuOpen(true)} className="md:hidden p-2 rounded-lg hover:bg-slate-100">
              <Menu className="w-5 h-5 text-slate-700" />
            </button>
            <div className="min-w-0">
              <p className="text-xs text-slate-400 font-semibold uppercase tracking-[0.12em]">Painel</p>
              <h2 className="text-base sm:text-lg font-bold text-slate-900 truncate">{menuItems.find(item => item.id === activePage)?.label || 'Painel'}</h2>
            </div>
          </div>
          <div className="flex items-center gap-2 sm:gap-3">
            <button className="h-10 w-10 rounded-xl bg-slate-100 flex items-center justify-center text-slate-500">
              <Bell className="w-4 h-4" />
            </button>
            <button
              onClick={() => setActivePage('bulk-send')}
              className="h-10 px-3 sm:px-4 rounded-xl bg-emerald-500 text-slate-900 font-bold text-sm"
            >
              Enviar Campanha
            </button>
          </div>
        </header>

        <main className="flex-1 overflow-y-auto p-3 sm:p-6 lg:p-8 pb-24 md:pb-8">
          {renderPage()}
        </main>
      </div>

      <nav className="md:hidden fixed bottom-0 inset-x-0 bg-white border-t border-slate-200 z-30 px-2 py-2 grid grid-cols-5 gap-1">
        {accessibleMenuItems.slice(0, 5).map(item => {
          const Icon = item.icon;
          const isActive = activePage === item.id;
          return (
            <button
              key={item.id}
              onClick={() => setActivePage(item.id)}
              className={`h-14 rounded-xl flex flex-col items-center justify-center gap-1 text-[10px] font-semibold ${isActive ? 'bg-emerald-50 text-emerald-700' : 'text-slate-500'}`}
            >
              <Icon className="w-4 h-4" />
              <span className="truncate max-w-full px-1">{item.label}</span>
            </button>
          );
        })}
      </nav>
    </div>
  );
}
