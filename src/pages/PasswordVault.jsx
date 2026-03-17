import { useState, useEffect } from 'react';
import { useProfile } from '../contexts/ProfileContext';
import { vaultService } from '../api/vaultService';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Card, CardContent } from '../components/ui/card';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '../components/ui/tabs';
import { Plus, Search, Lock, Star, Clock, Trash2, FolderOpen, Grid3x3, List } from 'lucide-react';
import { toast } from 'sonner';
import VaultItemCard from '../components/vault/VaultItemCard';
import VaultItemDialog from '../components/vault/VaultItemDialog';
import VaultFolderSidebar from '../components/vault/VaultFolderSidebar';

export default function PasswordVault() {
  const { currentProfile } = useProfile();
  const [items, setItems] = useState([]);
  const [folders, setFolders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedFolder, setSelectedFolder] = useState('all');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [viewMode, setViewMode] = useState('grid');
  const [showItemDialog, setShowItemDialog] = useState(false);
  const [editingItem, setEditingItem] = useState(null);
  const [showTrash, setShowTrash] = useState(false);

  useEffect(() => {
    if (currentProfile?.id) {
      loadVaultData();
    }
  }, [currentProfile]);

  const loadVaultData = async () => {
    try {
      setLoading(true);
      const [itemsData, foldersData] = await Promise.all([
        vaultService.getAllItems(currentProfile.id),
        vaultService.getFolders(currentProfile.id),
      ]);
      setItems(itemsData);
      setFolders(foldersData);
    } catch (error) {
      console.error('Error loading vault data:', error);
      toast.error('Failed to load vault data');
    } finally {
      setLoading(false);
    }
  };

  const handleCreateItem = async (itemData) => {
    try {
      await vaultService.createItem(itemData, currentProfile.id);
      toast.success('Item created successfully');
      loadVaultData();
      setShowItemDialog(false);
    } catch (error) {
      console.error('Error creating item:', error);
      toast.error('Failed to create item');
    }
  };

  const handleUpdateItem = async (itemId, itemData) => {
    try {
      await vaultService.updateItem(itemId, itemData);
      toast.success('Item updated successfully');
      loadVaultData();
      setEditingItem(null);
    } catch (error) {
      console.error('Error updating item:', error);
      toast.error('Failed to update item');
    }
  };

  const handleDeleteItem = async (itemId) => {
    try {
      await vaultService.deleteItem(itemId);
      toast.success('Item moved to trash');
      loadVaultData();
    } catch (error) {
      console.error('Error deleting item:', error);
      toast.error('Failed to delete item');
    }
  };

  const handleRestoreItem = async (itemId) => {
    try {
      await vaultService.restoreItem(itemId);
      toast.success('Item restored');
      loadVaultData();
    } catch (error) {
      console.error('Error restoring item:', error);
      toast.error('Failed to restore item');
    }
  };

  const handlePermanentDelete = async (itemId) => {
    try {
      await vaultService.permanentlyDeleteItem(itemId);
      toast.success('Item permanently deleted');
      loadVaultData();
    } catch (error) {
      console.error('Error permanently deleting item:', error);
      toast.error('Failed to permanently delete item');
    }
  };

  const handleToggleFavorite = async (item) => {
    try {
      await vaultService.updateItem(item.id, {
        is_favorite: !item.is_favorite,
      });
      loadVaultData();
    } catch (error) {
      console.error('Error toggling favorite:', error);
      toast.error('Failed to update favorite');
    }
  };

  const filteredItems = items.filter((item) => {
    if (showTrash) {
      if (!item.deleted_at) return false;
    } else {
      if (item.deleted_at) return false;
    }

    if (selectedFolder === 'favorites' && !item.is_favorite) return false;
    if (selectedFolder === 'recent') {
      const dayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
      if (!item.last_used_at || new Date(item.last_used_at) < dayAgo) return false;
    }
    if (selectedFolder !== 'all' && selectedFolder !== 'favorites' && selectedFolder !== 'recent') {
      if (item.folder_id !== selectedFolder) return false;
    }

    if (selectedCategory !== 'all' && item.category !== selectedCategory) return false;

    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      return (
        item.name?.toLowerCase().includes(query) ||
        item.username?.toLowerCase().includes(query) ||
        item.url?.toLowerCase().includes(query) ||
        item.notes?.toLowerCase().includes(query) ||
        item.tags?.some((tag) => tag.toLowerCase().includes(query))
      );
    }

    return true;
  });

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center">
          <Lock className="w-12 h-12 mx-auto mb-4 text-muted-foreground animate-pulse" />
          <p className="text-muted-foreground">Loading vault...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-full">
      <VaultFolderSidebar
        folders={folders}
        selectedFolder={selectedFolder}
        onSelectFolder={setSelectedFolder}
        onFoldersChange={loadVaultData}
        profileId={currentProfile.id}
        showTrash={showTrash}
        onToggleTrash={() => {
          setShowTrash(!showTrash);
          setSelectedFolder('all');
        }}
      />

      <div className="flex-1 flex flex-col overflow-hidden">
        <div className="border-b bg-background p-4 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-semibold flex items-center gap-2">
                <Lock className="w-6 h-6" />
                {showTrash ? 'Trash' : 'Password Vault'}
              </h1>
              <p className="text-sm text-muted-foreground mt-1">
                {showTrash
                  ? 'Items will be permanently deleted after 30 days'
                  : 'Securely store and manage your passwords'}
              </p>
            </div>
            {!showTrash && (
              <Button onClick={() => setShowItemDialog(true)}>
                <Plus className="w-4 h-4 mr-2" />
                Add Item
              </Button>
            )}
          </div>

          <div className="flex items-center gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Search vault..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9"
              />
            </div>

            <Tabs value={selectedCategory} onValueChange={setSelectedCategory} className="w-auto">
              <TabsList>
                <TabsTrigger value="all">All</TabsTrigger>
                <TabsTrigger value="login">Logins</TabsTrigger>
                <TabsTrigger value="card">Cards</TabsTrigger>
                <TabsTrigger value="note">Notes</TabsTrigger>
                <TabsTrigger value="identity">Identity</TabsTrigger>
              </TabsList>
            </Tabs>

            <div className="flex items-center border rounded-md">
              <Button
                variant={viewMode === 'grid' ? 'secondary' : 'ghost'}
                size="sm"
                onClick={() => setViewMode('grid')}
              >
                <Grid3x3 className="w-4 h-4" />
              </Button>
              <Button
                variant={viewMode === 'list' ? 'secondary' : 'ghost'}
                size="sm"
                onClick={() => setViewMode('list')}
              >
                <List className="w-4 h-4" />
              </Button>
            </div>
          </div>
        </div>

        <div className="flex-1 overflow-auto p-6">
          {filteredItems.length === 0 ? (
            <Card className="border-dashed">
              <CardContent className="flex flex-col items-center justify-center py-12">
                {showTrash ? (
                  <>
                    <Trash2 className="w-12 h-12 text-muted-foreground mb-4" />
                    <h3 className="text-lg font-medium mb-2">Trash is empty</h3>
                    <p className="text-sm text-muted-foreground text-center max-w-sm">
                      Deleted items will appear here and be permanently removed after 30 days.
                    </p>
                  </>
                ) : searchQuery || selectedCategory !== 'all' || selectedFolder !== 'all' ? (
                  <>
                    <Search className="w-12 h-12 text-muted-foreground mb-4" />
                    <h3 className="text-lg font-medium mb-2">No items found</h3>
                    <p className="text-sm text-muted-foreground text-center max-w-sm">
                      Try adjusting your search or filters.
                    </p>
                  </>
                ) : (
                  <>
                    <Lock className="w-12 h-12 text-muted-foreground mb-4" />
                    <h3 className="text-lg font-medium mb-2">Your vault is empty</h3>
                    <p className="text-sm text-muted-foreground text-center max-w-sm mb-4">
                      Start by adding your first password, card, or secure note.
                    </p>
                    <Button onClick={() => setShowItemDialog(true)}>
                      <Plus className="w-4 h-4 mr-2" />
                      Add Your First Item
                    </Button>
                  </>
                )}
              </CardContent>
            </Card>
          ) : (
            <div
              className={
                viewMode === 'grid'
                  ? 'grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4'
                  : 'space-y-2'
              }
            >
              {filteredItems.map((item) => (
                <VaultItemCard
                  key={item.id}
                  item={item}
                  viewMode={viewMode}
                  onEdit={() => setEditingItem(item)}
                  onDelete={() => handleDeleteItem(item.id)}
                  onRestore={() => handleRestoreItem(item.id)}
                  onPermanentDelete={() => handlePermanentDelete(item.id)}
                  onToggleFavorite={() => handleToggleFavorite(item)}
                  showTrash={showTrash}
                />
              ))}
            </div>
          )}
        </div>
      </div>

      {showItemDialog && (
        <VaultItemDialog
          open={showItemDialog}
          onOpenChange={setShowItemDialog}
          onSave={handleCreateItem}
          profileId={currentProfile.id}
          folders={folders}
        />
      )}

      {editingItem && (
        <VaultItemDialog
          open={!!editingItem}
          onOpenChange={(open) => !open && setEditingItem(null)}
          onSave={(data) => handleUpdateItem(editingItem.id, data)}
          item={editingItem}
          profileId={currentProfile.id}
          folders={folders}
        />
      )}
    </div>
  );
}
