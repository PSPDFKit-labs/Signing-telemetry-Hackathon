import { LogOut } from '@react-zero-ui/icon-sprite';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { handleSignOut } from '@/server/auth/sign-out';

interface ProfileProps {
  name: string;
  role: string;
  avatar: string;
  subscription?: string;
  email?: string;
}

// Default avatar as data URI with a generic person outline
export const DEFAULT_AVATAR =
  "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='currentColor' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2'/%3E%3Ccircle cx='12' cy='7' r='4'/%3E%3C/svg%3E";

const defaultProfile = {
  name: 'User',
  role: 'Role',
  avatar: DEFAULT_AVATAR,
  subscription: 'Subscription',
  email: 'Email Address',
} satisfies Required<ProfileProps>;

export default function Profile({
  name = defaultProfile.name,
  email = defaultProfile.email,
}: Partial<ProfileProps> = defaultProfile) {
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const router = useRouter();

  const onLogout = async () => {
    try {
      setIsLoggingOut(true);
      await handleSignOut();
      router.push('/login'); // Redirect to login page after logout
    } catch (error) {
      console.error('Failed to sign out:', error);
    } finally {
      setIsLoggingOut(false);
    }
  };

  return (
    <div className="mx-auto w-full max-w-sm">
      <div className="relative overflow-hidden rounded-2xl">
        <div className="relative px-6 pb-6 pt-6">
          <div className=" flex items-center gap-4">
            {/* Profile Info */}
            <div className="flex-1">
              <p className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">{name}</p>
              <p className="text-zinc-600 dark:text-zinc-400">{email}</p>
            </div>
          </div>
          <div className="my-3 h-px bg-zinc-200 dark:bg-zinc-800" />
          <div className="space-y-2">
            <button
              type="button"
              onClick={onLogout}
              disabled={isLoggingOut}
              className="flex w-full items-center justify-between rounded-lg p-2 transition-colors duration-200 hover:bg-zinc-50 dark:hover:bg-zinc-800/50"
            >
              <div className="flex items-center gap-2">
                <LogOut className="h-4 w-4" />
                <span className="text-sm font-medium text-zinc-900 dark:text-zinc-100">
                  {isLoggingOut ? 'Logging out...' : 'Logout'}
                </span>
              </div>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
