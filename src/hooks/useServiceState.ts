import { useServiceStateContext } from '@/contexts/ServiceStateContext';

export function useServiceState() {
    return useServiceStateContext();
}
