import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '../ui/dialog';
import { Button } from '../ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { Label } from '../ui/label';
import { getUnlinkedAssets, createAssetLiabilityLink } from '@/api/vehiclesAndLoans';
import { toast } from 'sonner';
import { formatCurrency } from '../utils/formatters';
import { Car } from 'lucide-react';

export function LinkLoanDialog({ open, onOpenChange, loan }) {
  const [selectedVehicleId, setSelectedVehicleId] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const queryClient = useQueryClient();

  const { data: unlinkedVehicles = [] } = useQuery({
    queryKey: ['unlinkedAssets'],
    queryFn: getUnlinkedAssets,
    enabled: open,
  });

  const handleLink = async () => {
    if (!selectedVehicleId) {
      toast.error('Please select a vehicle');
      return;
    }

    setIsLoading(true);
    try {
      await createAssetLiabilityLink(selectedVehicleId, loan.id);
      toast.success('Vehicle linked to loan successfully');
      queryClient.invalidateQueries({ queryKey: ['assetLinks'] });
      queryClient.invalidateQueries({ queryKey: ['liabilityLinks'] });
      queryClient.invalidateQueries({ queryKey: ['unlinkedAssets'] });
      onOpenChange(false);
      setSelectedVehicleId('');
    } catch (error) {
      console.error('Error linking vehicle:', error);
      toast.error('Failed to link vehicle. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleCancel = () => {
    onOpenChange(false);
    setSelectedVehicleId('');
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Link Vehicle to Loan</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label>Loan</Label>
            <div className="p-3 border rounded-lg bg-muted">
              <p className="font-medium">{loan?.name}</p>
              <p className="text-sm text-muted-foreground">
                Balance: {formatCurrency(loan?.current_balance || 0)}
              </p>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="vehicle">Select Vehicle</Label>
            <Select value={selectedVehicleId} onValueChange={setSelectedVehicleId}>
              <SelectTrigger id="vehicle">
                <SelectValue placeholder="Choose a vehicle" />
              </SelectTrigger>
              <SelectContent>
                {unlinkedVehicles.length === 0 ? (
                  <div className="p-4 text-center text-sm text-muted-foreground">
                    No unlinked vehicles available
                  </div>
                ) : (
                  unlinkedVehicles.map((vehicle) => (
                    <SelectItem key={vehicle.id} value={vehicle.id}>
                      <div className="flex items-center gap-2">
                        <Car className="w-4 h-4" />
                        <div>
                          <p className="font-medium">{vehicle.name}</p>
                          <p className="text-xs text-muted-foreground">
                            Value: {formatCurrency(vehicle.current_balance || 0)}
                          </p>
                        </div>
                      </div>
                    </SelectItem>
                  ))
                )}
              </SelectContent>
            </Select>
            {unlinkedVehicles.length === 0 && (
              <p className="text-xs text-muted-foreground">
                All vehicles are already linked or no vehicles exist. Create a new vehicle first.
              </p>
            )}
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleCancel} disabled={isLoading}>
            Cancel
          </Button>
          <Button
            onClick={handleLink}
            disabled={!selectedVehicleId || isLoading}
          >
            {isLoading ? 'Linking...' : 'Link Vehicle'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
