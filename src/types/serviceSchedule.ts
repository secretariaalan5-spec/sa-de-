export interface ServiceScheduleEntry {
    id: string;
    professionalId: string;
    date: string; // ISO date string
    type: 'nurse' | 'tech';
    status?: 'vacation' | 'pregnant' | 'normal';
}

export interface ServiceScheduleStats {
    professionalId: string;
    professionalName: string;
    workedDays: number;
    daysOffDue: number; // workedDays * 2
    daysOffTaken: number;
    remainingDaysOff: number;
}
