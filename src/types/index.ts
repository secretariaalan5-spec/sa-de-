export interface Professional {
  id: string;
  name: string;
  functionId: string;
  team: string;
  weeklyHours: number;
  active: boolean;
}

export interface Unit {
  id: string;
  name: string;
  type: string;
  active: boolean;
}

export interface ProfessionalFunction {
  id: string;
  name: string;
  color: string;
}

export interface ScheduleEntry {
  id: string;
  professionalId: string;
  unitId: string;
  dayOfWeek: DayOfWeek;
  period: Period;
}

export interface Restriction {
  id: string;
  type: 'unit' | 'professional';
  professionalId: string;
  targetId: string; // unitId or another professionalId
  reason?: string;
}

export type DayOfWeek = 'segunda' | 'terca' | 'quarta' | 'quinta' | 'sexta';
export type Period = 'manha' | 'tarde' | 'integral';

export const DAYS_OF_WEEK: { key: DayOfWeek; label: string }[] = [
  { key: 'segunda', label: 'Segunda' },
  { key: 'terca', label: 'Terça' },
  { key: 'quarta', label: 'Quarta' },
  { key: 'quinta', label: 'Quinta' },
  { key: 'sexta', label: 'Sexta' },
];

export const PERIODS: { key: Period; label: string; hours: number }[] = [
  { key: 'manha', label: 'Manhã', hours: 4 },
  { key: 'tarde', label: 'Tarde', hours: 4 },
  { key: 'integral', label: 'Integral', hours: 8 },
];

export interface AppData {
  professionals: Professional[];
  units: Unit[];
  functions: ProfessionalFunction[];
  schedule: ScheduleEntry[];
  restrictions: Restriction[];
}
