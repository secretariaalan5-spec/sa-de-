export interface ServiceScheduleEntry {
    id: string;
    professionalId: string;
    date: string; // ISO date string
    type: 'nurse' | 'tech';
    status?: 'vacation' | 'pregnant' | 'normal';
    isWeekend?: boolean;
}

export interface ServiceScheduleStats {
    professionalId: string;
    professionalName: string;
    category: 'nurse' | 'tech';
    workedDays: number;
    weekendDays: number;
    creditsGenerated: number; // weekendDays * 2
    creditsUsed: number;
    creditsBalance: number;
}

export type LeaveType = 'ferias' | 'licenca_medica' | 'licenca' | 'capacitacao' | 'outros';

export const LEAVE_TYPE_LABELS: Record<LeaveType, string> = {
    ferias: 'Férias',
    licenca_medica: 'Licença Médica',
    licenca: 'Licença',
    capacitacao: 'Capacitação',
    outros: 'Outros',
};

export interface LeaveRequest {
    id: string;
    professionalId: string;
    category: 'nurse' | 'tech';
    leaveType: LeaveType;
    requestDate: string;
    leaveDates: string[];
    daysRequested: number;
    observations?: string;
    status: 'pending' | 'approved' | 'rejected';
    createdAt: string;
}

export interface ServiceProfessional {
    id: string;
    name: string;
    category: 'nurse' | 'tech';
    monthlyHours: number;
    active: boolean;
}
