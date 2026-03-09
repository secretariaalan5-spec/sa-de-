import { Outlet } from 'react-router-dom';
import { Sidebar } from './Sidebar';
import { HeaderBar } from './HeaderBar';
import { useAutoAcceptInvite } from '@/hooks/useAutoAcceptInvite';

export function AppLayout() {
  useAutoAcceptInvite();

  return (
    <>
      <div className="min-h-screen flex w-full">
        <Sidebar />
        <div className="flex-1 flex flex-col lg:ml-0 overflow-x-hidden">
          <HeaderBar />
          <main className="flex-1">
            <div className="p-4 lg:p-8 pt-2">
              <Outlet />
            </div>
          </main>
        </div>
      </div>
    </>
  );
}
