import { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '../ui/dialog';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Textarea } from '../ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../ui/tabs';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../ui/select';
import { Badge } from '../ui/badge';
import { Globe, CreditCard, FileText, User, Wand2, X } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '../ui/popover';
import PasswordGenerator from './PasswordGenerator';
import { Checkbox } from '../ui/checkbox';

const categoryTabs = [
  { value: 'login', label: 'Login', icon: Globe },
  { value: 'card', label: 'Card', icon: CreditCard },
  { value: 'note', label: 'Note', icon: FileText },
  { value: 'identity', label: 'Identity', icon: User },
];

export default function VaultItemDialog({
  open,
  onOpenChange,
  onSave,
  item = null,
  profileId,
  folders = [],
}) {
  const [category, setCategory] = useState(item?.category || 'login');
  const [formData, setFormData] = useState({
    name: '',
    url: '',
    username: '',
    password: '',
    notes: '',
    folder_id: null,
    tags: [],
    is_favorite: false,
    ...item,
  });
  const [tagInput, setTagInput] = useState('');
  const [showGenerator, setShowGenerator] = useState(false);

  useEffect(() => {
    if (item) {
      setFormData({
        name: item.name || '',
        url: item.url || '',
        username: item.username || '',
        password: item.password || '',
        notes: item.notes || '',
        folder_id: item.folder_id || null,
        tags: item.tags || [],
        is_favorite: item.is_favorite || false,
      });
      setCategory(item.category);
    }
  }, [item]);

  const handleSubmit = (e) => {
    e.preventDefault();

    const data = {
      category,
      name: formData.name,
      url: formData.url || null,
      username: formData.username || null,
      password: formData.password || null,
      notes: formData.notes || null,
      folder_id: formData.folder_id || null,
      tags: formData.tags,
      is_favorite: formData.is_favorite,
    };

    onSave(data);
  };

  const handleAddTag = () => {
    if (tagInput.trim() && !formData.tags.includes(tagInput.trim())) {
      setFormData({
        ...formData,
        tags: [...formData.tags, tagInput.trim()],
      });
      setTagInput('');
    }
  };

  const handleRemoveTag = (tag) => {
    setFormData({
      ...formData,
      tags: formData.tags.filter((t) => t !== tag),
    });
  };

  const handlePasswordGenerated = (password) => {
    setFormData({ ...formData, password });
    setShowGenerator(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{item ? 'Edit Item' : 'Add New Item'}</DialogTitle>
          <DialogDescription>
            {item ? 'Update your vault item details' : 'Add a new item to your vault'}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <Tabs value={category} onValueChange={setCategory}>
            <TabsList className="grid grid-cols-4 w-full">
              {categoryTabs.map((tab) => {
                const Icon = tab.icon;
                return (
                  <TabsTrigger key={tab.value} value={tab.value} className="gap-2">
                    <Icon className="w-4 h-4" />
                    {tab.label}
                  </TabsTrigger>
                );
              })}
            </TabsList>

            <TabsContent value="login" className="space-y-4 mt-4">
              <div className="space-y-2">
                <Label htmlFor="name">Name *</Label>
                <Input
                  id="name"
                  placeholder="e.g., Gmail Account"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="url">Website URL</Label>
                <Input
                  id="url"
                  type="url"
                  placeholder="https://example.com"
                  value={formData.url}
                  onChange={(e) => setFormData({ ...formData, url: e.target.value })}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="username">Username / Email</Label>
                <Input
                  id="username"
                  placeholder="user@example.com"
                  value={formData.username}
                  onChange={(e) => setFormData({ ...formData, username: e.target.value })}
                />
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label htmlFor="password">Password</Label>
                  <Popover open={showGenerator} onOpenChange={setShowGenerator}>
                    <PopoverTrigger asChild>
                      <Button type="button" variant="outline" size="sm">
                        <Wand2 className="w-4 h-4 mr-2" />
                        Generate
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-96" align="end">
                      <PasswordGenerator onPasswordGenerated={handlePasswordGenerated} />
                    </PopoverContent>
                  </Popover>
                </div>
                <Input
                  id="password"
                  type="text"
                  placeholder="Enter password"
                  value={formData.password}
                  onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="notes">Notes</Label>
                <Textarea
                  id="notes"
                  placeholder="Additional notes..."
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  rows={3}
                />
              </div>
            </TabsContent>

            <TabsContent value="card" className="space-y-4 mt-4">
              <div className="space-y-2">
                <Label htmlFor="card-name">Card Name *</Label>
                <Input
                  id="card-name"
                  placeholder="e.g., Personal Visa"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="card-username">Cardholder Name</Label>
                <Input
                  id="card-username"
                  placeholder="John Doe"
                  value={formData.username}
                  onChange={(e) => setFormData({ ...formData, username: e.target.value })}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="card-password">Card Number</Label>
                <Input
                  id="card-password"
                  placeholder="1234 5678 9012 3456"
                  value={formData.password}
                  onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="card-notes">Additional Details</Label>
                <Textarea
                  id="card-notes"
                  placeholder="Expiration, CVV, billing address, etc."
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  rows={3}
                />
              </div>
            </TabsContent>

            <TabsContent value="note" className="space-y-4 mt-4">
              <div className="space-y-2">
                <Label htmlFor="note-name">Title *</Label>
                <Input
                  id="note-name"
                  placeholder="e.g., Server SSH Keys"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="note-content">Content</Label>
                <Textarea
                  id="note-content"
                  placeholder="Your secure note..."
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  rows={10}
                />
              </div>
            </TabsContent>

            <TabsContent value="identity" className="space-y-4 mt-4">
              <div className="space-y-2">
                <Label htmlFor="identity-name">Identity Name *</Label>
                <Input
                  id="identity-name"
                  placeholder="e.g., Personal Identity"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="identity-username">Full Name</Label>
                <Input
                  id="identity-username"
                  placeholder="John Doe"
                  value={formData.username}
                  onChange={(e) => setFormData({ ...formData, username: e.target.value })}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="identity-password">ID / License Number</Label>
                <Input
                  id="identity-password"
                  placeholder="ID number, license number, etc."
                  value={formData.password}
                  onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="identity-notes">Additional Information</Label>
                <Textarea
                  id="identity-notes"
                  placeholder="Address, phone, email, date of birth, etc."
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  rows={5}
                />
              </div>
            </TabsContent>
          </Tabs>

          <div className="space-y-2">
            <Label htmlFor="folder">Folder</Label>
            <Select
              value={formData.folder_id || 'none'}
              onValueChange={(value) =>
                setFormData({ ...formData, folder_id: value === 'none' ? null : value })
              }
            >
              <SelectTrigger>
                <SelectValue placeholder="No folder" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">No folder</SelectItem>
                {folders.map((folder) => (
                  <SelectItem key={folder.id} value={folder.id}>
                    {folder.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="tags">Tags</Label>
            <div className="flex gap-2">
              <Input
                id="tags"
                placeholder="Add a tag..."
                value={tagInput}
                onChange={(e) => setTagInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    handleAddTag();
                  }
                }}
              />
              <Button type="button" onClick={handleAddTag} variant="outline">
                Add
              </Button>
            </div>
            {formData.tags.length > 0 && (
              <div className="flex flex-wrap gap-2 mt-2">
                {formData.tags.map((tag, i) => (
                  <Badge key={i} variant="secondary" className="gap-1">
                    {tag}
                    <button
                      type="button"
                      onClick={() => handleRemoveTag(tag)}
                      className="ml-1 hover:text-destructive"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </Badge>
                ))}
              </div>
            )}
          </div>

          <div className="flex items-center space-x-2">
            <Checkbox
              id="favorite"
              checked={formData.is_favorite}
              onCheckedChange={(checked) => setFormData({ ...formData, is_favorite: checked })}
            />
            <label htmlFor="favorite" className="text-sm cursor-pointer">
              Mark as favorite
            </label>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit">{item ? 'Update' : 'Create'}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
