import { useState } from 'react';
import { Card, CardContent, CardHeader } from '../ui/card';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '../ui/dropdown-menu';
import {
  CreditCard,
  FileText,
  Globe,
  Key,
  Copy,
  Eye,
  EyeOff,
  MoreVertical,
  Pencil,
  Trash2,
  Star,
  StarOff,
  Share2,
  RotateCcw,
  User,
} from 'lucide-react';
import { toast } from 'sonner';
import { formatDistanceToNow } from 'date-fns';

const categoryIcons = {
  login: Globe,
  card: CreditCard,
  note: FileText,
  identity: User,
};

const categoryColors = {
  login: 'bg-blue-500/10 text-blue-600 border-blue-200',
  card: 'bg-green-500/10 text-green-600 border-green-200',
  note: 'bg-yellow-500/10 text-yellow-600 border-yellow-200',
  identity: 'bg-purple-500/10 text-purple-600 border-purple-200',
};

export default function VaultItemCard({
  item,
  viewMode = 'grid',
  onEdit,
  onDelete,
  onRestore,
  onPermanentDelete,
  onToggleFavorite,
  showTrash = false,
}) {
  const [showPassword, setShowPassword] = useState(false);
  const Icon = categoryIcons[item.category] || Key;

  const copyToClipboard = async (text, label) => {
    try {
      await navigator.clipboard.writeText(text);
      toast.success(`${label} copied to clipboard`);

      setTimeout(() => {
        navigator.clipboard.writeText('');
      }, 60000);
    } catch (error) {
      toast.error('Failed to copy to clipboard');
    }
  };

  const getFaviconUrl = (url) => {
    if (!url) return null;
    try {
      const domain = new URL(url).hostname;
      return `https://www.google.com/s2/favicons?domain=${domain}&sz=32`;
    } catch {
      return null;
    }
  };

  if (viewMode === 'list') {
    return (
      <Card className="hover:shadow-md transition-shadow">
        <CardContent className="flex items-center justify-between p-4">
          <div className="flex items-center gap-4 flex-1 min-w-0">
            <div className={`p-2 rounded-lg ${categoryColors[item.category]}`}>
              <Icon className="w-5 h-5" />
            </div>

            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <h3 className="font-medium truncate">{item.name}</h3>
                {item.is_favorite && <Star className="w-4 h-4 text-yellow-500 fill-yellow-500" />}
                {item.is_shared && (
                  <Badge variant="secondary" className="text-xs">
                    Shared
                  </Badge>
                )}
              </div>
              <div className="flex items-center gap-2 text-sm text-muted-foreground mt-1">
                {item.username && <span className="truncate">{item.username}</span>}
                {item.url && (
                  <>
                    <span>•</span>
                    <span className="truncate">{item.url}</span>
                  </>
                )}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {!showTrash && item.username && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => copyToClipboard(item.username, 'Username')}
              >
                <Copy className="w-4 h-4" />
              </Button>
            )}

            {!showTrash && item.password && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => copyToClipboard(item.password, 'Password')}
              >
                <Key className="w-4 h-4" />
              </Button>
            )}

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="sm">
                  <MoreVertical className="w-4 h-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                {showTrash ? (
                  <>
                    <DropdownMenuItem onClick={onRestore}>
                      <RotateCcw className="w-4 h-4 mr-2" />
                      Restore
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onClick={onPermanentDelete} className="text-red-600">
                      <Trash2 className="w-4 h-4 mr-2" />
                      Delete Permanently
                    </DropdownMenuItem>
                  </>
                ) : (
                  <>
                    <DropdownMenuItem onClick={onEdit}>
                      <Pencil className="w-4 h-4 mr-2" />
                      Edit
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={onToggleFavorite}>
                      {item.is_favorite ? (
                        <>
                          <StarOff className="w-4 h-4 mr-2" />
                          Remove from Favorites
                        </>
                      ) : (
                        <>
                          <Star className="w-4 h-4 mr-2" />
                          Add to Favorites
                        </>
                      )}
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onClick={onDelete} className="text-red-600">
                      <Trash2 className="w-4 h-4 mr-2" />
                      Move to Trash
                    </DropdownMenuItem>
                  </>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="hover:shadow-md transition-shadow">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3 flex-1 min-w-0">
            {item.category === 'login' && item.url ? (
              <div className="w-10 h-10 rounded-lg border bg-white flex items-center justify-center flex-shrink-0">
                <img
                  src={getFaviconUrl(item.url)}
                  alt=""
                  className="w-6 h-6"
                  onError={(e) => {
                    e.target.style.display = 'none';
                    e.target.parentElement.innerHTML = '<div class="w-6 h-6 text-muted-foreground"><svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/></svg></div>';
                  }}
                />
              </div>
            ) : (
              <div className={`p-2 rounded-lg ${categoryColors[item.category]} flex-shrink-0`}>
                <Icon className="w-6 h-6" />
              </div>
            )}

            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <h3 className="font-semibold truncate">{item.name}</h3>
                {item.is_favorite && (
                  <Star className="w-4 h-4 text-yellow-500 fill-yellow-500 flex-shrink-0" />
                )}
              </div>
              {item.url && (
                <p className="text-sm text-muted-foreground truncate mt-1">{item.url}</p>
              )}
            </div>
          </div>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="sm" className="flex-shrink-0">
                <MoreVertical className="w-4 h-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              {showTrash ? (
                <>
                  <DropdownMenuItem onClick={onRestore}>
                    <RotateCcw className="w-4 h-4 mr-2" />
                    Restore
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={onPermanentDelete} className="text-red-600">
                    <Trash2 className="w-4 h-4 mr-2" />
                    Delete Permanently
                  </DropdownMenuItem>
                </>
              ) : (
                <>
                  <DropdownMenuItem onClick={onEdit}>
                    <Pencil className="w-4 h-4 mr-2" />
                    Edit
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={onToggleFavorite}>
                    {item.is_favorite ? (
                      <>
                        <StarOff className="w-4 h-4 mr-2" />
                        Remove from Favorites
                      </>
                    ) : (
                      <>
                        <Star className="w-4 h-4 mr-2" />
                        Add to Favorites
                      </>
                    )}
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={onDelete} className="text-red-600">
                    <Trash2 className="w-4 h-4 mr-2" />
                    Move to Trash
                  </DropdownMenuItem>
                </>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </CardHeader>

      <CardContent className="space-y-3">
        {item.username && (
          <div className="space-y-1">
            <label className="text-xs text-muted-foreground">Username</label>
            <div className="flex items-center gap-2">
              <code className="flex-1 text-sm bg-muted px-2 py-1 rounded truncate">
                {item.username}
              </code>
              {!showTrash && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => copyToClipboard(item.username, 'Username')}
                >
                  <Copy className="w-3 h-3" />
                </Button>
              )}
            </div>
          </div>
        )}

        {item.password && (
          <div className="space-y-1">
            <label className="text-xs text-muted-foreground">Password</label>
            <div className="flex items-center gap-2">
              <code className="flex-1 text-sm bg-muted px-2 py-1 rounded truncate">
                {showPassword ? item.password : '••••••••••••'}
              </code>
              {!showTrash && (
                <>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setShowPassword(!showPassword)}
                  >
                    {showPassword ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => copyToClipboard(item.password, 'Password')}
                  >
                    <Copy className="w-3 h-3" />
                  </Button>
                </>
              )}
            </div>
          </div>
        )}

        {item.tags && item.tags.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {item.tags.map((tag, i) => (
              <Badge key={i} variant="secondary" className="text-xs">
                {tag}
              </Badge>
            ))}
          </div>
        )}

        {item.is_shared && (
          <Badge variant="outline" className="text-xs">
            <Share2 className="w-3 h-3 mr-1" />
            Shared {item.shared_permission === 'edit' ? '(Can Edit)' : '(View Only)'}
          </Badge>
        )}

        {item.last_used_at && (
          <p className="text-xs text-muted-foreground">
            Last used {formatDistanceToNow(new Date(item.last_used_at), { addSuffix: true })}
          </p>
        )}
      </CardContent>
    </Card>
  );
}
