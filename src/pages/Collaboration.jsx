import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import { collaborationAPI } from '@/api/collaboration';
import {
  Users,
  UserPlus,
  Home,
  Mail,
  CheckCircle,
  XCircle,
  Clock,
  Trash2,
  Shield,
  Eye,
  Edit,
  Loader2
} from 'lucide-react';

export default function Collaboration() {
  const [households, setHouseholds] = useState([]);
  const [relationships, setRelationships] = useState([]);
  const [invitations, setInvitations] = useState([]);
  const [sharedResources, setSharedResources] = useState([]);
  const [loading, setLoading] = useState(true);
  const [createHouseholdOpen, setCreateHouseholdOpen] = useState(false);
  const [inviteOpen, setInviteOpen] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    try {
      const [householdsData, relationshipsData, invitationsData, sharedData] = await Promise.all([
        collaborationAPI.getMyHouseholds(),
        collaborationAPI.getMyRelationships(),
        collaborationAPI.getMyInvitations(),
        collaborationAPI.getMySharedResources()
      ]);

      setHouseholds(householdsData);
      setRelationships(relationshipsData);
      setInvitations(invitationsData);
      setSharedResources(sharedData);
    } catch (error) {
      console.error('Error loading collaboration data:', error);
      toast.error('Failed to load collaboration data');
    } finally {
      setLoading(false);
    }
  }

  async function handleCreateHousehold(e) {
    e.preventDefault();
    const formData = new FormData(e.target);
    const name = formData.get('householdName');
    const type = formData.get('householdType');

    try {
      await collaborationAPI.createHousehold(name, type);
      toast.success('Household created successfully');
      setCreateHouseholdOpen(false);
      await loadData();
    } catch (error) {
      console.error('Error creating household:', error);
      toast.error('Failed to create household');
    }
  }

  async function handleSendInvite(e) {
    e.preventDefault();
    const formData = new FormData(e.target);
    const email = formData.get('email');
    const type = formData.get('invitationType');

    try {
      await collaborationAPI.sendInvitation(email, type);
      toast.success('Invitation sent successfully');
      setInviteOpen(false);
      await loadData();
    } catch (error) {
      console.error('Error sending invitation:', error);
      toast.error('Failed to send invitation');
    }
  }

  async function handleCancelInvitation(id) {
    try {
      await collaborationAPI.cancelInvitation(id);
      toast.success('Invitation cancelled');
      await loadData();
    } catch (error) {
      console.error('Error cancelling invitation:', error);
      toast.error('Failed to cancel invitation');
    }
  }

  async function handleAcceptRelationship(id) {
    try {
      await collaborationAPI.acceptRelationship(id);
      toast.success('Relationship accepted');
      await loadData();
    } catch (error) {
      console.error('Error accepting relationship:', error);
      toast.error('Failed to accept relationship');
    }
  }

  async function handleDeclineRelationship(id) {
    try {
      await collaborationAPI.declineRelationship(id);
      toast.success('Relationship declined');
      await loadData();
    } catch (error) {
      console.error('Error declining relationship:', error);
      toast.error('Failed to decline relationship');
    }
  }

  function getStatusBadge(status) {
    const configs = {
      pending: { icon: Clock, variant: 'secondary', label: 'Pending' },
      accepted: { icon: CheckCircle, variant: 'default', label: 'Accepted' },
      declined: { icon: XCircle, variant: 'destructive', label: 'Declined' },
      cancelled: { icon: XCircle, variant: 'outline', label: 'Cancelled' },
      expired: { icon: Clock, variant: 'destructive', label: 'Expired' }
    };

    const config = configs[status] || configs.pending;
    const Icon = config.icon;

    return (
      <Badge variant={config.variant} className="gap-1">
        <Icon className="h-3 w-3" />
        {config.label}
      </Badge>
    );
  }

  function getPermissionIcon(level) {
    const icons = {
      view: Eye,
      edit: Edit,
      manage: Shield
    };
    return icons[level] || Eye;
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="p-4 md:p-6 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Collaboration</h1>
          <p className="text-muted-foreground mt-2">
            Manage households, relationships, and shared resources
          </p>
        </div>
        <div className="flex gap-2">
          <Dialog open={inviteOpen} onOpenChange={setInviteOpen}>
            <DialogTrigger asChild>
              <Button>
                <UserPlus className="h-4 w-4 mr-2" />
                Send Invite
              </Button>
            </DialogTrigger>
            <DialogContent>
              <form onSubmit={handleSendInvite}>
                <DialogHeader>
                  <DialogTitle>Send Invitation</DialogTitle>
                  <DialogDescription>
                    Invite someone to connect with you or join your household
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4 py-4">
                  <div className="space-y-2">
                    <Label htmlFor="email">Email Address</Label>
                    <Input
                      id="email"
                      name="email"
                      type="email"
                      placeholder="friend@example.com"
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="invitationType">Invitation Type</Label>
                    <Select name="invitationType" required>
                      <SelectTrigger>
                        <SelectValue placeholder="Select type" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="user_connection">User Connection</SelectItem>
                        <SelectItem value="household_member">Household Member</SelectItem>
                        <SelectItem value="shared_resource">Shared Resource</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <DialogFooter>
                  <Button type="submit">Send Invitation</Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>

          <Dialog open={createHouseholdOpen} onOpenChange={setCreateHouseholdOpen}>
            <DialogTrigger asChild>
              <Button variant="outline">
                <Home className="h-4 w-4 mr-2" />
                Create Household
              </Button>
            </DialogTrigger>
            <DialogContent>
              <form onSubmit={handleCreateHousehold}>
                <DialogHeader>
                  <DialogTitle>Create Household</DialogTitle>
                  <DialogDescription>
                    Create a new household to share finances with family or roommates
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4 py-4">
                  <div className="space-y-2">
                    <Label htmlFor="householdName">Household Name</Label>
                    <Input
                      id="householdName"
                      name="householdName"
                      placeholder="Smith Family"
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="householdType">Type</Label>
                    <Select name="householdType" defaultValue="family">
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="family">Family</SelectItem>
                        <SelectItem value="couple">Couple</SelectItem>
                        <SelectItem value="roommates">Roommates</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <DialogFooter>
                  <Button type="submit">Create Household</Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <Tabs defaultValue="households">
        <TabsList>
          <TabsTrigger value="households">Households</TabsTrigger>
          <TabsTrigger value="relationships">Relationships</TabsTrigger>
          <TabsTrigger value="invitations">Invitations</TabsTrigger>
          <TabsTrigger value="shared">Shared Resources</TabsTrigger>
        </TabsList>

        <TabsContent value="households" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>My Households</CardTitle>
              <CardDescription>
                Households you've created or been invited to
              </CardDescription>
            </CardHeader>
            <CardContent>
              {households.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-8">
                  No households yet. Create one to get started.
                </p>
              ) : (
                <div className="space-y-3">
                  {households.map((household) => (
                    <div key={household.id} className="flex items-center justify-between p-4 border rounded-lg">
                      <div className="flex items-center gap-3">
                        <Home className="h-5 w-5 text-muted-foreground" />
                        <div>
                          <p className="font-medium">{household.name}</p>
                          <p className="text-sm text-muted-foreground capitalize">
                            {household.group_type} • {household.memberRole}
                          </p>
                        </div>
                      </div>
                      <Button variant="outline" size="sm">
                        <Users className="h-4 w-4 mr-1" />
                        Manage
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="relationships" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>My Relationships</CardTitle>
              <CardDescription>
                People you're connected with for sharing finances
              </CardDescription>
            </CardHeader>
            <CardContent>
              {relationships.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-8">
                  No relationships yet. Send an invitation to connect with someone.
                </p>
              ) : (
                <div className="space-y-3">
                  {relationships.map((rel) => (
                    <div key={rel.id} className="flex items-center justify-between p-4 border rounded-lg">
                      <div className="flex items-center gap-3">
                        <Users className="h-5 w-5 text-muted-foreground" />
                        <div>
                          <p className="font-medium capitalize">{rel.relationship_type}</p>
                          <p className="text-sm text-muted-foreground">
                            Created {new Date(rel.created_at).toLocaleDateString()}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        {getStatusBadge(rel.status)}
                        {rel.status === 'pending' && (
                          <div className="flex gap-1">
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => handleAcceptRelationship(rel.id)}
                            >
                              <CheckCircle className="h-4 w-4" />
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => handleDeclineRelationship(rel.id)}
                            >
                              <XCircle className="h-4 w-4" />
                            </Button>
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="invitations" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Sent Invitations</CardTitle>
              <CardDescription>
                Track invitations you've sent to others
              </CardDescription>
            </CardHeader>
            <CardContent>
              {invitations.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-8">
                  No invitations sent yet.
                </p>
              ) : (
                <div className="space-y-3">
                  {invitations.map((invite) => (
                    <div key={invite.id} className="flex items-center justify-between p-4 border rounded-lg">
                      <div className="flex items-center gap-3">
                        <Mail className="h-5 w-5 text-muted-foreground" />
                        <div>
                          <p className="font-medium">{invite.invitee_email}</p>
                          <p className="text-sm text-muted-foreground capitalize">
                            {invite.invitation_type.replace('_', ' ')} • Sent {new Date(invite.created_at).toLocaleDateString()}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        {getStatusBadge(invite.status)}
                        {invite.status === 'pending' && (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleCancelInvitation(invite.id)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="shared" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Shared Resources</CardTitle>
              <CardDescription>
                Resources you've shared with others
              </CardDescription>
            </CardHeader>
            <CardContent>
              {sharedResources.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-8">
                  No resources shared yet.
                </p>
              ) : (
                <div className="space-y-3">
                  {sharedResources.map((resource) => {
                    const PermIcon = getPermissionIcon(resource.permission_level);
                    return (
                      <div key={resource.id} className="flex items-center justify-between p-4 border rounded-lg">
                        <div className="flex items-center gap-3">
                          <PermIcon className="h-5 w-5 text-muted-foreground" />
                          <div>
                            <p className="font-medium capitalize">{resource.resource_type}</p>
                            <p className="text-sm text-muted-foreground capitalize">
                              {resource.permission_level} access
                            </p>
                          </div>
                        </div>
                        <Button size="sm" variant="outline">
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
