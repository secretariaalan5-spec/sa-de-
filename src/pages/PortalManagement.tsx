import { useState, useEffect, useMemo, useRef } from 'react';
import { supabase } from '@/integrations/supabase/untyped-client';
import { useAuthContext } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { QRCodeSVG, QRCodeCanvas } from 'qrcode.react';
import GeneralQrPrintDialog from '@/components/portal/GeneralQrPrintDialog';
import WhatsAppIcon from '@/components/WhatsAppIcon';
import {
  QrCode,
  Download,
  Printer,
  Copy,
  Check,
  ExternalLink,
  Users,
  Search,
  KeyRound,
  RefreshCw,
  Smartphone,
  Sparkles,
  Camera,
  LayoutGrid,
  List,
  Building2,
  Share2,
  CheckCircle2,
  Clock,
} from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

interface EmployeeCodeItem {
  employee_id: string;
  employee_name: string;
  phone: string | null;
  category_id: string | null;
  category_name: string | null;
  unit_id: string | null;
  unit_name: string | null;
  code: string;
  last_access_at: string | null;
  terms_accepted_at: string | null;
}

export default function PortalManagement() {
  const { roleInfo, isAdmin, isRH } = useAuthContext();
  const canManageCodes = isAdmin || isRH;

  // QR Code & Cartaz State
  const [cartazOpen, setCartazOpen] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);
  const [copiedMessage, setCopiedMessage] = useState(false);

  // List of Codes State
  const [employees, setEmployees] = useState<EmployeeCodeItem[]>([]);
  const [loadingCodes, setLoadingCodes] = useState(false);
  const [search, setSearch] = useState('');
  const [filterUnit, setFilterUnit] = useState('all');
  const [filterCat, setFilterCat] = useState('all');
  const [filterStatus, setFilterStatus] = useState<'all' | 'accessed' | 'pending'>('all');
  const [viewMode, setViewMode] = useState<'table' | 'cards'>('table');
  const [copiedCodeId, setCopiedCodeId] = useState<string | null>(null);
  const [regeneratingId, setRegeneratingId] = useState<string | null>(null);

  // Units and Categories for Filters
  const [units, setUnits] = useState<{ id: string; name: string }[]>([]);
  const [categories, setCategories] = useState<{ id: string; name: string; color?: string }[]>([]);

  const portalUrl = typeof window !== 'undefined' ? `${window.location.origin}/portal` : 'https://saude.gov.br/portal';

  // Load Initial Data
  useEffect(() => {
    loadCodes();
    loadUnitsAndCategories();
  }, [roleInfo?.team_id]);

  const loadUnitsAndCategories = async () => {
    if (!roleInfo?.team_id) return;
    const [uRes, cRes] = await Promise.all([
      supabase.from('units').select('id, name').eq('team_id', roleInfo.team_id).eq('active', true).order('name'),
      supabase.from('categories').select('id, name, color').eq('team_id', roleInfo.team_id).eq('active', true).order('name'),
    ]);
    if (uRes.data) setUnits(uRes.data);
    if (cRes.data) setCategories(cRes.data);
  };

  const loadCodes = async () => {
    setLoadingCodes(true);
    try {
      const { data, error } = await supabase.rpc('portal_admin_list_codes');
      if (error) throw error;
      setEmployees((data as EmployeeCodeItem[]) || []);
    } catch (err: any) {
      toast.error('Erro ao carregar lista de códigos: ' + (err.message || ''));
    } finally {
      setLoadingCodes(false);
    }
  };

  const handleRegenerateCode = async (emp: EmployeeCodeItem) => {
    if (!window.confirm(`Deseja regerar o código de 3 dígitos de ${emp.employee_name}? O código anterior deixará de funcionar imediatamente.`)) return;
    setRegeneratingId(emp.employee_id);
    try {
      const { data, error } = await supabase.rpc('portal_admin_regenerate_code', {
        p_employee_id: emp.employee_id,
      });
      if (error) throw error;
      toast.success(`Novo código gerado para ${emp.employee_name}: ${data}`);
      setEmployees(prev => prev.map(e => e.employee_id === emp.employee_id ? { ...e, code: data } : e));
    } catch (err: any) {
      toast.error('Erro ao regerar código: ' + (err.message || ''));
    } finally {
      setRegeneratingId(null);
    }
  };

  const handleCopyCode = (emp: EmployeeCodeItem) => {
    navigator.clipboard.writeText(emp.code);
    setCopiedCodeId(emp.employee_id);
    toast.success(`Código ${emp.code} copiado!`);
    setTimeout(() => setCopiedCodeId(null), 2500);
  };

  const handleCopyPortalLink = () => {
    navigator.clipboard.writeText(portalUrl);
    setCopiedLink(true);
    toast.success('Link do Portal copiado!');
    setTimeout(() => setCopiedLink(false), 2500);
  };

  const generalWhatsAppMessage = `Olá, equipe! 👋\n\n` +
    `O *Portal do Profissional (Saúde+)* está liberado para consulta de escalas, plantões e saldo de folgas.\n\n` +
    `🌐 *Link de Acesso:* ${portalUrl}\n` +
    `🔑 *Como Acessar:* Digite seu *Código Pessoal de 3 dígitos*.\n` +
    `📸 *Foto de Perfil:* Você pode adicionar ou atualizar sua foto direto no portal.\n\n` +
    `Você também pode escanear o QR Code fixado no mural da unidade pelo seu celular! 📲`;

  const handleCopyGeneralMessage = () => {
    navigator.clipboard.writeText(generalWhatsAppMessage);
    setCopiedMessage(true);
    toast.success('Mensagem de orientação copiada para envio no WhatsApp!');
    setTimeout(() => setCopiedMessage(false), 2500);
  };

  const getProfessionalWhatsAppLink = (emp: EmployeeCodeItem) => {
    if (!emp.phone) return '';
    const clean = emp.phone.replace(/\D/g, '');
    const waPhone = clean.startsWith('55') ? clean : `55${clean}`;
    const firstName = emp.employee_name.split(' ')[0];
    const text = encodeURIComponent(
      `Olá, ${firstName}! 👋\n\n` +
      `Seu acesso ao *Portal do Profissional (Saúde+)* está liberado.\n\n` +
      `🔑 *Seu Código de Acesso (3 dígitos):* *${emp.code}*\n` +
      `🌐 *Link de Acesso:* ${portalUrl}?codigo=${emp.code}\n\n` +
      `No portal você acompanha suas escalas e saldo em tempo real, além de poder cadastrar sua foto de perfil.`
    );
    return `https://wa.me/${waPhone}?text=${text}`;
  };

  // Download QR Code as PNG
  const handleDownloadQrPng = () => {
    try {
      const canvas = document.getElementById('portal-management-qr-canvas') as HTMLCanvasElement;
      if (!canvas) {
        toast.error('Não foi possível gerar a imagem no momento.');
        return;
      }
      const dlCanvas = document.createElement('canvas');
      const ctx = dlCanvas.getContext('2d');
      if (!ctx) return;

      const size = 600;
      const padding = 40;
      dlCanvas.width = size;
      dlCanvas.height = size + 160;

      // Background
      ctx.fillStyle = '#ffffff';
      if (ctx.roundRect) {
        ctx.roundRect(0, 0, dlCanvas.width, dlCanvas.height, 24);
      } else {
        ctx.rect(0, 0, dlCanvas.width, dlCanvas.height);
      }
      ctx.fill();

      // Border
      ctx.strokeStyle = '#e2e8f0';
      ctx.lineWidth = 3;
      ctx.stroke();

      // Header Banner
      ctx.fillStyle = '#0f766e';
      ctx.font = 'bold 26px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('PORTAL DO PROFISSIONAL', size / 2, 60);

      ctx.fillStyle = '#64748b';
      ctx.font = '16px sans-serif';
      ctx.fillText('Secretaria de Saúde • Sistema Saúde+', size / 2, 90);

      // Draw QR Code in center
      const qrSize = size - padding * 2;
      ctx.drawImage(canvas, padding, 120, qrSize, qrSize);

      // Footer Instructions
      ctx.fillStyle = '#0f766e';
      ctx.font = 'bold 20px sans-serif';
      ctx.fillText('Aponte a câmera do seu celular para acessar', size / 2, 120 + qrSize + 40);

      ctx.fillStyle = '#64748b';
      ctx.font = 'bold 15px monospace';
      ctx.fillText(portalUrl, size / 2, 120 + qrSize + 70);

      // Trigger download
      const dataUrl = dlCanvas.toDataURL('image/png');
      const a = document.createElement('a');
      a.href = dataUrl;
      a.download = `qrcode-portal-do-profissional.png`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      toast.success('Imagem do QR Code baixada com sucesso!');
    } catch (err: any) {
      toast.error('Erro ao baixar imagem: ' + err.message);
    }
  };

  // Metrics
  const accessedCount = useMemo(() => employees.filter(e => !!e.last_access_at).length, [employees]);
  const pendingCount = employees.length - accessedCount;

  // Filtered Employees
  const filteredEmployees = useMemo(() => {
    return employees.filter(emp => {
      if (search.trim()) {
        const q = search.toLowerCase();
        const matchesName = emp.employee_name.toLowerCase().includes(q);
        const matchesCode = emp.code.toLowerCase().includes(q);
        const matchesCat = (emp.category_name || '').toLowerCase().includes(q);
        const matchesUnit = (emp.unit_name || '').toLowerCase().includes(q);
        if (!matchesName && !matchesCode && !matchesCat && !matchesUnit) return false;
      }
      if (filterUnit !== 'all' && emp.unit_id !== filterUnit) return false;
      if (filterCat !== 'all' && emp.category_id !== filterCat) return false;
      if (filterStatus === 'accessed' && !emp.last_access_at) return false;
      if (filterStatus === 'pending' && emp.last_access_at) return false;
      return true;
    });
  }, [employees, search, filterUnit, filterCat, filterStatus]);

  return (
    <div className="space-y-6 animate-fade-in">
      {/* ═══ CABEÇALHO PADRÃO DO SISTEMA ═══ */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold">Portal</h1>
          <p className="text-muted-foreground text-sm">
            QR Code para murais, instruções de acesso e códigos de 3 dígitos dos profissionais
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            onClick={() => setCartazOpen(true)}
            className="gap-2 border-primary/30 text-primary hover:bg-primary/5 hover:text-primary font-semibold text-xs h-9 shadow-xs"
            title="Imprimir cartaz geral com instruções"
          >
            <Printer size={16} />
            <span>Imprimir Cartaz</span>
          </Button>

          <a
            href={portalUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 h-9 px-3 rounded-lg bg-primary text-primary-foreground font-semibold text-xs hover:bg-primary/90 transition-colors shadow-xs"
          >
            <span>Abrir Portal</span>
            <ExternalLink size={14} />
          </a>
        </div>
      </div>

      {/* Canvas invisível para gerar a imagem PNG para download */}
      <div className="hidden">
        <QRCodeCanvas
          id="portal-management-qr-canvas"
          value={portalUrl}
          size={512}
          level="H"
          includeMargin={false}
        />
      </div>

      {/* ═══ SEÇÃO 1: QR CODE & INSTRUÇÕES DE ACESSO COM FOTO COMPRIMIDA ═══ */}
      <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
        {/* Card do QR Code com Download */}
        <div className="md:col-span-5 lg:col-span-4 bg-card rounded-xl border border-border p-5 flex flex-col items-center text-center justify-between shadow-xs">
          <div className="space-y-2 w-full">
            <span className="text-[10px] uppercase font-bold tracking-wider text-primary block">
              Mural da Unidade
            </span>
            <h2 className="text-base font-bold text-foreground">QR Code do Portal</h2>
            <p className="text-xs text-muted-foreground">
              Aponte a câmera do celular para abrir o portal
            </p>

            <div className="p-3 bg-white rounded-2xl border border-border inline-block shadow-xs my-2">
              <QRCodeSVG
                value={portalUrl}
                size={180}
                level="H"
                includeMargin={false}
              />
            </div>

            <div className="flex items-center justify-center gap-1.5 text-xs font-mono text-muted-foreground bg-muted/50 py-1.5 px-3 rounded-lg border border-border/50">
              <span className="truncate max-w-[210px]">{portalUrl}</span>
              <button
                onClick={handleCopyPortalLink}
                className="text-primary hover:text-primary/80 transition-colors p-0.5"
                title="Copiar Link"
              >
                {copiedLink ? <Check size={14} className="text-emerald-600" /> : <Copy size={14} />}
              </button>
            </div>
          </div>

          <div className="w-full space-y-2 pt-4">
            <Button
              onClick={handleDownloadQrPng}
              className="w-full gap-2 h-9 text-xs font-semibold"
            >
              <Download size={15} />
              <span>Baixar Imagem QR Code (PNG)</span>
            </Button>

            <Button
              onClick={() => setCartazOpen(true)}
              variant="outline"
              className="w-full gap-2 h-9 text-xs font-semibold"
            >
              <Printer size={15} />
              <span>Imprimir Cartaz com QR Code</span>
            </Button>
          </div>
        </div>

        {/* Card de Instruções & Foto Comprimida */}
        <div className="md:col-span-7 lg:col-span-8 bg-card rounded-xl border border-border p-5 flex flex-col justify-between shadow-xs space-y-4">
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="text-base font-bold text-foreground flex items-center gap-2">
                <Sparkles size={16} className="text-amber-500" />
                Como Funciona o Portal do Profissional
              </h2>
              <Button
                variant="ghost"
                size="sm"
                onClick={handleCopyGeneralMessage}
                className="h-8 gap-1.5 text-xs font-medium text-primary hover:bg-primary/10"
              >
                {copiedMessage ? <Check size={13} className="text-emerald-600" /> : <Share2 size={13} />}
                <span>{copiedMessage ? 'Copiado!' : 'Copiar para WhatsApp'}</span>
              </Button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="p-3 bg-muted/30 rounded-xl border border-border/50 space-y-1">
                <div className="w-6 h-6 rounded-full bg-primary text-primary-foreground font-bold text-xs flex items-center justify-center">
                  1
                </div>
                <h3 className="text-xs font-bold text-foreground">Abrir a Câmera</h3>
                <p className="text-[11px] text-muted-foreground leading-snug">
                  O profissional aponta a câmera do celular para o QR Code ou clica no link direto.
                </p>
              </div>

              <div className="p-3 bg-muted/30 rounded-xl border border-border/50 space-y-1">
                <div className="w-6 h-6 rounded-full bg-primary text-primary-foreground font-bold text-xs flex items-center justify-center">
                  2
                </div>
                <h3 className="text-xs font-bold text-foreground">Digitar Código (3 Dígitos)</h3>
                <p className="text-[11px] text-muted-foreground leading-snug">
                  Entra digitando seu código pessoal exclusivo de 3 dígitos listado abaixo.
                </p>
              </div>

              <div className="p-3 bg-muted/30 rounded-xl border border-border/50 space-y-1">
                <div className="w-6 h-6 rounded-full bg-primary text-primary-foreground font-bold text-xs flex items-center justify-center">
                  3
                </div>
                <h3 className="text-xs font-bold text-foreground">Visualização Completa</h3>
                <p className="text-[11px] text-muted-foreground leading-snug">
                  Consulta suas escalas, plantões extras e saldo de folgas em modo somente leitura.
                </p>
              </div>
            </div>

            {/* Destaque: Foto de Perfil Comprimida */}
            <div className="p-3.5 bg-primary/5 rounded-xl border border-primary/20 space-y-1.5">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-lg bg-primary/10 text-primary flex items-center justify-center shrink-0">
                  <Camera size={15} />
                </div>
                <span className="text-xs font-bold text-foreground">
                  Foto de Perfil Leve e Comprimida no Próprio Celular
                </span>
              </div>
              <p className="text-[11.5px] text-muted-foreground leading-relaxed pl-9">
                O portal permite que o profissional adicione ou altere sua própria foto de perfil. A foto é comprimida e redimensionada automaticamente no navegador em formato <strong>WebP ultra-leve (menos de 50 KB)</strong>, economizando espaço do banco de dados e mantendo o carregamento instantâneo.
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-border/50 text-[11px] text-muted-foreground">
            <span className="flex items-center gap-1.5">
              <Smartphone size={13} className="text-primary" />
              O portal funciona em qualquer smartphone (Android e iPhone) sem precisar instalar nada na loja.
            </span>
            <span className="font-medium text-foreground">
              {employees.length} profissionais com código ativo
            </span>
          </div>
        </div>
      </div>

      {/* ═══ SEÇÃO 2: LISTA DE CÓDIGOS DE 3 DÍGITOS DOS PROFISSIONAIS ═══ */}
      <div className="space-y-3">
        {/* Barra de Filtros no Padrão do Sistema */}
        <div className="flex flex-wrap items-center gap-3 bg-card rounded-xl border border-border p-3">
          <div className="relative flex-1 min-w-[200px]">
            <Search size={14} className="absolute left-3 top-2.5 text-muted-foreground" />
            <Input
              placeholder="Buscar por nome ou código de 3 dígitos..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="pl-9 h-9"
            />
          </div>

          <Select value={filterCat} onValueChange={setFilterCat}>
            <SelectTrigger className="w-[160px] h-9">
              <SelectValue placeholder="Categoria" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas Categorias</SelectItem>
              {categories.map(c => (
                <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={filterUnit} onValueChange={setFilterUnit}>
            <SelectTrigger className="w-[160px] h-9">
              <SelectValue placeholder="Unidade" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas Unidades</SelectItem>
              {units.map(u => (
                <SelectItem key={u.id} value={u.id}>{u.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={filterStatus} onValueChange={(v) => setFilterStatus(v as any)}>
            <SelectTrigger className="w-[150px] h-9">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos os Status</SelectItem>
              <SelectItem value="accessed">Já Acessaram</SelectItem>
              <SelectItem value="pending">Nunca Acessaram</SelectItem>
            </SelectContent>
          </Select>

          <div className="hidden sm:flex bg-muted rounded-lg p-0.5">
            <button
              onClick={() => setViewMode('cards')}
              className={cn('view-toggle-btn px-3 py-1.5', viewMode === 'cards' && 'active')}
              title="Visualização em Cards"
            >
              <LayoutGrid size={14} />
            </button>
            <button
              onClick={() => setViewMode('table')}
              className={cn('view-toggle-btn px-3 py-1.5', viewMode === 'table' && 'active')}
              title="Visualização em Tabela"
            >
              <List size={14} />
            </button>
          </div>

          <Button
            variant="ghost"
            size="icon"
            onClick={loadCodes}
            disabled={loadingCodes}
            className="h-9 w-9 text-muted-foreground hover:text-foreground"
            title="Atualizar lista"
          >
            <RefreshCw size={14} className={loadingCodes ? 'animate-spin' : ''} />
          </Button>
        </div>

        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <span>{filteredEmployees.length} profissional(is) encontrado(s)</span>
          <span className="text-[11px]">
            <strong className="text-emerald-600 font-semibold">{accessedCount}</strong> já acessaram • <strong className="text-muted-foreground font-semibold">{pendingCount}</strong> nunca acessaram
          </span>
        </div>

        {/* Conteúdo: Tabela ou Cards */}
        {loadingCodes ? (
          <div className="empty-state py-12">
            <RefreshCw className="mx-auto mb-3 text-muted-foreground animate-spin" size={32} />
            <p className="text-muted-foreground text-sm">Carregando códigos de acesso...</p>
          </div>
        ) : filteredEmployees.length === 0 ? (
          <div className="empty-state">
            <Users className="mx-auto mb-3 text-muted-foreground" size={40} />
            <p className="text-muted-foreground">Nenhum profissional encontrado</p>
          </div>
        ) : viewMode === 'table' ? (
          <div className="bg-card rounded-xl border border-border shadow-xs overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-muted/40 text-muted-foreground uppercase text-[10px] font-bold tracking-wider border-b border-border">
                  <tr>
                    <th className="py-3 px-4">Profissional</th>
                    <th className="py-3 px-3">Categoria</th>
                    <th className="py-3 px-3">Unidade</th>
                    <th className="py-3 px-3 text-center">Código de Acesso</th>
                    <th className="py-3 px-3">Status no Portal</th>
                    <th className="py-3 px-4 text-right">Ações</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {filteredEmployees.map(emp => {
                    const waLink = getProfessionalWhatsAppLink(emp);
                    const isCopied = copiedCodeId === emp.employee_id;
                    const isRegenerating = regeneratingId === emp.employee_id;

                    return (
                      <tr key={emp.employee_id} className="hover:bg-muted/30 transition-colors">
                        <td className="py-3 px-4">
                          <div className="flex items-center gap-2.5">
                            <Avatar className="w-7 h-7 rounded-lg border border-border">
                              <AvatarFallback className="bg-primary/10 text-primary font-bold text-[10px]">
                                {emp.employee_name.slice(0, 2).toUpperCase()}
                              </AvatarFallback>
                            </Avatar>
                            <div>
                              <span className="font-bold text-foreground block text-xs">{emp.employee_name}</span>
                              {emp.phone && (
                                <span className="text-[10px] text-muted-foreground">{emp.phone}</span>
                              )}
                            </div>
                          </div>
                        </td>

                        <td className="py-3 px-3">
                          <Badge variant="outline" className="font-semibold text-[10px]">
                            {emp.category_name || 'Sem cargo'}
                          </Badge>
                        </td>

                        <td className="py-3 px-3 text-muted-foreground">
                          {emp.unit_name || 'Geral'}
                        </td>

                        <td className="py-3 px-3 text-center">
                          <div className="inline-flex items-center gap-1.5 bg-primary/10 border border-primary/20 px-2.5 py-0.5 rounded-lg">
                            <KeyRound size={12} className="text-primary" />
                            <span className="font-mono font-bold text-sm text-primary tracking-wider">
                              {emp.code}
                            </span>
                          </div>
                        </td>

                        <td className="py-3 px-3">
                          {emp.last_access_at ? (
                            <div className="space-y-0.5">
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-400 dark:border-emerald-800">
                                <CheckCircle2 size={11} className="text-emerald-600" />
                                Já Acessou
                              </span>
                              <span className="text-[10px] text-muted-foreground block">
                                {new Date(emp.last_access_at).toLocaleDateString('pt-BR')} às {new Date(emp.last_access_at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                              </span>
                            </div>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] text-muted-foreground bg-muted border border-border">
                              <Clock size={11} className="text-muted-foreground/60" />
                              Nunca Acessou
                            </span>
                          )}
                        </td>

                        <td className="py-3 px-4 text-right">
                          <div className="flex items-center justify-end gap-1">
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => handleCopyCode(emp)}
                              className="h-8 w-8 p-0 text-muted-foreground hover:text-foreground"
                              title="Copiar código de 3 dígitos"
                            >
                              {isCopied ? <Check size={14} className="text-emerald-600" /> : <Copy size={14} />}
                            </Button>

                            {waLink ? (
                              <a
                                href={waLink}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="h-8 w-8 inline-flex items-center justify-center rounded-lg text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-950/40 transition-colors"
                                title="Enviar código pelo WhatsApp"
                              >
                                <WhatsAppIcon size={14} />
                              </a>
                            ) : (
                              <button
                                disabled
                                className="h-8 w-8 inline-flex items-center justify-center rounded-lg text-muted-foreground/30 cursor-not-allowed"
                                title="Sem telefone cadastrado"
                              >
                                <WhatsAppIcon size={14} />
                              </button>
                            )}

                            {canManageCodes && (
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => handleRegenerateCode(emp)}
                                disabled={isRegenerating}
                                className="h-8 w-8 p-0 text-muted-foreground hover:text-foreground"
                                title="Regerar código de 3 dígitos"
                              >
                                <RefreshCw size={12} className={isRegenerating ? 'animate-spin' : ''} />
                              </Button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {filteredEmployees.map(emp => {
              const waLink = getProfessionalWhatsAppLink(emp);
              const isCopied = copiedCodeId === emp.employee_id;
              const isRegenerating = regeneratingId === emp.employee_id;

              return (
                <div
                  key={emp.employee_id}
                  className="page-card p-4 hover:border-primary/30 transition-all flex flex-col justify-between shadow-xs space-y-3"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <Avatar className="w-9 h-9 rounded-xl border border-border shrink-0">
                        <AvatarFallback className="bg-primary/10 text-primary font-bold text-xs">
                          {emp.employee_name.slice(0, 2).toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                      <div className="min-w-0">
                        <span className="font-bold text-foreground text-sm block truncate">
                          {emp.employee_name}
                        </span>
                        <span className="text-[10px] text-muted-foreground block truncate">
                          {emp.category_name || 'Sem cargo'} • {emp.unit_name || 'Geral'}
                        </span>
                      </div>
                    </div>

                    <div className="inline-flex items-center gap-1 bg-primary/10 border border-primary/25 px-2.5 py-1 rounded-xl shrink-0">
                      <KeyRound size={12} className="text-primary" />
                      <span className="font-mono font-bold text-sm text-primary tracking-wider">
                        {emp.code}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center justify-between text-xs">
                    <span className="text-[10px] text-muted-foreground">Status no portal:</span>
                    {emp.last_access_at ? (
                      <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-emerald-600">
                        <CheckCircle2 size={11} />
                        Já Acessou ({new Date(emp.last_access_at).toLocaleDateString('pt-BR')})
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-[10px] text-muted-foreground/70">
                        <Clock size={11} />
                        Nunca Acessou
                      </span>
                    )}
                  </div>

                  <div className="flex items-center justify-between pt-2 border-t border-border/50 text-xs">
                    <span className="text-[10px] text-muted-foreground">
                      {emp.phone || 'Sem telefone'}
                    </span>

                    <div className="flex items-center gap-1">
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => handleCopyCode(emp)}
                        className="h-7 px-2 gap-1 text-[11px] text-muted-foreground hover:text-foreground"
                      >
                        {isCopied ? <Check size={12} className="text-emerald-600" /> : <Copy size={12} />}
                        <span>{isCopied ? 'Copiado' : 'Copiar'}</span>
                      </Button>

                      {waLink && (
                        <a
                          href={waLink}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="h-7 px-2 inline-flex items-center gap-1 rounded-lg text-emerald-600 hover:bg-emerald-50 text-[11px] font-medium transition-colors"
                        >
                          <WhatsAppIcon size={13} />
                          <span>WhatsApp</span>
                        </a>
                      )}

                      {canManageCodes && (
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => handleRegenerateCode(emp)}
                          disabled={isRegenerating}
                          className="h-7 w-7 p-0 text-muted-foreground hover:text-foreground"
                          title="Regerar código"
                        >
                          <RefreshCw size={11} className={isRegenerating ? 'animate-spin' : ''} />
                        </Button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* ═══ DIÁLOGO DO CARTAZ OFICIAL PARA IMPRESSÃO A4 ═══ */}
      <GeneralQrPrintDialog
        open={cartazOpen}
        onOpenChange={setCartazOpen}
        unitName={filterUnit !== 'all' ? units.find(u => u.id === filterUnit)?.name : null}
      />
    </div>
  );
}
