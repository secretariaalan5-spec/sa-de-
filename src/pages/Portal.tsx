import { useState, useEffect } from 'react';
import { format, startOfMonth, endOfMonth, eachDayOfInterval, getDay, parseISO, isSameMonth } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { ChevronLeft, ChevronRight, Calendar, Users, Stethoscope, Syringe, AlertCircle } from 'lucide-react';
import { cn } from '@/lib/utils';

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

const PORTAL_DATA_KEY = 'escala-portal-data';
const DAYS_OF_WEEK = ['Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta'];
const PERIODS = [
  { key: 'manha', label: 'Manhã' },
  { key: 'tarde', label: 'Tarde' },
  { key: 'integral', label: 'Integral' },
];

export default function Portal() {
  const [portalData, setPortalData] = useState<PortalData | null>(null);
  const [currentMonth, setCurrentMonth] = useState(new Date());

  useEffect(() => {
    const stored = localStorage.getItem(PORTAL_DATA_KEY);
    if (stored) {
      try {
        setPortalData(JSON.parse(stored));
      } catch {
        console.error('Erro ao carregar dados do portal');
      }
    }
  }, []);

  const goToPreviousMonth = () => {
    setCurrentMonth(prev => new Date(prev.getFullYear(), prev.getMonth() - 1, 1));
  };

  const goToNextMonth = () => {
    setCurrentMonth(prev => new Date(prev.getFullYear(), prev.getMonth() + 1, 1));
  };

  if (!portalData) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <Card className="max-w-md w-full">
          <CardContent className="pt-6 text-center">
            <AlertCircle className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
            <h2 className="text-xl font-semibold mb-2">Nenhuma escala publicada</h2>
            <p className="text-muted-foreground">
              As escalas ainda não foram publicadas para visualização.
              Entre em contato com o administrador.
            </p>
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
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <Button variant="outline" size="icon" onClick={goToPreviousMonth}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <h3 className="text-lg font-medium capitalize">
            {format(currentMonth, 'MMMM yyyy', { locale: ptBR })}
          </h3>
          <Button variant="outline" size="icon" onClick={goToNextMonth}>
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>

        <div className="overflow-x-auto">
          <div className="grid grid-cols-7 gap-1 min-w-[700px]">
            {['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'].map(day => (
              <div key={day} className="text-center text-sm font-medium p-2 text-muted-foreground">
                {day}
              </div>
            ))}

            {Array.from({ length: getDay(monthStart) }).map((_, i) => (
              <div key={`empty-start-${i}`} className="p-2" />
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
                    "min-h-[80px] p-1 border rounded-lg",
                    isWeekend ? "bg-amber-50 dark:bg-amber-950/20 border-amber-200 dark:border-amber-800" : "bg-card border-border"
                  )}
                >
                  <div className={cn(
                    "text-xs font-medium mb-1",
                    isWeekend ? "text-amber-700 dark:text-amber-400" : "text-muted-foreground"
                  )}>
                    {format(day, 'd')}
                  </div>
                  <div className="space-y-0.5">
                    {dayEntries.map(entry => {
                      const prof = professionals.find(p => p.id === entry.professionalId);
                      return (
                        <div
                          key={entry.id}
                          className="text-xs bg-primary/10 text-primary px-1 py-0.5 rounded truncate"
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

        <div className="flex items-center gap-4 text-sm text-muted-foreground">
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 rounded bg-amber-100 border border-amber-300" />
            <span>Fim de semana</span>
          </div>
        </div>
      </div>
    );
  };

  const renderEmultSchedule = () => {
    const { professionals, units, functions, schedule } = portalData.emult;

    if (units.length === 0) {
      return (
        <div className="text-center py-8 text-muted-foreground">
          Nenhuma unidade cadastrada na escala eMult.
        </div>
      );
    }

    return (
      <div className="space-y-6">
        {units.map(unit => (
          <Card key={unit.id}>
            <CardHeader className="pb-3">
              <CardTitle className="text-lg">{unit.name}</CardTitle>
              {unit.address && (
                <p className="text-sm text-muted-foreground">{unit.address}</p>
              )}
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b">
                      <th className="text-left p-2 font-medium">Período</th>
                      {DAYS_OF_WEEK.map(day => (
                        <th key={day} className="text-center p-2 font-medium">{day}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {PERIODS.map(period => (
                      <tr key={period.key} className="border-b last:border-0">
                        <td className="p-2 font-medium text-muted-foreground">{period.label}</td>
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
                            <td key={day} className="text-center p-2">
                              {professional ? (
                                <div
                                  className="px-2 py-1 rounded text-white text-xs"
                                  style={{ backgroundColor: func?.color || '#6b7280' }}
                                  title={`${professional.name} - ${func?.name || ''}`}
                                >
                                  {professional.name.split(' ')[0]}
                                </div>
                              ) : (
                                <span className="text-muted-foreground">-</span>
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
    <div className="min-h-screen bg-background">
      <header className="border-b bg-card">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <img
                src="/logo-saude-plus.png"
                alt="Saúde+"
                className="h-10 w-auto"
              />
              <div>
                <h1 className="text-xl font-bold">Portal de Escalas</h1>
                <p className="text-xs text-muted-foreground">
                  Atualizado em: {format(parseISO(portalData.publishedAt), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                </p>
              </div>
            </div>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-6">
        <Tabs defaultValue="emult" className="space-y-4">
          <TabsList className="grid w-full grid-cols-3 max-w-md">
            <TabsTrigger value="emult" className="flex items-center gap-2">
              <Users className="h-4 w-4" />
              <span className="hidden sm:inline">eMult</span>
            </TabsTrigger>
            <TabsTrigger value="nurses" className="flex items-center gap-2">
              <Stethoscope className="h-4 w-4" />
              <span className="hidden sm:inline">Enfermeiros</span>
            </TabsTrigger>
            <TabsTrigger value="techs" className="flex items-center gap-2">
              <Syringe className="h-4 w-4" />
              <span className="hidden sm:inline">Técnicos</span>
            </TabsTrigger>
          </TabsList>

          <TabsContent value="emult">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Calendar className="h-5 w-5" />
                  Escala eMult - Por Unidade
                </CardTitle>
              </CardHeader>
              <CardContent>
                {renderEmultSchedule()}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="nurses">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Stethoscope className="h-5 w-5" />
                  Escala de Enfermeiros
                </CardTitle>
              </CardHeader>
              <CardContent>
                {renderServiceCalendar('nurse')}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="techs">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Syringe className="h-5 w-5" />
                  Escala de Técnicos
                </CardTitle>
              </CardHeader>
              <CardContent>
                {renderServiceCalendar('tech')}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </main>

      <footer className="border-t bg-card mt-8">
        <div className="container mx-auto px-4 py-4 text-center text-sm text-muted-foreground">
          Portal de visualização de escalas - Somente leitura
        </div>
      </footer>
    </div>
  );
}
