import { Outlet } from 'react-router-dom';
import { Sidebar } from './Sidebar';
import { MobileNavBar } from './MobileNavBar';

export function AppLayout() {
  return (
    <>
      <div className="min-h-screen flex w-full">
        <Sidebar />
        <main className="flex-1 lg:ml-0 overflow-x-hidden pb-16 lg:pb-0">
          <div className="p-4 lg:p-8 pt-16 lg:pt-8">
            <Outlet />
          </div>
        </main>
      </div>
      <MobileNavBar />
    </>
  );
}
