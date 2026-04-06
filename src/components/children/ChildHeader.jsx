import React from 'react';
import { useNavigate } from 'react-router-dom';
import { LogOut, User } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { firstsavvy } from '@/api/firstsavvyClient';
import { toast } from 'sonner';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

export default function ChildHeader({ childName, displayName }) {
  const navigate = useNavigate();

  const handleLogout = async () => {
    try {
      sessionStorage.removeItem('viewingChildProfile');
      await firstsavvy.auth.signOut();
      navigate('/login');
      toast.success('Logged out successfully');
    } catch (error) {
      toast.error('Failed to log out');
    }
  };

  const getInitials = (name) => {
    if (!name) return 'C';
    return name
      .split(' ')
      .map(n => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  return (
    <header className="bg-white px-6 py-4 shadow-sm border-b border-slate-200">
      <div className="flex items-center justify-between">
        <div className="flex flex-col leading-none">
          <span className="text-[10px] font-light text-slate-400 tracking-wider">FIRST</span>
          <h1 className="text-[26px] font-bold text-slate-900 tracking-tight">SAVVY</h1>
        </div>

        <div className="flex items-center gap-3">
          <span className="text-sm text-slate-600 hidden md:block">
            Welcome, <span className="font-medium text-slate-900">{displayName || childName}</span>
          </span>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className="flex items-center gap-2 rounded-full focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500">
                <Avatar className="h-8 w-8 cursor-pointer bg-gradient-to-br from-sky-400 to-blue-500">
                  <AvatarFallback className="bg-gradient-to-br from-sky-400 to-blue-500 text-white font-semibold">
                    {getInitials(displayName || childName)}
                  </AvatarFallback>
                </Avatar>
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <DropdownMenuLabel>
                <div className="flex flex-col space-y-1">
                  <p className="text-sm font-medium leading-none">{displayName || childName}</p>
                  <p className="text-xs leading-none text-muted-foreground">Child Account</p>
                </div>
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={handleLogout} className="text-red-600 focus:text-red-600">
                <LogOut className="mr-2 h-4 w-4" />
                <span>Log Out</span>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </header>
  );
}
