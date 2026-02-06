import { useState, useEffect } from 'react';
import { format, startOfMonth, endOfMonth, eachDayOfInterval, getDay, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { ChevronLeft, ChevronRight, Calendar, Users, Stethoscope, Syringe, AlertCircle, RefreshCw } from 'lucide-react';
import { cn } from '@/lib/utils';
import { supabase } from '@/integrations/supabase/client';
import { Skeleton } from '@/components/ui/skeleton';

interface ServiceProfessional {
  id: string;
  name: string;
  category: 'tech' | 'nurse';
  monthlyHours: number;
  isActive: boolean;
}

interface ServiceScheduleEntry {
  id: string;
  professionalId: string;
  date: string;
  type: 'nurse' | 'tech';
  isWeekend: boolean;
}

interface Professional {
  id: string;
  name: string;
  functionId: string;
  weeklyHours: number;
}

interface Unit {
  id: string;
  name: string;
  address?: string;
}

interface ProfessionalFunction {
  id: string;
  name: string;
  color: string;
}

interface ScheduleEntry {
  id: string;
  professionalId: string;
  unitId: string;
  dayOfWeek: string;
  period: string;
}

interface PortalData {
  publishedAt: string;
  emult: {
    professionals: Professional[];
    units: Unit[];
    functions: ProfessionalFunction[];
    schedule: ScheduleEntry[];
  };
  service: {
    professionals: ServiceProfessional[];
    nurseEntries: ServiceScheduleEntry[];
    techEntries: ServiceScheduleEntry[];
  };
}

const DAYS_OF_WEEK = ['Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta'];
const PERIODS = [
  { key: 'manha', label: 'Manhã' },
  { key: 'tarde', label: 'Tarde' },
  { key: 'integral', label: 'Integral' },
];

export default function Portal() {
  const [portalData, setPortalData] = useState<PortalData | null>(null);
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [loading, setLoading] = useState(true);

  const fetchPortalData = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('portal_schedules')
        .select('*')
        .order('published_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (error) throw error;

      if (data) {
        const emultData = data.emult_data as unknown as PortalData['emult'];
        const serviceData = data.service_data as unknown as PortalData['service'];
        
        setPortalData({
          publishedAt: data.published_at,
          emult: emultData,
          service: serviceData,
        });
      }
    } catch (error) {
      console.error('Erro ao carregar dados do portal:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPortalData();
  }, []);

  const goToPreviousMonth = () => {
    setCurrentMonth(prev => new Date(prev.getFullYear(), prev.getMonth() - 1, 1));
  };

  const goToNextMonth = () => {
    setCurrentMonth(prev => new Date(prev.getFullYear(), prev.getMonth() + 1, 1));
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-primary/5 via-background to-secondary/5">
        <header className="border-b bg-card/80 backdrop-blur-sm sticky top-0 z-10">
          <div className="container mx-auto px-4 py-4">
            <div className="flex items-center gap-3">
              <Skeleton className="h-12 w-12 rounded-lg" />
              <div className="space-y-2">
                <Skeleton className="h-6 w-48" />
                <Skeleton className="h-4 w-32" />
              </div>
            </div>
          </div>
        </header>
        <main className="container mx-auto px-4 py-8">
          <Skeleton className="h-12 w-64 mb-6" />
          <div className="grid gap-4">
            <Skeleton className="h-64 w-full rounded-xl" />
            <Skeleton className="h-64 w-full rounded-xl" />
          </div>
        </main>
      </div>
    );
  }

  if (!portalData) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-primary/5 via-background to-secondary/5 flex items-center justify-center p-4">
        <Card className="max-w-md w-full shadow-xl border-0 bg-card/80 backdrop-blur-sm">
          <CardContent className="pt-8 pb-8 text-center">
            <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mx-auto mb-4">
              <AlertCircle className="h-8 w-8 text-muted-foreground" />
            </div>
            <h2 className="text-2xl font-bold mb-2">Nenhuma escala publicada</h2>
            <p className="text-muted-foreground mb-6">
              As escalas ainda não foram publicadas para visualização.
              Entre em contato com o administrador.
            </p>
            <Button variant="outline" onClick={fetchPortalData} className="gap-2">
              <RefreshCw className="h-4 w-4" />
              Tentar novamente
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const renderServiceCalendar = (type: 'nurse' | 'tech') => {
    const entries = type === 'nurse' ? portalData.service.nurseEntries : portalData.service.techEntries;
    const professionals = portalData.service.professionals.filter(p => p.category === type && p.isActive);

    const monthStart = startOfMonth(currentMonth);
    const monthEnd = endOfMonth(currentMonth);
    const daysInMonth = eachDayOfInterval({ start: monthStart, end: monthEnd });

    const getEntriesForDate = (dateStr: string) => {
      return entries.filter(e => e.date === dateStr);
    };

    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between bg-muted/50 rounded-xl p-3">
          <Button variant="ghost" size="icon" onClick={goToPreviousMonth} className="hover:bg-background">
            <ChevronLeft className="h-5 w-5" />
          </Button>
          <h3 className="text-lg font-semibold capitalize">
            {format(currentMonth, 'MMMM yyyy', { locale: ptBR })}
          </h3>
          <Button variant="ghost" size="icon" onClick={goToNextMonth} className="hover:bg-background">
            <ChevronRight className="h-5 w-5" />
          </Button>
        </div>

        <div className="overflow-x-auto rounded-xl border bg-card">
          <div className="grid grid-cols-7 gap-px bg-muted min-w-[700px]">
            {['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'].map(day => (
              <div key={day} className="text-center text-sm font-semibold p-3 bg-muted/80 text-muted-foreground">
                {day}
              </div>
            ))}

            {Array.from({ length: getDay(monthStart) }).map((_, i) => (
              <div key={`empty-start-${i}`} className="p-2 bg-background min-h-[100px]" />
            ))}

            {daysInMonth.map(day => {
              const dateStr = format(day, 'yyyy-MM-dd');
              const dayEntries = getEntriesForDate(dateStr);
              const dayOfWeek = getDay(day);
              const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;

              return (
                <div
                  key={dateStr}
                  className={cn(
                    "min-h-[100px] p-2 bg-background transition-colors",
                    isWeekend && "bg-amber-50/50 dark:bg-amber-950/20"
                  )}
                >
                  <div className={cn(
                    "text-sm font-semibold mb-2 w-7 h-7 flex items-center justify-center rounded-full",
                    isWeekend ? "bg-amber-100 dark:bg-amber-900/50 text-amber-700 dark:text-amber-400" : "text-foreground"
                  )}>
                    {format(day, 'd')}
                  </div>
                  <div className="space-y-1">
                    {dayEntries.map(entry => {
                      const prof = professionals.find(p => p.id === entry.professionalId);
                      return (
                        <div
                          key={entry.id}
                          className={cn(
                            "text-xs px-2 py-1 rounded-md truncate font-medium",
                            type === 'nurse' 
                              ? "bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300" 
                              : "bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300"
                          )}
                          title={prof?.name}
                        >
                          {prof?.name?.split(' ')[0] || 'N/A'}
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div className="flex items-center gap-6 text-sm text-muted-foreground bg-muted/30 rounded-lg p-3">
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 rounded bg-amber-100 dark:bg-amber-900/50 border border-amber-300 dark:border-amber-700" />
            <span>Fim de semana</span>
          </div>
          <div className="flex items-center gap-2">
            <div className={cn(
              "w-4 h-4 rounded",
              type === 'nurse' 
                ? "bg-emerald-100 dark:bg-emerald-900/40 border border-emerald-300 dark:border-emerald-700" 
                : "bg-blue-100 dark:bg-blue-900/40 border border-blue-300 dark:border-blue-700"
            )} />
            <span>{type === 'nurse' ? 'Enfermeiro escalado' : 'Técnico escalado'}</span>
          </div>
        </div>
      </div>
    );
  };

  const renderEmultSchedule = () => {
    const { professionals, units, functions, schedule } = portalData.emult;

    if (units.length === 0) {
      return (
        <div className="text-center py-12 text-muted-foreground">
          <Users className="h-12 w-12 mx-auto mb-4 opacity-50" />
          <p className="text-lg">Nenhuma unidade cadastrada na escala eMult.</p>
        </div>
      );
    }

    return (
      <div className="space-y-6">
        {units.map(unit => (
          <Card key={unit.id} className="overflow-hidden border-0 shadow-md">
            <CardHeader className="bg-gradient-to-r from-primary/10 to-primary/5 pb-4">
              <CardTitle className="text-lg flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-primary" />
                {unit.name}
              </CardTitle>
              {unit.address && (
                <p className="text-sm text-muted-foreground">{unit.address}</p>
              )}
            </CardHeader>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b bg-muted/30">
                      <th className="text-left p-4 font-semibold text-muted-foreground">Período</th>
                      {DAYS_OF_WEEK.map(day => (
                        <th key={day} className="text-center p-4 font-semibold text-muted-foreground">{day}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {PERIODS.map(period => (
                      <tr key={period.key} className="border-b last:border-0 hover:bg-muted/20 transition-colors">
                        <td className="p-4 font-medium">{period.label}</td>
                        {DAYS_OF_WEEK.map(day => {
                          const entry = schedule.find(
                            s => s.unitId === unit.id && s.dayOfWeek === day && s.period === period.key
                          );
                          const professional = entry
                            ? professionals.find(p => p.id === entry.professionalId)
                            : null;
                          const func = professional
                            ? functions.find(f => f.id === professional.functionId)
                            : null;

                          return (
                            <td key={day} className="text-center p-3">
                              {professional ? (
                                <div
                                  className="inline-flex px-3 py-1.5 rounded-full text-white text-xs font-medium shadow-sm"
                                  style={{ backgroundColor: func?.color || '#6b7280' }}
                                  title={`${professional.name} - ${func?.name || ''}`}
                                >
                                  {professional.name.split(' ')[0]}
                                </div>
                              ) : (
                                <span className="text-muted-foreground/50">—</span>
                              )}
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary/5 via-background to-secondary/5">
      <header className="border-b bg-card/80 backdrop-blur-sm sticky top-0 z-10 shadow-sm">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-primary to-primary/80 flex items-center justify-center shadow-lg">
                <img
                  src="/logo-saude-plus.png"
                  alt="Saúde+"
                  className="h-8 w-auto"
                  onError={(e) => {
                    e.currentTarget.style.display = 'none';
                  }}
                />
              </div>
              <div>
                <h1 className="text-xl font-bold tracking-tight">Portal de Escalas</h1>
                <p className="text-xs text-muted-foreground">
                  Atualizado em {format(parseISO(portalData.publishedAt), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                </p>
              </div>
            </div>
            <Button variant="ghost" size="icon" onClick={fetchPortalData} className="text-muted-foreground hover:text-foreground">
              <RefreshCw className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        <Tabs defaultValue="emult" className="space-y-6">
          <TabsList className="grid w-full grid-cols-3 max-w-lg mx-auto h-14 p-1 bg-muted/50 backdrop-blur-sm">
            <TabsTrigger value="emult" className="flex items-center gap-2 data-[state=active]:bg-background data-[state=active]:shadow-sm rounded-lg">
              <Users className="h-4 w-4" />
              <span className="hidden sm:inline font-medium">eMult</span>
            </TabsTrigger>
            <TabsTrigger value="nurses" className="flex items-center gap-2 data-[state=active]:bg-background data-[state=active]:shadow-sm rounded-lg">
              <Stethoscope className="h-4 w-4" />
              <span className="hidden sm:inline font-medium">Enfermeiros</span>
            </TabsTrigger>
            <TabsTrigger value="techs" className="flex items-center gap-2 data-[state=active]:bg-background data-[state=active]:shadow-sm rounded-lg">
              <Syringe className="h-4 w-4" />
              <span className="hidden sm:inline font-medium">Técnicos</span>
            </TabsTrigger>
          </TabsList>

          <TabsContent value="emult" className="mt-6">
            <Card className="border-0 shadow-lg bg-card/80 backdrop-blur-sm">
              <CardHeader className="border-b bg-muted/20">
                <CardTitle className="flex items-center gap-3 text-xl">
                  <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                    <Calendar className="h-5 w-5 text-primary" />
                  </div>
                  Escala eMult — Por Unidade
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-6">
                {renderEmultSchedule()}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="nurses" className="mt-6">
            <Card className="border-0 shadow-lg bg-card/80 backdrop-blur-sm">
              <CardHeader className="border-b bg-muted/20">
                <CardTitle className="flex items-center gap-3 text-xl">
                  <div className="w-10 h-10 rounded-lg bg-emerald-100 dark:bg-emerald-900/40 flex items-center justify-center">
                    <Stethoscope className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
                  </div>
                  Escala de Enfermeiros
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-6">
                {renderServiceCalendar('nurse')}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="techs" className="mt-6">
            <Card className="border-0 shadow-lg bg-card/80 backdrop-blur-sm">
              <CardHeader className="border-b bg-muted/20">
                <CardTitle className="flex items-center gap-3 text-xl">
                  <div className="w-10 h-10 rounded-lg bg-blue-100 dark:bg-blue-900/40 flex items-center justify-center">
                    <Syringe className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                  </div>
                  Escala de Técnicos
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-6">
                {renderServiceCalendar('tech')}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </main>

      <footer className="border-t bg-card/50 backdrop-blur-sm mt-12">
        <div className="container mx-auto px-4 py-6 text-center">
          <p className="text-sm text-muted-foreground">
            Portal de visualização de escalas — <span className="font-medium">Somente leitura</span>
          </p>
        </div>
      </footer>
    </div>
  );
}
