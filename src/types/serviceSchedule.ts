export interface ServiceScheduleEntry {
    id: string;
    professionalId: string;
    date: string; // ISO date string
    type: string; // category slug (e.g. 'nurse', 'tech', or any dynamic category)
    status?: 'vacation' | 'pregnant' | 'normal';
    isWeekend?: boolean;
}

export interface ServiceScheduleStats {
    professionalId: string;
    professionalName: string;
    category: string;
    workedDays: number;
    weekendDays: number;
    creditsGenerated: number; // weekendDays * 2
    creditsUsed: number;
    creditsBalance: number;
}

export type LeaveType = 'folga_credito';

export const LEAVE_TYPE_LABELS: Record<string, string> = {
    folga_credito: 'Pedido de Folga FDS',
};

export interface LeaveRequest {
    id: string;
    professionalId: string;
    category: string;
    leaveType: LeaveType;
    requestDate: string;
    leaveDates: string[];
    daysRequested: number;
    absenceType?: 'folga' | 'ferias' | 'licenca' | 'atestado';
    observations?: string;
    status: 'pending' | 'approved' | 'rejected';
    createdAt: string;
    /** ID do pedido na tabela professional_leave_requests (portal) — usado para sincronizar exclusões */
    portalLeaveId?: string;
}

export interface ServiceProfessional {
    id: string;
    name: string;
    category: string; // dynamic category slug
    monthlyHours: number;
    active: boolean;
}
