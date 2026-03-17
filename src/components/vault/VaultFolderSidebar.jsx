import { useState } from 'react';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { ScrollArea } from '../ui/scroll-area';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '../ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '../ui/dropdown-menu';
import {
  Folder,
  FolderPlus,
  Star,
  Clock,
  MoreVertical,
  Pencil,
  Trash2,
  Lock,
  Trash,
} from 'lucide-react';
import { vaultService } from '../../api/vaultService';
import { toast } from 'sonner';
import { cn } from '../../lib/utils';

export default function VaultFolderSidebar({
  folders,
  selectedFolder,
  onSelectFolder,
  onFoldersChange,
  profileId,
  showTrash,
  onToggleTrash,
}) {
  const [showNewFolderDialog, setShowNewFolderDialog] = useState(false);
  const [editingFolder, setEditingFolder] = useState(null);
  const [folderName, setFolderName] = useState('');

  const handleCreateFolder = async () => {
    if (!folderName.trim()) return;

    try {
      await vaultService.createFolder({
        profile_id: profileId,
        name: folderName.trim(),
        sort_order: folders.length,
      });
      toast.success('Folder created');
      setFolderName('');
      setShowNewFolderDialog(false);
      onFoldersChange();
    } catch (error) {
      console.error('Error creating folder:', error);
      toast.error('Failed to create folder');
    }
  };

  const handleUpdateFolder = async () => {
    if (!folderName.trim() || !editingFolder) return;

    try {
      await vaultService.updateFolder(editingFolder.id, {
        name: folderName.trim(),
      });
      toast.success('Folder updated');
      setFolderName('');
      setEditingFolder(null);
      onFoldersChange();
    } catch (error) {
      console.error('Error updating folder:', error);
      toast.error('Failed to update folder');
    }
  };

  const handleDeleteFolder = async (folderId) => {
    try {
      await vaultService.deleteFolder(folderId);
      toast.success('Folder deleted');
      if (selectedFolder === folderId) {
        onSelectFolder('all');
      }
      onFoldersChange();
    } catch (error) {
      console.error('Error deleting folder:', error);
      toast.error('Failed to delete folder');
    }
  };

  const defaultViews = [
    {
      id: 'all',
      name: 'All Items',
      icon: Lock,
    },
    {
      id: 'favorites',
      name: 'Favorites',
      icon: Star,
    },
    {
      id: 'recent',
      name: 'Recently Used',
      icon: Clock,
    },
  ];

  return (
    <>
      <div className="w-64 border-r bg-muted/10 flex flex-col">
        <div className="p-4 border-b">
          <Button
            onClick={() => setShowNewFolderDialog(true)}
            variant="outline"
            className="w-full"
            size="sm"
          >
            <FolderPlus className="w-4 h-4 mr-2" />
            New Folder
          </Button>
        </div>

        <ScrollArea className="flex-1">
          <div className="p-2 space-y-1">
            {defaultViews.map((view) => {
              const Icon = view.icon;
              return (
                <Button
                  key={view.id}
                  variant={selectedFolder === view.id && !showTrash ? 'secondary' : 'ghost'}
                  className={cn('w-full justify-start', selectedFolder === view.id && !showTrash && 'bg-secondary')}
                  onClick={() => {
                    onSelectFolder(view.id);
                    if (showTrash) onToggleTrash();
                  }}
                  size="sm"
                >
                  <Icon className="w-4 h-4 mr-2" />
                  {view.name}
                </Button>
              );
            })}

            {folders.length > 0 && (
              <>
                <div className="px-2 py-2 mt-4">
                  <p className="text-xs font-medium text-muted-foreground uppercase">Folders</p>
                </div>
                {folders.map((folder) => (
                  <div
                    key={folder.id}
                    className={cn(
                      'flex items-center group rounded-md hover:bg-secondary/50',
                      selectedFolder === folder.id && !showTrash && 'bg-secondary'
                    )}
                  >
                    <Button
                      variant="ghost"
                      className="flex-1 justify-start"
                      onClick={() => {
                        onSelectFolder(folder.id);
                        if (showTrash) onToggleTrash();
                      }}
                      size="sm"
                    >
                      <Folder className="w-4 h-4 mr-2" />
                      {folder.name}
                    </Button>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="opacity-0 group-hover:opacity-100"
                        >
                          <MoreVertical className="w-4 h-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem
                          onClick={() => {
                            setEditingFolder(folder);
                            setFolderName(folder.name);
                          }}
                        >
                          <Pencil className="w-4 h-4 mr-2" />
                          Rename
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onClick={() => handleDeleteFolder(folder.id)}
                          className="text-red-600"
                        >
                          <Trash2 className="w-4 h-4 mr-2" />
                          Delete
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                ))}
              </>
            )}
          </div>
        </ScrollArea>

        <div className="p-2 border-t">
          <Button
            variant={showTrash ? 'secondary' : 'ghost'}
            className={cn('w-full justify-start', showTrash && 'bg-secondary')}
            onClick={onToggleTrash}
            size="sm"
          >
            <Trash className="w-4 h-4 mr-2" />
            Trash
          </Button>
        </div>
      </div>

      <Dialog
        open={showNewFolderDialog || !!editingFolder}
        onOpenChange={(open) => {
          if (!open) {
            setShowNewFolderDialog(false);
            setEditingFolder(null);
            setFolderName('');
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingFolder ? 'Rename Folder' : 'Create New Folder'}</DialogTitle>
            <DialogDescription>
              {editingFolder
                ? 'Enter a new name for this folder'
                : 'Create a folder to organize your vault items'}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="folder-name">Folder Name</Label>
              <Input
                id="folder-name"
                placeholder="e.g., Work Accounts"
                value={folderName}
                onChange={(e) => setFolderName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    if (editingFolder) {
                      handleUpdateFolder();
                    } else {
                      handleCreateFolder();
                    }
                  }
                }}
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setShowNewFolderDialog(false);
                setEditingFolder(null);
                setFolderName('');
              }}
            >
              Cancel
            </Button>
            <Button onClick={editingFolder ? handleUpdateFolder : handleCreateFolder}>
              {editingFolder ? 'Update' : 'Create'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
