import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Users, Briefcase } from 'lucide-react';

export function ProfileTypeSelector({ open, onOpenChange, onSelectType }) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Create Profile</DialogTitle>
          <DialogDescription>
            Choose the type of profile you want to create
          </DialogDescription>
        </DialogHeader>
        <div className="grid grid-cols-1 gap-4 py-4">
          <Button
            variant="outline"
            className="h-auto py-6 flex flex-col items-center gap-3 hover:bg-blue-50 hover:border-blue-300"
            onClick={() => {
              onSelectType('child');
              onOpenChange(false);
            }}
          >
            <Users className="h-8 w-8 text-blue-600" />
            <div className="text-center">
              <div className="font-semibold text-base">Child Profile</div>
              <div className="text-xs text-slate-600 mt-1">
                Create a profile for a child with age-appropriate access
              </div>
            </div>
          </Button>
          <Button
            variant="outline"
            className="h-auto py-6 flex flex-col items-center gap-3 hover:bg-orange-50 hover:border-orange-300 opacity-50 cursor-not-allowed"
            disabled
          >
            <Briefcase className="h-8 w-8 text-orange-600" />
            <div className="text-center">
              <div className="font-semibold text-base">Business Profile</div>
              <div className="text-xs text-slate-600 mt-1">
                Coming soon
              </div>
            </div>
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
