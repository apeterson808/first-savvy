import { useState, useEffect } from 'react';
import { choresAPI } from '@/api/chores';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Plus, CheckCircle, Clock, XCircle } from 'lucide-react';
import { toast } from 'sonner';

const STATUS_COLORS = {
  pending: 'bg-slate-100 text-slate-800',
  in_progress: 'bg-blue-100 text-blue-800',
  completed: 'bg-amber-100 text-amber-800',
  approved: 'bg-green-100 text-green-800',
  rejected: 'bg-red-100 text-red-800',
};

export function ChoresTab({ childId, onUpdate }) {
  const [chores, setChores] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadChores();
  }, [childId]);

  const loadChores = async () => {
    try {
      setLoading(true);
      const data = await choresAPI.getChoresByChild(childId);
      setChores(data);
    } catch (error) {
      console.error('Error loading chores:', error);
      toast.error('Failed to load chores');
    } finally {
      setLoading(false);
    }
  };

  const handleApprove = async (choreId) => {
    try {
      await choresAPI.approveChore(choreId, null, null);
      toast.success('Chore approved!');
      loadChores();
      onUpdate();
    } catch (error) {
      console.error('Error approving chore:', error);
      toast.error('Failed to approve chore');
    }
  };

  const handleReject = async (choreId) => {
    try {
      await choresAPI.rejectChore(choreId, null, 'Did not meet requirements');
      toast.success('Chore rejected');
      loadChores();
    } catch (error) {
      console.error('Error rejecting chore:', error);
      toast.error('Failed to reject chore');
    }
  };

  if (loading) {
    return <div className="text-center py-8">Loading chores...</div>;
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold">Chores</h3>
        <Button size="sm">
          <Plus className="mr-2 h-4 w-4" />
          Add Chore
        </Button>
      </div>

      {chores.length === 0 ? (
        <Card>
          <CardContent className="pt-6">
            <div className="text-center py-8">
              <p className="text-slate-600">No chores yet</p>
              <Button className="mt-4" size="sm">
                <Plus className="mr-2 h-4 w-4" />
                Create First Chore
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {chores.map((chore) => (
            <Card key={chore.id}>
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div className="space-y-1">
                    <CardTitle className="text-base">{chore.title}</CardTitle>
                    {chore.description && (
                      <p className="text-sm text-slate-600">{chore.description}</p>
                    )}
                  </div>
                  <Badge className={STATUS_COLORS[chore.status]}>
                    {chore.status}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent>
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-4 text-sm">
                    <span className="font-semibold text-green-600">
                      {chore.points_value} points
                    </span>
                    {chore.due_date && (
                      <span className="text-slate-600">
                        Due: {new Date(chore.due_date).toLocaleDateString()}
                      </span>
                    )}
                  </div>
                  {chore.status === 'completed' && (
                    <div className="flex space-x-2">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleReject(chore.id)}
                      >
                        <XCircle className="mr-2 h-4 w-4" />
                        Reject
                      </Button>
                      <Button
                        size="sm"
                        onClick={() => handleApprove(chore.id)}
                      >
                        <CheckCircle className="mr-2 h-4 w-4" />
                        Approve
                      </Button>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
