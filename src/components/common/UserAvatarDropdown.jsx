import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Settings, LogOut, Moon, Sun, Monitor, RotateCcw, Trash2 } from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '../ui/avatar';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from '../ui/dropdown-menu';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '../ui/alert-dialog';
import { supabase } from '../../api/supabaseClient';
import { getUserProfile } from '../../api/userSettings';
import { useTheme } from 'next-themes';
import { toast } from 'sonner';

export function UserAvatarDropdown() {
  const navigate = useNavigate();
  const { theme, setTheme } = useTheme();
  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showFinancialResetDialog, setShowFinancialResetDialog] = useState(false);
  const [showFullResetDialog, setShowFullResetDialog] = useState(false);
  const [resetting, setResetting] = useState(false);

  useEffect(() => {
    loadUserData();

    const handleProfileUpdate = () => {
      loadUserData();
    };

    window.addEventListener('profileUpdated', handleProfileUpdate);

    return () => {
      window.removeEventListener('profileUpdated', handleProfileUpdate);
    };
  }, []);

  const loadUserData = async () => {
    try {
      const { data: { user: authUser } } = await supabase.auth.getUser();
      if (authUser) {
        setUser(authUser);
        const userProfile = await getUserProfile(authUser.id);
        setProfile(userProfile);
      }
    } catch (error) {
      console.error('Error loading user data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSignOut = async () => {
    try {
      await supabase.auth.signOut();
      navigate('/login');
    } catch (error) {
      console.error('Error signing out:', error);
    }
  };

  const handleFinancialReset = async () => {
    setResetting(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();

      if (!session) {
        toast.error('Not authenticated');
        return;
      }

      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/reset-financial-data`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${session.access_token}`,
            'Content-Type': 'application/json',
          },
        }
      );

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Failed to reset financial data');
      }

      toast.success('Your financial data has been reset. Contacts preserved.');
      setShowFinancialResetDialog(false);

      window.location.reload();
    } catch (error) {
      console.error('Error resetting financial data:', error);
      toast.error(error.message || 'Failed to reset financial data');
    } finally {
      setResetting(false);
    }
  };

  const handleFullReset = async () => {
    setResetting(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();

      if (!session) {
        toast.error('Not authenticated');
        return;
      }

      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/reset-user-data`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${session.access_token}`,
            'Content-Type': 'application/json',
          },
        }
      );

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Failed to reset data');
      }

      toast.success('Your account has been completely reset');
      setShowFullResetDialog(false);

      window.location.reload();
    } catch (error) {
      console.error('Error resetting data:', error);
      toast.error(error.message || 'Failed to reset data');
    } finally {
      setResetting(false);
    }
  };

  const getInitials = (name) => {
    if (!name) return 'U';
    return name
      .split(' ')
      .map(n => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  const displayName = profile?.display_name || profile?.full_name || user?.email?.split('@')[0] || 'Demo User';
  const userEmail = user?.email || 'demo@example.com';

  if (loading) {
    return (
      <Avatar className="h-8 w-8">
        <AvatarFallback>...</AvatarFallback>
      </Avatar>
    );
  }

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button className="flex items-center gap-2 rounded-full focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500">
            <Avatar className="h-8 w-8 cursor-pointer">
              <AvatarImage src={profile?.avatar_url} alt={displayName} />
              <AvatarFallback>{getInitials(displayName)}</AvatarFallback>
            </Avatar>
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-56">
          <DropdownMenuLabel>
            <div className="flex flex-col space-y-1">
              <p className="text-sm font-medium leading-none">{displayName}</p>
              <p className="text-xs leading-none text-muted-foreground">
                {userEmail}
              </p>
            </div>
          </DropdownMenuLabel>
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={() => navigate('/Settings')}>
            <Settings className="mr-2 h-4 w-4" />
            <span>Settings</span>
          </DropdownMenuItem>
          <DropdownMenuSub>
            <DropdownMenuSubTrigger>
              {theme === 'light' && <Sun className="mr-2 h-4 w-4" />}
              {theme === 'dark' && <Moon className="mr-2 h-4 w-4" />}
              {theme === 'system' && <Monitor className="mr-2 h-4 w-4" />}
              <span>Theme</span>
            </DropdownMenuSubTrigger>
            <DropdownMenuSubContent>
              <DropdownMenuItem onClick={() => setTheme('light')}>
                <Sun className="mr-2 h-4 w-4" />
                <span>Light</span>
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setTheme('dark')}>
                <Moon className="mr-2 h-4 w-4" />
                <span>Dark</span>
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setTheme('system')}>
                <Monitor className="mr-2 h-4 w-4" />
                <span>System</span>
              </DropdownMenuItem>
            </DropdownMenuSubContent>
          </DropdownMenuSub>
          <DropdownMenuSeparator />
          <DropdownMenuItem
            onClick={() => setShowFinancialResetDialog(true)}
            className="text-orange-600 dark:text-orange-500 focus:text-orange-600 dark:focus:text-orange-500"
          >
            <RotateCcw className="mr-2 h-4 w-4" />
            <span>Reset Financial Data</span>
          </DropdownMenuItem>
          <DropdownMenuItem
            onClick={() => setShowFullResetDialog(true)}
            className="text-destructive focus:text-destructive"
          >
            <Trash2 className="mr-2 h-4 w-4" />
            <span>Reset Everything</span>
          </DropdownMenuItem>
          <DropdownMenuItem onClick={handleSignOut}>
            <LogOut className="mr-2 h-4 w-4" />
            <span>Sign out</span>
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <AlertDialog open={showFinancialResetDialog} onOpenChange={setShowFinancialResetDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Reset Financial Data?</AlertDialogTitle>
            <AlertDialogDescription>
              This will delete all your financial data while preserving your contacts.
              <div className="mt-3 space-y-2">
                <p className="font-semibold text-destructive">What will be deleted:</p>
                <ul className="list-disc list-inside ml-2 space-y-1">
                  <li>All transactions and financial history</li>
                  <li>All accounts and balances</li>
                  <li>All budgets</li>
                  <li>All journal entries</li>
                </ul>
                <p className="font-semibold text-green-600 dark:text-green-500 mt-3">What will be preserved:</p>
                <ul className="list-disc list-inside ml-2 space-y-1">
                  <li>All contacts</li>
                  <li>Custom categories you created</li>
                  <li>Categorization memories</li>
                </ul>
                <p className="font-semibold text-foreground mt-3">What you'll get:</p>
                <ul className="list-disc list-inside ml-2 space-y-1">
                  <li>8 active Income categories (ready for budgeting)</li>
                  <li>30 active Expense categories (ready for budgeting)</li>
                  <li>Clean financial slate</li>
                </ul>
              </div>
              <p className="mt-3 font-semibold text-destructive">This action cannot be undone.</p>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={resetting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleFinancialReset}
              disabled={resetting}
              className="bg-orange-600 text-white hover:bg-orange-700"
            >
              {resetting ? 'Resetting...' : 'Reset Financial Data'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={showFullResetDialog} onOpenChange={setShowFullResetDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Reset Everything to Fresh Start?</AlertDialogTitle>
            <AlertDialogDescription>
              This will reset your account to match the experience of a brand new user signing up for the first time.
              <div className="mt-3 space-y-2">
                <p className="font-semibold text-destructive">What will be deleted:</p>
                <ul className="list-disc list-inside ml-2 space-y-1">
                  <li>All transactions and financial history</li>
                  <li>All accounts and balances</li>
                  <li>All budgets</li>
                  <li>All contacts</li>
                  <li>All custom categories</li>
                  <li>All categorization memories</li>
                  <li>All journal entries</li>
                </ul>
                <p className="font-semibold text-foreground mt-3">What you'll get:</p>
                <ul className="list-disc list-inside ml-2 space-y-1">
                  <li>8 active Income categories (ready for budgeting)</li>
                  <li>30 active Expense categories (ready for budgeting)</li>
                  <li>Complete clean slate</li>
                </ul>
              </div>
              <p className="mt-3 font-semibold text-destructive">This action cannot be undone.</p>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={resetting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleFullReset}
              disabled={resetting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {resetting ? 'Resetting...' : 'Reset Everything'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
