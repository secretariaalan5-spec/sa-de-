/**
 * Hook de conveniência que expõe o contexto de estado de serviços.
 * Use este hook em vez de acessar ServiceStateContext diretamente.
 */
import { useServiceStateContext } from '@/contexts/ServiceStateContext';

export function useServiceState() {
    return useServiceStateContext();
}
