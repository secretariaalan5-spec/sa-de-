/**
 * ServiceProfessionals — Lista de profissionais aprovados para escalas de serviço.
 *
 * Exibe enfermeiros e técnicos em cards padronizados (mesmo layout de EmultProfessionals).
 * Organiza por abas com busca e paginação.
 */

import { useState, useMemo, useEffect, useCallback } from 'react';
import { PageHeader } from '@/components/shared/PageHeader';
import { EmptyState } from '@/components/shared/EmptyState';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Stethoscope, Syringe, Search, Users, Trash2, Mail } from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useServiceProfessionals } from '@/hooks/useServiceProfessionals';
import { useLeaveRequests } from '@/hooks/useLeaveRequests';
import { ServiceProfessional } from '@/types/serviceSchedule';
import { format } from 'date-fns';

const ITEMS_PER_PAGE = 12;

export default function ServiceProfessionalsPage() {
  const { professionals, deleteProfessional } = useServiceProfessionals();
  const { requests } = useLeaveRequests();
  const [searchTerm, setSearchTerm] = useState('');
  const [activeTab, setActiveTab] = useState<'nurse' | 'tech'>('nurse');
  const [nursePage, setNursePage] = useState(1);
  const [techPage, setTechPage] = useState(1);

  /** Filtro global por nome */
  const filtered = useMemo(() => {
    if (!searchTerm.trim()) return professionals;
    const term = searchTerm.toLowerCase();
    return professionals.filter(p => p.name.toLowerCase().includes(term));
  }, [professionals, searchTerm]);

  const nurses = useMemo(() => filtered.filter(p => p.category === 'nurse'), [filtered]);
  const techs = useMemo(() => filtered.filter(p => p.category === 'tech'), [filtered]);

  const paginatedNurses = nurses.slice(0, nursePage * ITEMS_PER_PAGE);
  const paginatedTechs = techs.slice(0, techPage * ITEMS_PER_PAGE);

  /** Reset da paginação ao alterar busca */
  useEffect(() => {
    setNursePage(1);
    setTechPage(1);
  }, [searchTerm]);

  const today = format(new Date(), 'yyyy-MM-dd');

  /**
   * ProfessionalCard — Card padronizado idêntico ao estilo de EmultProfessionals.
   * Usa page-card + barra de cor da categoria + ícone arredondado.
   */
  const ProfessionalCard = ({ prof }: { prof: ServiceProfessional }) => {
    const isOnLeave = requests.some(r =>
      r.professionalId === prof.id && r.leaveDates.includes(today)
    );
    const isNurse = prof.category === 'nurse';

    /** Classes de categoria para barra e ícone */
    const catBar = isNurse ? 'cat-bar-nurse' : 'cat-bar-tech';
    const catIcon = isNurse ? 'cat-icon-nurse' : 'cat-icon-tech';
    const catText = isNurse ? 'cat-text-nurse' : 'cat-text-tech';
    const catLabel = isNurse ? 'Enfermeiro' : 'Técnico';
    const Icon = isNurse ? Stethoscope : Syringe;

    return (
      <div className="page-card overflow-hidden group">
        {/* Barra de cor da categoria */}
        <div className={`h-1 -mx-5 -mt-5 mb-4 ${catBar}`} />

        <div className="flex items-center gap-3">
          {/* Ícone com cor da categoria */}
          <div className={`w-11 h-11 rounded-xl flex items-center justify-center shrink-0 ${catIcon}`}>
            <Icon className="w-4 h-4" />
          </div>

          {/* Dados do profissional */}
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <h3 className="font-bold text-sm text-foreground truncate">{prof.name}</h3>
              {/* Indicador de folga */}
              {isOnLeave && (
                <span className="flex h-2 w-2 rounded-full bg-warning animate-pulse shrink-0" title="De Folga Hoje" />
              )}
            </div>
            <p className="text-xs text-muted-foreground">{prof.monthlyHours}h mensal</p>
            <div className="flex flex-wrap gap-1 mt-1">
              <Badge variant="secondary" className={`text-[10px] ${catText}`}>{catLabel}</Badge>
              {isOnLeave && (
                <Badge variant="outline" className="text-[10px] text-warning border-warning/30">De Folga</Badge>
              )}
              {!prof.active && (
                <Badge variant="outline" className="text-[10px] text-destructive border-destructive/30">Inativo</Badge>
              )}
            </div>
          </div>

          {/* Botão de remoção */}
          <Button
            size="icon"
            variant="ghost"
            className="h-8 w-8 text-muted-foreground hover:text-destructive shrink-0 opacity-100 sm:opacity-0 group-hover:opacity-100 transition-opacity"
            onClick={() => deleteProfessional(prof.id)}
            title="Remover profissional"
          >
            <Trash2 className="w-4 h-4" />
          </Button>
        </div>
      </div>
    );
  };

  return (
    <div className="animate-fade-in space-y-6 max-w-6xl mx-auto">
      {/* Cabeçalho da página */}
      <PageHeader
        title="Profissionais"
        description="Enfermeiros e técnicos cadastrados para as escalas de serviço"
      />

      {/* Busca + Abas */}
      <div className="flex flex-col gap-6">
        {/* Campo de busca */}
        <div className="relative w-full max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Buscar por nome..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10 h-11 bg-card shadow-sm"
          />
        </div>

        {/* Abas: Enfermeiros / Técnicos */}
        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as 'nurse' | 'tech')} className="w-full">
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

          {/* Aba Enfermeiros */}
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

          {/* Aba Técnicos */}
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

        {/* Contador total */}
        <p className="text-xs text-muted-foreground">
          {filtered.length} profissional(is) no total
        </p>
      </div>
    </div>
  );
}
