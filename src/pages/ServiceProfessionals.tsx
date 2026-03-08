/**
 * ServiceProfessionals — Lista de profissionais com detalhes individuais.
 *
 * Clique no card para ver créditos, folgas, fins de semana e baixar PDF.
 */

import { useState, useMemo, useEffect, useCallback } from 'react';
import { PageHeader } from '@/components/shared/PageHeader';
import { EmptyState } from '@/components/shared/EmptyState';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Stethoscope, Syringe, Search, Users, Trash2, ChevronLeft, Download,
  Calendar, TrendingUp, TrendingDown, Clock,
} from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useServiceProfessionals } from '@/hooks/useServiceProfessionals';
import { useLeaveRequests } from '@/hooks/useLeaveRequests';
import { useServiceSchedule } from '@/hooks/useServiceSchedule';
import { useServiceStats } from '@/hooks/useServiceStats';
import { ServiceProfessional, LEAVE_TYPE_LABELS, LeaveType } from '@/types/serviceSchedule';
import { format, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import { supabase } from '@/integrations/supabase/client';
import jsPDF from 'jspdf';

const ITEMS_PER_PAGE = 12;

export default function ServiceProfessionalsPage() {
  const { professionals, deleteProfessional } = useServiceProfessionals();
  const { requests, getTotalCreditsUsedByProfessional, getRequestsByProfessional } = useLeaveRequests();
  const { allEntries } = useServiceSchedule('nurse');
  const { allEntries: techEntries } = useServiceSchedule('tech');

  const allEntriesCombined = useMemo(() => [...allEntries, ...techEntries], [allEntries, techEntries]);

  const { getStatsForProfessional } = useServiceStats({
    allEntries: allEntriesCombined,
    getTotalCreditsUsedByProfessional,
  });

  const [selectedProf, setSelectedProf] = useState<ServiceProfessional | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [activeTab, setActiveTab] = useState<'nurse' | 'tech'>('nurse');
  const [nursePage, setNursePage] = useState(1);
  const [techPage, setTechPage] = useState(1);
  const [avatarMap, setAvatarMap] = useState<Record<string, string>>({});
  const [emailMap, setEmailMap] = useState<Record<string, string>>({});

  // Fetch avatar URLs and emails from professional_users
  const fetchProfessionalData = useCallback(async () => {
    const { data } = await (supabase
      .from('professional_users' as any)
      .select('professional_id, avatar_url, email')
      .not('professional_id', 'is', null) as any);
    if (data) {
      const avatars: Record<string, string> = {};
      const emails: Record<string, string> = {};
      (data as any[]).forEach(row => {
        if (row.professional_id) {
          if (row.avatar_url) avatars[row.professional_id] = row.avatar_url;
          if (row.email) emails[row.professional_id] = row.email;
        }
      });
      setAvatarMap(avatars);
      setEmailMap(emails);
    }
  }, []);

  useEffect(() => { fetchProfessionalData(); }, [fetchProfessionalData]);

  const filtered = useMemo(() => {
    if (!searchTerm.trim()) return professionals;
    const term = searchTerm.toLowerCase();
    return professionals.filter(p => p.name.toLowerCase().includes(term));
  }, [professionals, searchTerm]);

  const nurses = useMemo(() => filtered.filter(p => p.category === 'nurse'), [filtered]);
  const techs = useMemo(() => filtered.filter(p => p.category === 'tech'), [filtered]);

  const paginatedNurses = nurses.slice(0, nursePage * ITEMS_PER_PAGE);
  const paginatedTechs = techs.slice(0, techPage * ITEMS_PER_PAGE);

  useEffect(() => { setNursePage(1); setTechPage(1); }, [searchTerm]);

  const today = format(new Date(), 'yyyy-MM-dd');

  // ── PDF Download ──
  const downloadPDF = (prof: ServiceProfessional) => {
    const stats = getStatsForProfessional(prof.id, prof.name, prof.category);
    const leaveReqs = getRequestsByProfessional(prof.id);
    const todayDate = new Date(); todayDate.setHours(0, 0, 0, 0);
    const profEntries = allEntriesCombined.filter(e => e.professionalId === prof.id);
    const pastEntries = profEntries.filter(e => parseISO(e.date) <= todayDate);
    const weekendEntries = pastEntries.filter(e => e.isWeekend);

    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    const margin = 15;
    const contentWidth = pageWidth - margin * 2;
    let y = 0;

    doc.setFillColor(41, 98, 255);
    doc.rect(0, 0, pageWidth, 35, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(18); doc.setFont('helvetica', 'bold');
    doc.text('CONTROLE INDIVIDUAL', pageWidth / 2, 15, { align: 'center' });
    doc.setFontSize(14);
    doc.text('Créditos e Folgas', pageWidth / 2, 23, { align: 'center' });

    y = 45; doc.setTextColor(0, 0, 0);
    doc.setFillColor(245, 247, 250); doc.rect(margin, y, contentWidth, 28, 'FD');
    doc.setFontSize(11); doc.setFont('helvetica', 'bold');
    doc.text('DADOS DO PROFISSIONAL', margin + 5, y + 7);
    doc.setFontSize(10); doc.setFont('helvetica', 'normal');
    doc.text(`Nome: ${prof.name}`, margin + 5, y + 14);
    doc.text(`Categoria: ${prof.category === 'nurse' ? 'Enfermeiro(a)' : 'Técnico(a)'}`, margin + 5, y + 20);
    y += 38;

    doc.setFontSize(12); doc.setFont('helvetica', 'bold'); doc.setTextColor(41, 98, 255);
    doc.text('RESUMO DE CRÉDITOS', margin, y); y += 8; doc.setTextColor(0, 0, 0);

    const rh = 10; const c1 = contentWidth * 0.65; const c2 = contentWidth * 0.35;
    doc.setFillColor(41, 98, 255); doc.rect(margin, y, c1, rh, 'F'); doc.rect(margin + c1, y, c2, rh, 'F');
    doc.setTextColor(255, 255, 255); doc.setFontSize(9); doc.setFont('helvetica', 'bold');
    doc.text('Descrição', margin + 3, y + 6.5); doc.text('Quantidade', margin + c1 + 3, y + 6.5);
    y += rh; doc.setTextColor(0, 0, 0); doc.setFont('helvetica', 'normal');

    const rows = [
      { label: 'Dias trabalhados', value: stats.workedDays, bg: [255, 255, 255] },
      { label: 'Fins de semana', value: stats.weekendDays, bg: [254, 249, 195] },
      { label: 'Créditos gerados', value: `${stats.creditsGenerated} dias`, bg: [255, 255, 255] },
      { label: 'Créditos utilizados', value: `${stats.creditsUsed} dias`, bg: [254, 226, 226] },
    ];
    rows.forEach(r => {
      doc.setFillColor(r.bg[0], r.bg[1], r.bg[2]);
      doc.rect(margin, y, c1, rh, 'FD'); doc.rect(margin + c1, y, c2, rh, 'FD');
      doc.text(r.label, margin + 3, y + 6.5); doc.text(String(r.value), margin + c1 + 3, y + 6.5);
      y += rh;
    });

    const bc = stats.creditsBalance > 0 ? [220, 252, 231] : stats.creditsBalance < 0 ? [254, 226, 226] : [243, 244, 246];
    doc.setFillColor(bc[0], bc[1], bc[2]); doc.rect(margin, y, c1, rh + 2, 'FD'); doc.rect(margin + c1, y, c2, rh + 2, 'FD');
    doc.setFont('helvetica', 'bold'); doc.setFontSize(10);
    doc.text('SALDO DISPONÍVEL', margin + 3, y + 7.5);
    const tc = stats.creditsBalance > 0 ? [22, 163, 74] : stats.creditsBalance < 0 ? [220, 38, 38] : [0, 0, 0];
    doc.setTextColor(tc[0], tc[1], tc[2]);
    doc.text(`${stats.creditsBalance} dias`, margin + c1 + 3, y + 7.5);
    doc.setTextColor(0, 0, 0); y += rh + 12;

    if (weekendEntries.length > 0) {
      if (y > pageHeight - 80) { doc.addPage(); y = 20; }
      doc.setFontSize(12); doc.setFont('helvetica', 'bold'); doc.setTextColor(41, 98, 255);
      doc.text('FINS DE SEMANA TRABALHADOS', margin, y); y += 8; doc.setTextColor(0, 0, 0);
      doc.setFontSize(9); doc.setFont('helvetica', 'normal');
      weekendEntries.sort((a, b) => a.date.localeCompare(b.date)).forEach((entry, i) => {
        if (y > pageHeight - 20) { doc.addPage(); y = 20; }
        doc.text(`${i + 1}. ${format(parseISO(entry.date), "dd/MM/yyyy (EEEE)", { locale: ptBR })}`, margin + 5, y);
        y += 7;
      });
      y += 10;
    }

    if (leaveReqs.length > 0) {
      if (y > pageHeight - 80) { doc.addPage(); y = 20; }
      doc.setFontSize(12); doc.setFont('helvetica', 'bold'); doc.setTextColor(41, 98, 255);
      doc.text('HISTÓRICO DE FOLGAS', margin, y); y += 8; doc.setTextColor(0, 0, 0);
      doc.setFontSize(9); doc.setFont('helvetica', 'normal');
      leaveReqs.sort((a, b) => a.createdAt.localeCompare(b.createdAt)).forEach((req, i) => {
        if (y > pageHeight - 30) { doc.addPage(); y = 20; }
        const rd = format(parseISO(req.requestDate), "dd/MM/yyyy", { locale: ptBR });
        doc.setFont('helvetica', 'bold');
        doc.text(`${i + 1}. ${rd} — ${req.daysRequested} dia(s)`, margin + 5, y); y += 6;
        doc.setFont('helvetica', 'normal');
        doc.text(`Datas: ${req.leaveDates.map(d => format(parseISO(d), "dd/MM/yyyy", { locale: ptBR })).join(', ')}`, margin + 5, y); y += 6;
        if (req.observations) { doc.text(`Obs: ${req.observations}`, margin + 5, y); y += 6; }
        y += 4;
      });
    }

    doc.setFontSize(7); doc.setTextColor(150, 150, 150);
    doc.text('Escala eMulti - Sistema de Gestão de Escalas', pageWidth / 2, pageHeight - 10, { align: 'center' });
    doc.save(`controle-${prof.name.toLowerCase().replace(/\s+/g, '-')}-${format(new Date(), 'yyyy-MM-dd')}.pdf`);
  };

  // ── Professional Card ──
  const ProfessionalCard = ({ prof }: { prof: ServiceProfessional }) => {
    const isOnLeave = requests.some(r => r.professionalId === prof.id && r.leaveDates.includes(today));
    const isNurse = prof.category === 'nurse';
    const stats = getStatsForProfessional(prof.id, prof.name, prof.category);
    const catBar = isNurse ? 'cat-bar-nurse' : 'cat-bar-tech';
    const catIcon = isNurse ? 'cat-icon-nurse' : 'cat-icon-tech';
    const catText = isNurse ? 'cat-text-nurse' : 'cat-text-tech';
    const catLabel = isNurse ? 'Enfermeiro' : 'Técnico';
    const Icon = isNurse ? Stethoscope : Syringe;
    const avatarUrl = avatarMap[prof.id];
    const [imgLoaded, setImgLoaded] = useState(false);

    return (
      <div
        className="page-card overflow-hidden cursor-pointer hover:border-primary/40 hover:shadow-md transition-all group"
        onClick={() => setSelectedProf(prof)}
      >
        <div className={`h-1 -mx-5 -mt-5 mb-4 ${catBar}`} />
        <div className="flex items-center gap-3">
          {avatarUrl ? (
            <div className="relative w-11 h-11 rounded-xl shrink-0 border-2 border-border overflow-hidden bg-muted">
              {!imgLoaded && (
                <div className="absolute inset-0 animate-pulse bg-muted" />
              )}
              <img
                src={avatarUrl}
                alt={prof.name}
                loading="eager"
                onLoad={() => setImgLoaded(true)}
                className={cn(
                  "w-full h-full object-cover transition-opacity duration-200",
                  imgLoaded ? "opacity-100" : "opacity-0"
                )}
              />
            </div>
          ) : (
            <div className={`w-11 h-11 rounded-xl flex items-center justify-center shrink-0 ${catIcon}`}>
              <Icon className="w-4 h-4" />
            </div>
          )}
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <h3 className="font-bold text-sm text-foreground truncate">{prof.name}</h3>
              {isOnLeave && <span className="flex h-2 w-2 rounded-full bg-warning animate-pulse shrink-0" title="De Folga Hoje" />}
            </div>
            {emailMap[prof.id] && <p className="text-[11px] text-muted-foreground truncate">{emailMap[prof.id]}</p>}
            <p className="text-xs text-muted-foreground">{prof.monthlyHours}h mensal</p>
            <div className="flex flex-wrap gap-1 mt-1">
              <Badge variant="secondary" className={`text-[10px] ${catText}`}>{catLabel}</Badge>
              {isOnLeave && <Badge variant="outline" className="text-[10px] text-warning border-warning/30">De Folga</Badge>}
              {!prof.active && <Badge variant="outline" className="text-[10px] text-destructive border-destructive/30">Inativo</Badge>}
            </div>
          </div>
          <div className="text-right shrink-0 flex items-center gap-2">
            <div>
              <span className={cn(
                "text-lg font-bold",
                stats.creditsBalance > 0 ? "text-accent" : stats.creditsBalance < 0 ? "text-destructive" : "text-muted-foreground"
              )}>
                {stats.creditsBalance}
              </span>
              <p className="text-[10px] text-muted-foreground">créditos</p>
            </div>
            <Button
              size="icon"
              variant="ghost"
              className="h-8 w-8 text-muted-foreground hover:text-destructive shrink-0 opacity-100 sm:opacity-0 group-hover:opacity-100 transition-opacity"
              onClick={(e) => { e.stopPropagation(); deleteProfessional(prof.id); }}
              title="Remover profissional"
            >
              <Trash2 className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </div>
    );
  };

  // ── Detail View ──
  const renderDetail = (prof: ServiceProfessional) => {
    const stats = getStatsForProfessional(prof.id, prof.name, prof.category);
    const leaveReqs = getRequestsByProfessional(prof.id);
    const todayDate = new Date(); todayDate.setHours(0, 0, 0, 0);
    const profEntries = allEntriesCombined.filter(e => e.professionalId === prof.id);
    const pastEntries = profEntries.filter(e => parseISO(e.date) <= todayDate);
    const weekendEntries = pastEntries.filter(e => e.isWeekend).sort((a, b) => a.date.localeCompare(b.date));
    const isNurse = prof.category === 'nurse';
    const Icon = isNurse ? Stethoscope : Syringe;
    const avatarUrl = avatarMap[prof.id];

    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <Button variant="ghost" size="sm" onClick={() => setSelectedProf(null)} className="gap-1">
            <ChevronLeft className="w-4 h-4" /> Voltar
          </Button>
          <Button variant="outline" size="sm" onClick={() => downloadPDF(prof)} className="gap-2">
            <Download className="w-4 h-4" /> Baixar PDF
          </Button>
        </div>

        {/* Profile Header */}
        <div className="form-section">
          <div className="flex items-center gap-4">
            {avatarUrl ? (
              <img
                src={avatarUrl}
                alt={prof.name}
                className="w-14 h-14 rounded-xl object-cover shrink-0 border-2 border-border"
              />
            ) : (
              <div className={cn(
                "w-14 h-14 rounded-xl flex items-center justify-center",
                isNurse ? "cat-icon-nurse" : "cat-icon-tech"
              )}>
                <Icon className="w-6 h-6" />
              </div>
            )}
            <div className="flex-1 min-w-0">
              <h2 className="text-xl font-bold truncate">{prof.name}</h2>
              {emailMap[prof.id] && <p className="text-sm text-muted-foreground truncate">{emailMap[prof.id]}</p>}
              <div className="flex flex-wrap items-center gap-2 mt-1">
                <Badge variant="secondary" className={isNurse ? 'cat-text-nurse' : 'cat-text-tech'}>
                  {isNurse ? 'Enfermeiro(a)' : 'Técnico(a)'}
                </Badge>
                <span className="text-xs text-muted-foreground flex items-center gap-1">
                  <Clock className="w-3 h-3" /> {prof.monthlyHours}h/mês
                </span>
                {!prof.active && <Badge variant="destructive">Inativo</Badge>}
              </div>
            </div>
          </div>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { label: 'Dias Trabalhados', value: stats.workedDays, icon: Calendar, color: 'text-primary' },
            { label: 'Fins de Semana', value: stats.weekendDays, icon: Calendar, color: 'text-warning-foreground' },
            { label: 'Créditos Gerados', value: `+${stats.creditsGenerated}`, icon: TrendingUp, color: 'text-accent' },
            { label: 'Créditos Usados', value: stats.creditsUsed, icon: TrendingDown, color: 'text-destructive' },
          ].map(item => (
            <div key={item.label} className="form-section !p-4 text-center">
              <item.icon className={cn("w-4 h-4 mx-auto mb-1", item.color)} />
              <div className={cn("text-2xl font-bold", item.color)}>{item.value}</div>
              <p className="text-[11px] text-muted-foreground mt-1">{item.label}</p>
            </div>
          ))}
        </div>

        {/* Balance */}
        <div className={cn(
          "form-section !p-4 flex items-center justify-between",
          stats.creditsBalance > 0 ? "border-accent/30" : stats.creditsBalance < 0 ? "border-destructive/30" : ""
        )}>
          <span className="font-semibold">Saldo Disponível</span>
          <span className={cn(
            "text-3xl font-bold",
            stats.creditsBalance > 0 ? "text-accent" : stats.creditsBalance < 0 ? "text-destructive" : "text-muted-foreground"
          )}>
            {stats.creditsBalance} <span className="text-sm font-normal text-muted-foreground">dias</span>
          </span>
        </div>

        {/* Weekend History */}
        {weekendEntries.length > 0 && (
          <div className="form-section">
            <h3 className="font-semibold text-sm mb-3 flex items-center gap-2">
              <Calendar className="w-4 h-4 text-primary" />
              Fins de Semana Trabalhados ({weekendEntries.length})
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {weekendEntries.map((entry, i) => (
                <div key={entry.id} className="flex items-center gap-2 text-sm py-1.5 px-3 rounded-lg bg-muted/50">
                  <span className="text-muted-foreground text-xs w-5">{i + 1}.</span>
                  <span className="capitalize">
                    {format(parseISO(entry.date), "dd/MM/yyyy (EEEE)", { locale: ptBR })}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Leave History */}
        <div className="form-section">
          <h3 className="font-semibold text-sm mb-3 flex items-center gap-2">
            <Users className="w-4 h-4 text-primary" />
            Histórico de Folgas ({leaveReqs.length})
          </h3>
          {leaveReqs.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">Nenhuma folga registrada.</p>
          ) : (
            <div className="space-y-2">
              {leaveReqs.sort((a, b) => b.createdAt.localeCompare(a.createdAt)).map(req => (
                <div key={req.id} className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 py-3 px-4 rounded-lg bg-muted/30 border border-border">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-medium">
                        {LEAVE_TYPE_LABELS[req.leaveType as LeaveType] || req.leaveType}
                      </span>
                      <Badge variant={req.status === 'approved' ? 'default' : req.status === 'rejected' ? 'destructive' : 'secondary'} className="text-[10px]">
                        {req.status === 'approved' ? 'Aprovado' : req.status === 'rejected' ? 'Rejeitado' : 'Pendente'}
                      </Badge>
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {req.leaveDates.map(d => format(parseISO(d), "dd/MM", { locale: ptBR })).join(', ')}
                      {req.observations && ` — ${req.observations}`}
                    </p>
                  </div>
                  <span className="text-xs text-muted-foreground shrink-0">{req.daysRequested} dia(s)</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    );
  };

  // ── Main Render ──
  if (selectedProf) {
    return (
      <div className="animate-fade-in space-y-6 max-w-3xl mx-auto">
        {renderDetail(selectedProf)}
      </div>
    );
  }

  return (
    <div className="animate-fade-in space-y-6 max-w-6xl mx-auto">
      <PageHeader
        title="Profissionais"
        description="Clique em um profissional para ver detalhes de créditos e folgas"
      />

      <div className="relative w-full max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input
          placeholder="Buscar por nome..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="pl-10 h-11 bg-card shadow-sm"
        />
      </div>

      <Tabs value={activeTab} onValueChange={v => setActiveTab(v as 'nurse' | 'tech')} className="w-full">
        <TabsList className="grid w-full grid-cols-2 h-12 p-1 bg-muted/50 rounded-xl mb-6">
          <TabsTrigger value="nurse" className="rounded-lg h-10 data-[state=active]:shadow-md transition-all gap-2">
            <Stethoscope className="w-4 h-4" />
            <span className="font-bold">Enfermeiros</span>
            <span className="hidden sm:inline bg-muted py-0.5 px-2 rounded-full text-[10px]">{nurses.length}</span>
          </TabsTrigger>
          <TabsTrigger value="tech" className="rounded-lg h-10 data-[state=active]:shadow-md transition-all gap-2">
            <Syringe className="w-4 h-4" />
            <span className="font-bold">Técnicos</span>
            <span className="hidden sm:inline bg-muted py-0.5 px-2 rounded-full text-[10px]">{techs.length}</span>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="nurse" className="focus-visible:outline-none">
          {nurses.length === 0 ? (
            <EmptyState icon={Stethoscope} title="Nenhum enfermeiro encontrado" description="Enfermeiros são adicionados via Links & Aprovações." />
          ) : (
            <div className="space-y-6">
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {paginatedNurses.map(prof => <ProfessionalCard key={prof.id} prof={prof} />)}
              </div>
              {paginatedNurses.length < nurses.length && (
                <div className="flex justify-center pt-2">
                  <Button variant="ghost" className="text-xs font-bold uppercase tracking-widest hover:bg-primary/10 hover:text-primary transition-colors" onClick={() => setNursePage(p => p + 1)}>
                    Ver mais {nurses.length - paginatedNurses.length} profissionais
                  </Button>
                </div>
              )}
            </div>
          )}
        </TabsContent>

        <TabsContent value="tech" className="focus-visible:outline-none">
          {techs.length === 0 ? (
            <EmptyState icon={Syringe} title="Nenhum técnico encontrado" description="Técnicos são adicionados via Links & Aprovações." />
          ) : (
            <div className="space-y-6">
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {paginatedTechs.map(prof => <ProfessionalCard key={prof.id} prof={prof} />)}
              </div>
              {paginatedTechs.length < techs.length && (
                <div className="flex justify-center pt-2">
                  <Button variant="ghost" className="text-xs font-bold uppercase tracking-widest hover:bg-primary/10 hover:text-primary transition-colors" onClick={() => setTechPage(p => p + 1)}>
                    Ver mais {techs.length - paginatedTechs.length} profissionais
                  </Button>
                </div>
              )}
            </div>
          )}
        </TabsContent>
      </Tabs>

      <p className="text-xs text-muted-foreground">{filtered.length} profissional(is) no total</p>
    </div>
  );
}
