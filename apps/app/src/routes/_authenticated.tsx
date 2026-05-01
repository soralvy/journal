import { Navigate, Outlet } from '@tanstack/react-router';

import { useCurrentUser } from '../features/auth';

export const AuthenticatedLayout = () => {
  const { isLoading, data: user, isError } = useCurrentUser();

  if (isLoading) {
    return (
      <div className="bg-background fixed inset-0 z-50 flex flex-col items-center justify-center transition-opacity duration-300">
        <div className="flex flex-col items-center">
          <div className="relative flex items-center justify-center">
            <div className="border-secondary absolute inset-0 rounded-full border opacity-20"></div>

            <div className="border-t-primary size-10 animate-spin rounded-full border border-transparent"></div>
          </div>

          <span className="font-display text-secondary text-l mt-5 animate-pulse font-semibold tracking-[0.2em] uppercase opacity-70">
            Initializing
          </span>
        </div>
      </div>
    );
  }

  if (isError || !user) {
    return <Navigate to="/" replace />;
  }
  return <Outlet />;
};
