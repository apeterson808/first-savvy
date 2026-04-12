import React, { useState, useEffect } from 'react';
import { firstsavvy } from '@/api/firstsavvyClient';
import { childProfilesAPI } from '@/api/childProfiles';
import { useMutation, useQueryClient, useQuery } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetFooter,
} from "@/components/ui/sheet";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import AccountDetectionField from './AccountDetectionField';
import { toast } from 'sonner';
import { X, Plus, Info, Briefcase, Check, Loader2 as LoaderIcon, Pencil } from 'lucide-react';
import { useProfile } from '@/contexts/ProfileContext';
import { differenceInYears } from 'date-fns';

function formatPhoneNumber(value) {
  if (!value) return value;
  const phoneNumber = value.replace(/[^\d]/g, '');
  const phoneNumberLength = phoneNumber.length;
  if (phoneNumberLength < 4) return phoneNumber;
  if (phoneNumberLength < 7) {
    return `(${phoneNumber.slice(0, 3)}) ${phoneNumber.slice(3)}`;
  }
  return `(${phoneNumber.slice(0, 3)}) ${phoneNumber.slice(3, 6)}-${phoneNumber.slice(6, 10)}`;
}

const CUSTOM_COLOR_PALETTE = [
  { name: 'Tea Green', hex: '#AACC96' },
  { name: 'Forest', hex: '#25533F' },
  { name: 'Peach Frost', hex: '#F4BEAE' },
  { name: 'Blueberry', hex: '#52A5CE' },
  { name: 'Bubblegum', hex: '#FF7BAC' },
  { name: 'Dry Earth', hex: '#876029' },
  { name: 'Grape Juice', hex: '#6D1F42' },
  { name: 'Lilacs', hex: '#D3B6D3' },
  { name: 'Butter Yellow', hex: '#EFCE7B' },
  { name: 'Iced Blue', hex: '#B8CEE8' },
  { name: 'Blood Orange', hex: '#EF6F3C' },
  { name: 'Olive Green', hex: '#AFAB23' },
  { name: 'Coral', hex: '#FF9B82' },
  { name: 'Teal', hex: '#4DB8A8' },
  { name: 'Soft Lavender', hex: '#C8B6E2' },
  { name: 'Terracotta', hex: '#D67F5E' },
  { name: 'Sage', hex: '#88B69D' },
  { name: 'Dusty Rose', hex: '#D4A5A5' },
];

const SYSTEM_GROUPS = [
  { value: '__general__', label: 'General Contact' },
  { value: '__family__', label: 'My Family' },
  { value: '__business__', label: 'My Business' },
];

const BLANK_GENERAL = {
  name: '',
  status: 'active',
  email: '',
  phone: '',
  street: '',
  city: '',
  state: '',
  zip: '',
  group_name: '',
  tags: [],
  color: '#6B7280',
};

const BLANK_FAMILY = {
  first_name: '',
  last_name: '',
  display_name: '',
  date_of_birth: '',
  sex: '',
  avatar: { icon: 'Circle', color: '#52A5CE' },
  notes: '',
  username: '',
  email: '',
  pin: '',
};

function typeFromGroup(groupValue) {
  if (groupValue === '__family__') return 'family';
  if (groupValue === '__business__') return 'business';
  return 'general';
}

export default function AddContactSheet({
  open,
  onOpenChange,
  initialName = '',
  triggeringTransactionId = null,
  onContactCreated = null,
  onChildCreated = null,
  initialType = 'general',
}) {
  const initialGroup = initialType === 'family' ? '__family__' : initialType === 'business' ? '__business__' : '__general__';
  const [groupValue, setGroupValue] = useState(initialGroup);
  const contactType = typeFromGroup(groupValue);
  const [generalForm, setGeneralForm] = useState(BLANK_GENERAL);
  const [familyForm, setFamilyForm] = useState(BLANK_FAMILY);
  const [tagInput, setTagInput] = useState('');
  const [detectedUser, setDetectedUser] = useState(null);
  const [isCreatingNewGroup, setIsCreatingNewGroup] = useState(false);
  const [loading, setLoading] = useState(false);
  const [age, setAge] = useState(null);
  const [popoverOpen, setPopoverOpen] = useState(false);
  const [activeTab, setActiveTab] = useState('color');
  const [uploading, setUploading] = useState(false);
  const [usernameAvailable, setUsernameAvailable] = useState(null);
  const [checkingUsername, setCheckingUsername] = useState(false);
  const [inviteMode, setInviteMode] = useState(false);
  const [inviteEmail, setInviteEmail] = useState('');
  const queryClient = useQueryClient();
  const { activeProfile } = useProfile();

  const { data: allContacts = [] } = useQuery({
    queryKey: ['contacts', activeProfile?.id],
    queryFn: () => firstsavvy.entities.Contact.list('name'),
    enabled: !!activeProfile,
  });

  const existingGroups = React.useMemo(() => {
    const groups = new Set();
    allContacts.forEach(contact => {
      if (contact.group_name) groups.add(contact.group_name);
    });
    return Array.from(groups).sort();
  }, [allContacts]);

  useEffect(() => {
    if (open && initialName) {
      setGeneralForm(prev => ({ ...prev, name: initialName }));
    }
  }, [open, initialName]);

  useEffect(() => {
    if (open) setGroupValue(initialType === 'family' ? '__family__' : initialType === 'business' ? '__business__' : '__general__');
  }, [open, initialType]);

  useEffect(() => {
    if (familyForm.date_of_birth) {
      setAge(differenceInYears(new Date(), new Date(familyForm.date_of_birth)));
    } else {
      setAge(null);
    }
  }, [familyForm.date_of_birth]);

  useEffect(() => {
    if (!familyForm.username || familyForm.username.length < 3) {
      setUsernameAvailable(null);
      return;
    }
    const check = async () => {
      setCheckingUsername(true);
      try {
        const result = await childProfilesAPI.checkUsernameAvailability(familyForm.username);
        setUsernameAvailable(result.available);
      } catch {
        setUsernameAvailable(null);
      } finally {
        setCheckingUsername(false);
      }
    };
    const t = setTimeout(check, 500);
    return () => clearTimeout(t);
  }, [familyForm.username]);

  const createMutation = useMutation({
    mutationFn: (data) => firstsavvy.entities.Contact.create(data),
    onSuccess: (newContact) => {
      queryClient.invalidateQueries({ queryKey: ['contacts'] });
      toast.success('Contact created successfully');
      if (onContactCreated) onContactCreated(newContact, triggeringTransactionId);
      resetForm();
      onOpenChange(false);
    },
    onError: (error) => {
      toast.error(`Failed to create contact: ${error.message}`);
    },
  });

  const resetForm = () => {
    setGroupValue('__general__');
    setGeneralForm(BLANK_GENERAL);
    setFamilyForm(BLANK_FAMILY);
    setTagInput('');
    setIsCreatingNewGroup(false);
    setDetectedUser(null);
    setAge(null);
    setUsernameAvailable(null);
    setInviteMode(false);
    setInviteEmail('');
  };

  const updateGeneral = (field, value) => {
    let v = value;
    if (field === 'status') v = value ? value.toLowerCase() : value;
    setGeneralForm(prev => ({ ...prev, [field]: v }));
  };

  const handlePhoneChange = (e) => {
    updateGeneral('phone', formatPhoneNumber(e.target.value));
  };

  const handleImageUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) { toast.error('Please select an image file'); return; }
    if (file.size > 5 * 1024 * 1024) { toast.error('Image must be less than 5MB'); return; }
    try {
      setUploading(true);
      const fileExt = file.name.split('.').pop();
      const fileName = `${activeProfile?.id}-${Date.now()}.${fileExt}`;
      const filePath = `avatars/${fileName}`;
      const { supabase } = await import('@/api/supabaseClient');
      const { error: uploadError } = await supabase.storage.from('avatars').upload(filePath, file);
      if (uploadError) throw uploadError;
      const { data: { publicUrl } } = supabase.storage.from('avatars').getPublicUrl(filePath);
      setFamilyForm(prev => ({ ...prev, avatar: { ...prev.avatar, imageUrl: publicUrl } }));
      toast.success('Image uploaded successfully');
      setPopoverOpen(false);
    } catch {
      toast.error('Failed to upload image');
    } finally {
      setUploading(false);
    }
  };

  const handleConnectionRequest = async (user) => {
    try {
      const currentUser = await firstsavvy.auth.me();
      if (!currentUser) { toast.error('You must be logged in to connect with contacts'); return; }
      await firstsavvy.entities.UserRelationship.create({
        user_id: currentUser.id,
        related_user_id: user.id,
        relationship_type: 'friend',
        status: 'pending',
        created_by: currentUser.id,
        permissions: {},
      });
      setDetectedUser(user);
      toast.success('Connection request sent!');
    } catch {
      toast.error('Failed to send connection request');
    }
  };

  const handleSendInvitation = async (value, type) => {
    try {
      const currentUser = await firstsavvy.auth.me();
      if (!currentUser) { toast.error('You must be logged in to send invitations'); return; }
      const invitationData = {
        inviter_user_id: currentUser.id,
        invitation_type: 'user_connection',
        relationship_metadata: { relationship_type: 'friend' },
        status: 'pending',
      };
      if (type === 'email') invitationData.invitee_email = value;
      else if (type === 'phone') invitationData.invitee_phone = value.replace(/[^\d]/g, '');
      const invitation = await firstsavvy.entities.Invitation.create(invitationData);
      toast.success(`Invitation sent to ${value}!`);
      return invitation;
    } catch {
      toast.error('Failed to send invitation');
    }
  };

  const handleSubmitGeneral = (e) => {
    e.preventDefault();
    if (!generalForm.name.trim()) { toast.error('Name is required'); return; }
    const phoneDigits = generalForm.phone ? generalForm.phone.replace(/[^\d]/g, '') : '';
    if (generalForm.phone && phoneDigits.length > 0 && phoneDigits.length < 10) {
      toast.error('Phone number must include area code (10 digits)');
      return;
    }
    const addressParts = [generalForm.street.trim(), generalForm.city.trim(), generalForm.state, generalForm.zip.trim()].filter(Boolean);
    const fullAddress = addressParts.length > 0 ? addressParts.join(', ') : undefined;
    createMutation.mutate({
      name: generalForm.name.trim(),
      status: 'active',
      email: generalForm.email.trim() || undefined,
      phone: generalForm.phone || undefined,
      address: fullAddress,
      group_name: generalForm.group_name.trim() || undefined,
      tags: generalForm.tags.length > 0 ? generalForm.tags : undefined,
      color: generalForm.color || '#6B7280',
      linked_user_id: detectedUser?.id || undefined,
      connection_status: detectedUser ? 'platform_user' : 'not_checked',
    });
  };

  const handleSubmitFamily = async (e) => {
    e.preventDefault();
    if (!familyForm.first_name.trim()) { toast.error('Please enter first name'); return; }
    if (!familyForm.last_name.trim()) { toast.error('Please enter last name'); return; }
    if (familyForm.first_name.length < 2 || familyForm.first_name.length > 50) { toast.error('First name must be between 2 and 50 characters'); return; }
    if (familyForm.last_name.length < 2 || familyForm.last_name.length > 50) { toast.error('Last name must be between 2 and 50 characters'); return; }
    if (!familyForm.username || familyForm.username.length < 3) { toast.error('Username is required and must be at least 3 characters'); return; }
    if (!usernameAvailable) { toast.error('Username is not available'); return; }
    if (familyForm.email && familyForm.email.trim()) {
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(familyForm.email)) { toast.error('Please enter a valid email address'); return; }
    }
    if (!familyForm.pin || familyForm.pin.length !== 4 || !/^\d{4}$/.test(familyForm.pin)) { toast.error('PIN must be exactly 4 digits'); return; }
    try {
      setLoading(true);
      const childProfile = await childProfilesAPI.createChildProfile(activeProfile?.id, {
        first_name: familyForm.first_name,
        last_name: familyForm.last_name,
        child_name: `${familyForm.first_name} ${familyForm.last_name}`,
        display_name: familyForm.display_name || null,
        date_of_birth: familyForm.date_of_birth || null,
        sex: familyForm.sex || null,
        avatar: familyForm.avatar,
        notes: familyForm.notes || null,
        username: familyForm.username,
        email: familyForm.email,
        login_enabled: true,
      });
      await childProfilesAPI.setChildPin(childProfile.id, familyForm.pin);
      toast.success('Family member created successfully');
      resetForm();
      onOpenChange(false);
      if (onChildCreated) onChildCreated();
    } catch (error) {
      toast.error(error.message || 'Failed to create family member');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmitInvite = async (e) => {
    e.preventDefault();
    if (!inviteEmail.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(inviteEmail)) {
      toast.error('Please enter a valid email address');
      return;
    }
    try {
      setLoading(true);
      const { profileInvitationsAPI } = await import('@/api/profileInvitations');
      const tempProfile = await childProfilesAPI.createChildProfile(activeProfile?.id, {
        first_name: 'Invited',
        last_name: 'Member',
        child_name: inviteEmail,
        email: inviteEmail,
        login_enabled: false,
        invitation_pending: true,
      });
      await profileInvitationsAPI.createInvitation(tempProfile.id, inviteEmail, activeProfile?.id);
      toast.success(`Invitation sent to ${inviteEmail}`);
      resetForm();
      onOpenChange(false);
      if (onChildCreated) onChildCreated();
    } catch (error) {
      toast.error(error.message || 'Failed to send invitation');
    } finally {
      setLoading(false);
    }
  };

  const handleOpenChange = (newOpen) => {
    if (!newOpen) resetForm();
    onOpenChange(newOpen);
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && e.target.tagName !== 'TEXTAREA') {
      e.preventDefault();
      if (contactType === 'general') handleSubmitGeneral(e);
    }
  };

  const familyInitials = () => {
    const first = familyForm.first_name?.trim() || '';
    const last = familyForm.last_name?.trim() || '';
    if (!first && !last) return '';
    return `${first.charAt(0)}${last.charAt(0)}`.toUpperCase();
  };

  const handleGroupChange = (value) => {
    if (value === '__new__') {
      setIsCreatingNewGroup(true);
      updateGeneral('group_name', '');
      return;
    }
    setIsCreatingNewGroup(false);
    if (value === '__general__' || value === '__family__' || value === '__business__') {
      setGroupValue(value);
      updateGeneral('group_name', '');
    } else {
      setGroupValue('__general__');
      updateGeneral('group_name', value);
    }
  };

  const displayGroupLabel = isCreatingNewGroup
    ? (generalForm.group_name || 'New group...')
    : groupValue === '__family__' ? 'My Family'
    : groupValue === '__business__' ? 'My Business'
    : generalForm.group_name || 'General Contact';

  return (
    <Sheet open={open} onOpenChange={handleOpenChange}>
      <SheetContent className="sm:max-w-[540px] overflow-y-auto">
        <SheetHeader>
          <SheetTitle>Add Contact</SheetTitle>
        </SheetHeader>

        <div className="mt-4 space-y-4">
          <div>
            <Label htmlFor="group-select" className="mb-1.5 block">Group</Label>
            {!isCreatingNewGroup ? (
              <Select value={groupValue} onValueChange={handleGroupChange}>
                <SelectTrigger id="group-select">
                  <SelectValue>{displayGroupLabel}</SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {SYSTEM_GROUPS.map(({ value, label }) => (
                    <SelectItem key={value} value={value}>{label}</SelectItem>
                  ))}
                  {existingGroups.length > 0 && (
                    <>
                      <div className="mx-2 my-1 border-t border-slate-100" />
                      {existingGroups.map(group => (
                        <SelectItem key={group} value={group}>{group}</SelectItem>
                      ))}
                    </>
                  )}
                  <div className="mx-2 my-1 border-t border-slate-100" />
                  <SelectItem value="__new__">
                    <span className="flex items-center"><Plus className="w-3 h-3 mr-2" />Create new group</span>
                  </SelectItem>
                </SelectContent>
              </Select>
            ) : (
              <div className="flex gap-2">
                <Input
                  value={generalForm.group_name}
                  onChange={(e) => updateGeneral('group_name', e.target.value)}
                  placeholder="Enter new group name..."
                  autoFocus
                />
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  onClick={() => {
                    setIsCreatingNewGroup(false);
                    setGroupValue('__general__');
                    updateGeneral('group_name', '');
                  }}
                >
                  <X className="w-4 h-4" />
                </Button>
              </div>
            )}
          </div>

          <Separator />

          {contactType === 'general' && (
            <form onSubmit={handleSubmitGeneral} onKeyDown={handleKeyDown} className="space-y-4">
              <div>
                <Label htmlFor="name">Name *</Label>
                <Input
                  id="name"
                  value={generalForm.name}
                  onChange={(e) => updateGeneral('name', e.target.value)}
                  placeholder="e.g., Starbucks, Employer XYZ"
                  required
                />
              </div>

              <div>
                <div className="flex items-center gap-1 mb-2">
                  <Label htmlFor="email">Email</Label>
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Info className="h-3.5 w-3.5 text-slate-400 cursor-help" />
                      </TooltipTrigger>
                      <TooltipContent><p>Add email or phone to check if they have an account</p></TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                </div>
                <Input
                  id="email"
                  type="email"
                  value={generalForm.email}
                  onChange={(e) => updateGeneral('email', e.target.value)}
                  placeholder="contact@example.com"
                />
                <AccountDetectionField
                  type="email"
                  value={generalForm.email}
                  onConnectionRequest={handleConnectionRequest}
                  onInviteSend={handleSendInvitation}
                />
              </div>

              <div>
                <div className="flex items-center gap-1 mb-2">
                  <Label htmlFor="phone">Phone</Label>
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Info className="h-3.5 w-3.5 text-slate-400 cursor-help" />
                      </TooltipTrigger>
                      <TooltipContent><p>Add email or phone to check if they have an account</p></TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                </div>
                <Input
                  id="phone"
                  type="tel"
                  value={generalForm.phone}
                  onChange={handlePhoneChange}
                  placeholder="(555) 123-4567"
                />
                <AccountDetectionField
                  type="phone"
                  value={generalForm.phone}
                  onConnectionRequest={handleConnectionRequest}
                  onInviteSend={handleSendInvitation}
                />
              </div>

              <div>
                <Label htmlFor="street">Street Address</Label>
                <Input
                  id="street"
                  value={generalForm.street}
                  onChange={(e) => updateGeneral('street', e.target.value)}
                  placeholder="123 Main St"
                />
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div className="col-span-2">
                  <Label htmlFor="city">City</Label>
                  <Input
                    id="city"
                    value={generalForm.city}
                    onChange={(e) => updateGeneral('city', e.target.value)}
                    placeholder="City"
                  />
                </div>
                <div>
                  <Label htmlFor="state">State</Label>
                  <Select value={generalForm.state} onValueChange={(v) => updateGeneral('state', v)}>
                    <SelectTrigger><SelectValue placeholder="State" /></SelectTrigger>
                    <SelectContent>
                      {['AL','AK','AZ','AR','CA','CO','CT','DE','FL','GA','HI','ID','IL','IN','IA','KS','KY','LA','ME','MD','MA','MI','MN','MS','MO','MT','NE','NV','NH','NJ','NM','NY','NC','ND','OH','OK','OR','PA','RI','SC','SD','TN','TX','UT','VT','VA','WA','WV','WI','WY'].map(s => (
                        <SelectItem key={s} value={s}>{s}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div>
                <Label htmlFor="zip">ZIP Code</Label>
                <Input
                  id="zip"
                  value={generalForm.zip}
                  onChange={(e) => updateGeneral('zip', e.target.value)}
                  placeholder="12345"
                  maxLength={10}
                />
              </div>

              <div>
                <Label htmlFor="tags">Tags</Label>
                <div className="space-y-2">
                  <div className="flex gap-2">
                    <Input
                      id="tags"
                      value={tagInput}
                      onChange={(e) => setTagInput(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          if (tagInput.trim() && !generalForm.tags.includes(tagInput.trim())) {
                            setGeneralForm(prev => ({ ...prev, tags: [...prev.tags, tagInput.trim()] }));
                            setTagInput('');
                          }
                        }
                      }}
                      placeholder="Add tags (press Enter)"
                    />
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        if (tagInput.trim() && !generalForm.tags.includes(tagInput.trim())) {
                          setGeneralForm(prev => ({ ...prev, tags: [...prev.tags, tagInput.trim()] }));
                          setTagInput('');
                        }
                      }}
                    >
                      <Plus className="w-4 h-4" />
                    </Button>
                  </div>
                  {generalForm.tags.length > 0 && (
                    <div className="flex flex-wrap gap-1">
                      {generalForm.tags.map((tag, idx) => (
                        <Badge key={idx} variant="secondary" className="pl-2 pr-1">
                          {tag}
                          <button
                            type="button"
                            onClick={() => setGeneralForm(prev => ({ ...prev, tags: prev.tags.filter((_, i) => i !== idx) }))}
                            className="ml-1 hover:bg-slate-300 rounded-full p-0.5"
                          >
                            <X className="w-3 h-3" />
                          </button>
                        </Badge>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              <SheetFooter className="pt-4">
                <Button type="button" variant="outline" onClick={() => handleOpenChange(false)}>Cancel</Button>
                <Button type="submit" className="bg-primary hover:bg-primary/90" disabled={createMutation.isPending}>
                  {createMutation.isPending ? 'Creating...' : 'Create'}
                </Button>
              </SheetFooter>
            </form>
          )}

          {contactType === 'family' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  {inviteMode ? (
                    <p className="text-sm text-slate-600">Send an email invite — they'll set up their own profile.</p>
                  ) : (
                    <p className="text-sm text-slate-600">Create a profile manually with login credentials.</p>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => { setInviteMode(v => !v); setInviteEmail(''); }}
                  className="text-xs font-medium text-blue-600 hover:text-blue-700 underline underline-offset-2 whitespace-nowrap ml-3 shrink-0"
                >
                  {inviteMode ? 'Set up manually instead' : 'Send invite by email'}
                </button>
              </div>

              {inviteMode ? (
                <form onSubmit={handleSubmitInvite} className="space-y-4">
                  <div className="space-y-1.5">
                    <Label htmlFor="invite-email">Email Address <span className="text-red-500">*</span></Label>
                    <Input
                      id="invite-email"
                      type="email"
                      value={inviteEmail}
                      onChange={(e) => setInviteEmail(e.target.value)}
                      placeholder="family@example.com"
                      autoFocus
                      required
                    />
                    <p className="text-xs text-slate-500">They'll receive an email to create their own profile and data.</p>
                  </div>
                  <SheetFooter className="pt-2">
                    <Button type="button" variant="outline" onClick={() => handleOpenChange(false)} disabled={loading}>Cancel</Button>
                    <Button type="submit" disabled={loading || !inviteEmail.trim()}>
                      {loading ? 'Sending...' : 'Send Invite'}
                    </Button>
                  </SheetFooter>
                </form>
              ) : (
            <form onSubmit={handleSubmitFamily} className="space-y-5">
              <div className="flex justify-center">
                <div className="relative">
                  <div
                    className="w-20 h-20 rounded-full flex items-center justify-center text-white text-xl font-semibold"
                    style={{ backgroundColor: familyForm.avatar?.color || '#52A5CE' }}
                  >
                    {familyForm.avatar?.imageUrl ? (
                      <img src={familyForm.avatar.imageUrl} alt="Avatar" className="w-full h-full rounded-full object-cover" />
                    ) : (
                      familyInitials()
                    )}
                  </div>
                  <Popover open={popoverOpen} onOpenChange={setPopoverOpen}>
                    <PopoverTrigger asChild>
                      <button
                        type="button"
                        className="absolute bottom-0 right-0 w-7 h-7 bg-slate-800 hover:bg-slate-700 text-white rounded-full flex items-center justify-center transition-colors shadow-md"
                      >
                        <Pencil className="w-3.5 h-3.5" />
                      </button>
                    </PopoverTrigger>
                    <PopoverContent className="w-80 p-4" align="start">
                      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
                        <TabsList className="w-full grid grid-cols-2">
                          <TabsTrigger value="color">Color</TabsTrigger>
                          <TabsTrigger value="image">Image</TabsTrigger>
                        </TabsList>
                        <TabsContent value="color" className="mt-4">
                          <div className="grid grid-cols-6 gap-2">
                            {CUSTOM_COLOR_PALETTE.map((c) => (
                              <button
                                key={c.hex}
                                type="button"
                                onClick={() => setFamilyForm(prev => ({ ...prev, avatar: { ...prev.avatar, color: c.hex } }))}
                                className={`w-10 h-10 rounded-full border-2 transition-all ${
                                  familyForm.avatar?.color === c.hex ? 'border-slate-800 scale-110' : 'border-slate-300 hover:scale-105 hover:border-slate-400'
                                }`}
                                style={{ backgroundColor: c.hex }}
                              />
                            ))}
                          </div>
                        </TabsContent>
                        <TabsContent value="image" className="mt-4">
                          <div className="space-y-3">
                            {familyForm.avatar?.imageUrl && (
                              <div className="flex items-center gap-3 p-3 bg-slate-50 rounded-lg">
                                <img src={familyForm.avatar.imageUrl} alt="Avatar" className="w-12 h-12 rounded-full object-cover" />
                                <div className="flex-1 text-sm text-slate-600">Current image</div>
                                <Button type="button" variant="outline" size="sm" onClick={() => setFamilyForm(prev => ({ ...prev, avatar: { ...prev.avatar, imageUrl: null } }))}>Remove</Button>
                              </div>
                            )}
                            <label htmlFor="family-avatar-upload">
                              <input id="family-avatar-upload" type="file" accept="image/*" onChange={handleImageUpload} className="hidden" disabled={uploading} />
                              <Button type="button" variant="outline" onClick={() => document.getElementById('family-avatar-upload')?.click()} disabled={uploading} className="w-full">
                                {uploading ? 'Uploading...' : familyForm.avatar?.imageUrl ? 'Change Image' : 'Upload Image'}
                              </Button>
                            </label>
                            <p className="text-xs text-slate-500 text-center">JPG, PNG or GIF (max 5MB)</p>
                          </div>
                        </TabsContent>
                      </Tabs>
                    </PopoverContent>
                  </Popover>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label htmlFor="family-first-name">First Name <span className="text-red-500">*</span></Label>
                  <Input
                    id="family-first-name"
                    value={familyForm.first_name}
                    onChange={(e) => setFamilyForm(prev => ({ ...prev, first_name: e.target.value }))}
                    placeholder="First name"
                    required
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="family-last-name">Last Name <span className="text-red-500">*</span></Label>
                  <Input
                    id="family-last-name"
                    value={familyForm.last_name}
                    onChange={(e) => setFamilyForm(prev => ({ ...prev, last_name: e.target.value }))}
                    placeholder="Last name"
                    required
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="family-display-name">Display Name</Label>
                <Input
                  id="family-display-name"
                  value={familyForm.display_name}
                  onChange={(e) => setFamilyForm(prev => ({ ...prev, display_name: e.target.value }))}
                  placeholder={`${familyForm.first_name} ${familyForm.last_name}`.trim() || 'Display name'}
                />
                <p className="text-xs text-slate-500">Leave blank to use first and last name</p>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label htmlFor="family-dob">Date of Birth</Label>
                  <Input
                    id="family-dob"
                    type="date"
                    value={familyForm.date_of_birth}
                    onChange={(e) => setFamilyForm(prev => ({ ...prev, date_of_birth: e.target.value }))}
                  />
                  {age !== null && <p className="text-xs text-slate-500">Age: {age} years old</p>}
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="family-sex">Sex</Label>
                  <Select value={familyForm.sex} onValueChange={(v) => setFamilyForm(prev => ({ ...prev, sex: v }))}>
                    <SelectTrigger id="family-sex"><SelectValue placeholder="Select..." /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="male">Male</SelectItem>
                      <SelectItem value="female">Female</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <Separator />

              <div>
                <h3 className="text-sm font-semibold text-slate-700">Login Credentials</h3>
                <p className="text-xs text-slate-500 mt-1">Set up a username and PIN for direct login</p>
              </div>

              <div className="space-y-4 p-4 bg-slate-50 rounded-lg">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <Label htmlFor="family-username">Username <span className="text-red-500">*</span></Label>
                    <div className="relative">
                      <Input
                        id="family-username"
                        value={familyForm.username}
                        onChange={(e) => setFamilyForm(prev => ({ ...prev, username: e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, '') }))}
                        placeholder="username"
                        className="font-mono"
                        maxLength={20}
                        required
                      />
                      {familyForm.username.length >= 3 && (
                        <div className="absolute right-3 top-1/2 -translate-y-1/2">
                          {checkingUsername ? (
                            <LoaderIcon className="h-4 w-4 animate-spin text-slate-400" />
                          ) : usernameAvailable ? (
                            <Check className="h-4 w-4 text-green-600" />
                          ) : (
                            <X className="h-4 w-4 text-red-600" />
                          )}
                        </div>
                      )}
                    </div>
                    {familyForm.username.length > 0 && familyForm.username.length < 3 && <p className="text-xs text-slate-500">Must be at least 3 characters</p>}
                    {familyForm.username.length >= 3 && usernameAvailable === false && <p className="text-xs text-red-600">Username is already taken</p>}
                    {familyForm.username.length >= 3 && usernameAvailable === true && <p className="text-xs text-green-600">Username is available</p>}
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="family-pin">PIN (4 digits) <span className="text-red-500">*</span></Label>
                    <Input
                      id="family-pin"
                      type="text"
                      inputMode="numeric"
                      value={familyForm.pin}
                      onChange={(e) => setFamilyForm(prev => ({ ...prev, pin: e.target.value.replace(/\D/g, '').slice(0, 4) }))}
                      placeholder="1234"
                      maxLength={4}
                      className="text-center text-lg tracking-widest font-mono"
                      required
                    />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="family-email">Email (Optional)</Label>
                  <Input
                    id="family-email"
                    type="email"
                    value={familyForm.email}
                    onChange={(e) => setFamilyForm(prev => ({ ...prev, email: e.target.value }))}
                    placeholder="child@example.com"
                  />
                  <p className="text-xs text-slate-500">Can be used as an alternative login method</p>
                </div>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="family-notes">Notes (Optional)</Label>
                <Textarea
                  id="family-notes"
                  value={familyForm.notes}
                  onChange={(e) => setFamilyForm(prev => ({ ...prev, notes: e.target.value }))}
                  placeholder="Add any notes..."
                  rows={2}
                />
              </div>

              <SheetFooter className="pt-2">
                <Button type="button" variant="outline" onClick={() => handleOpenChange(false)} disabled={loading}>Cancel</Button>
                <Button type="submit" disabled={loading}>
                  {loading ? 'Creating...' : 'Create Profile'}
                </Button>
              </SheetFooter>
            </form>
              )}
            </div>
          )}

          {contactType === 'business' && (
            <div className="flex flex-col items-center justify-center py-12 text-center space-y-3">
              <div className="w-14 h-14 bg-orange-100 rounded-full flex items-center justify-center">
                <Briefcase className="w-7 h-7 text-orange-500" />
              </div>
              <h3 className="font-semibold text-slate-800">Business Profiles</h3>
              <p className="text-sm text-slate-500 max-w-xs">Business profile creation is coming soon. You'll be able to manage separate business finances here.</p>
              <SheetFooter className="pt-4 w-full">
                <Button type="button" variant="outline" onClick={() => handleOpenChange(false)}>Close</Button>
              </SheetFooter>
            </div>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
