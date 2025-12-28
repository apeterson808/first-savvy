import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useProfile } from '@/contexts/ProfileContext';
import {
  getUserChartOfAccountsHierarchy,
  createUserIncomeCategory,
  createUserExpenseCategory,
  updateAccountDisplayName,
  updateAccountNumber,
  toggleAccountActive,
  deleteUserCreatedAccount,
  updateAccountIconColor,
  getAccountNumberRanges,
  getFullDisplayName
} from '@/api/chartOfAccounts';
import { manualProvisionCurrentUser } from '@/api/profiles';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { ChevronRight, ChevronDown, Plus, Edit2, Trash2, Lock, Unlock, Eye, EyeOff } from 'lucide-react';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Switch } from '@/components/ui/switch';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import IconPicker from '@/components/common/IconPicker';
import ColorPicker from '@/components/common/ColorPicker';

const AccountNode = ({ account, onEdit, onToggleActive, onDelete, depth = 0 }) => {
  const [isOpen, setIsOpen] = useState(depth < 2);
  const hasChildren = account.children && account.children.length > 0;
  const isEditable = account.is_editable || account.is_user_created;
  const canDelete = account.is_user_created;

  const getAccountTypeColor = (type) => {
    switch (type) {
      case 'asset': return 'bg-green-100 text-green-800';
      case 'liability': return 'bg-red-100 text-red-800';
      case 'equity': return 'bg-purple-100 text-purple-800';
      case 'income': return 'bg-blue-100 text-blue-800';
      case 'expense': return 'bg-orange-100 text-orange-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getActivationStatusBadge = () => {
    if (!account.is_active) {
      return (
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger>
              <Badge variant="secondary" className="text-xs">Inactive</Badge>
            </TooltipTrigger>
            <TooltipContent>
              <p className="text-xs">Account is not currently in use.</p>
              <p className="text-xs">Activate by adding to budget or linking account.</p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      );
    }
    return null;
  };

  return (
    <div className="ml-4">
      <div className={`flex items-center gap-2 py-2 px-3 rounded-lg hover:bg-gray-50 ${!account.is_active ? 'opacity-50' : ''}`}>
        {hasChildren ? (
          <button onClick={() => setIsOpen(!isOpen)} className="p-0.5">
            {isOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
          </button>
        ) : (
          <div className="w-5" />
        )}

        <div className="flex-1 flex items-center gap-2">
          <span className="font-mono text-sm text-gray-500">{account.account_number}</span>
          <span className="font-medium">{account.displayName}</span>

          {account.level === 1 && (
            <Badge className={getAccountTypeColor(account.account_type)}>
              {account.account_type}
            </Badge>
          )}

          {account.is_user_created && (
            <Badge variant="outline" className="text-xs">Custom</Badge>
          )}

          {getActivationStatusBadge()}
        </div>

        <div className="flex items-center gap-1">
          {isEditable ? (
            <Button
              size="sm"
              variant="ghost"
              onClick={() => onEdit(account)}
            >
              <Edit2 className="h-3 w-3" />
            </Button>
          ) : (
            <Lock className="h-3 w-3 text-gray-400" />
          )}

          {account.level > 1 && (
            <Switch
              checked={account.is_active}
              onCheckedChange={(checked) => onToggleActive(account.id, checked)}
            />
          )}

          {canDelete && (
            <Button
              size="sm"
              variant="ghost"
              onClick={() => onDelete(account)}
            >
              <Trash2 className="h-3 w-3 text-red-500" />
            </Button>
          )}
        </div>
      </div>

      {hasChildren && isOpen && (
        <div className="ml-2">
          {account.children.map(child => (
            <AccountNode
              key={child.id}
              account={child}
              onEdit={onEdit}
              onToggleActive={onToggleActive}
              onDelete={onDelete}
              depth={depth + 1}
            />
          ))}
        </div>
      )}
    </div>
  );
};

const EditAccountDialog = ({ account, open, onClose, onSave }) => {
  const [displayName, setDisplayName] = useState('');
  const [accountNumber, setAccountNumber] = useState('');
  const [icon, setIcon] = useState('');
  const [color, setColor] = useState('');
  const [numberRange, setNumberRange] = useState(null);

  useEffect(() => {
    if (account) {
      setDisplayName(account.display_name || account.displayName);
      setAccountNumber(account.account_number);
      setIcon(account.icon || '');
      setColor(account.color || '');

      if (account.is_user_created) {
        getAccountNumberRanges(account.class).then(range => {
          setNumberRange(range);
        });
      }
    }
  }, [account]);

  const handleSave = async () => {
    try {
      if (displayName !== (account.display_name || account.displayName)) {
        await updateAccountDisplayName(account.id, displayName);
      }

      if (account.is_user_created && accountNumber !== account.account_number) {
        await updateAccountNumber(account.id, parseInt(accountNumber));
      }

      if (icon !== account.icon || color !== account.color) {
        await updateAccountIconColor(account.id, icon, color);
      }

      toast.success('Account updated successfully');
      onSave();
      onClose();
    } catch (error) {
      toast.error(error.message || 'Failed to update account');
    }
  };

  if (!account) return null;

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Edit Account</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div>
            <Label>Display Name</Label>
            <Input
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              placeholder="Enter display name"
            />
          </div>

          {account.is_user_created && numberRange && (
            <div>
              <Label>Account Number</Label>
              <Input
                type="number"
                value={accountNumber}
                onChange={(e) => setAccountNumber(e.target.value)}
                min={numberRange.number_range_start}
                max={numberRange.number_range_end}
              />
              <p className="text-xs text-gray-500 mt-1">
                Allowed range: {numberRange.number_range_start} - {numberRange.number_range_end}
              </p>
            </div>
          )}

          <div>
            <Label>Icon (Optional)</Label>
            <IconPicker value={icon} onValueChange={setIcon} />
          </div>

          <div>
            <Label>Color (Optional)</Label>
            <ColorPicker value={color} onChange={setColor} />
          </div>

          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={onClose}>Cancel</Button>
            <Button onClick={handleSave}>Save Changes</Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

const AddCategoryDialog = ({ accountType, open, onClose, onSave }) => {
  const { activeProfile } = useProfile();
  const [name, setName] = useState('');
  const [accountNumber, setAccountNumber] = useState('');
  const [icon, setIcon] = useState('');
  const [color, setColor] = useState('');
  const [numberRange, setNumberRange] = useState(null);
  const [autoNumber, setAutoNumber] = useState(true);

  useEffect(() => {
    if (open && accountType) {
      getAccountNumberRanges(accountType).then(range => {
        setNumberRange(range);
        if (range) {
          setAccountNumber(range.number_range_start.toString());
        }
      });
    }
  }, [open, accountType]);

  const handleSave = async () => {
    if (!activeProfile?.id) return;

    try {
      const categoryData = {
        name,
        accountNumber: autoNumber ? null : parseInt(accountNumber),
        icon: icon || null,
        color: color || null
      };

      if (accountType === 'income') {
        await createUserIncomeCategory(activeProfile.id, categoryData);
      } else {
        await createUserExpenseCategory(activeProfile.id, categoryData);
      }

      toast.success(`${accountType} category created successfully`);
      onSave();
      onClose();
      setName('');
      setAccountNumber('');
      setIcon('');
      setColor('');
    } catch (error) {
      toast.error(error.message || 'Failed to create category');
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add {accountType === 'income' ? 'Income' : 'Expense'} Category</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div>
            <Label>Category Name</Label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Enter category name"
            />
          </div>

          <div className="flex items-center gap-2">
            <Switch
              checked={autoNumber}
              onCheckedChange={setAutoNumber}
            />
            <Label>Auto-assign account number</Label>
          </div>

          {!autoNumber && numberRange && (
            <div>
              <Label>Account Number</Label>
              <Input
                type="number"
                value={accountNumber}
                onChange={(e) => setAccountNumber(e.target.value)}
                min={numberRange.number_range_start}
                max={numberRange.number_range_end}
              />
              <p className="text-xs text-gray-500 mt-1">
                Allowed range: {numberRange.number_range_start} - {numberRange.number_range_end}
              </p>
            </div>
          )}

          <div>
            <Label>Icon (Optional)</Label>
            <IconPicker value={icon} onValueChange={setIcon} />
          </div>

          <div>
            <Label>Color (Optional)</Label>
            <ColorPicker value={color} onChange={setColor} />
          </div>

          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={onClose}>Cancel</Button>
            <Button onClick={handleSave} disabled={!name.trim()}>Create Category</Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default function ChartOfAccountsTab() {
  const { user } = useAuth();
  const { activeProfile } = useProfile();
  const [accounts, setAccounts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedAccount, setSelectedAccount] = useState(null);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [addDialogType, setAddDialogType] = useState('income');
  const [showInactive, setShowInactive] = useState(false);

  const loadAccounts = async () => {
    if (!activeProfile?.id) return;

    try {
      setLoading(true);
      const hierarchy = await getUserChartOfAccountsHierarchy(activeProfile.id, null, showInactive);
      setAccounts(hierarchy);
    } catch (error) {
      console.error('Failed to load chart of accounts:', error);
      toast.error('Failed to load chart of accounts');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (activeProfile?.id) {
      loadAccounts();
    }
  }, [activeProfile?.id, showInactive]);

  const handleEdit = (account) => {
    setSelectedAccount(account);
    setEditDialogOpen(true);
  };

  const handleToggleActive = async (accountId, isActive) => {
    try {
      await toggleAccountActive(accountId, isActive);
      toast.success(`Account ${isActive ? 'activated' : 'deactivated'}`);
      loadAccounts();
    } catch (error) {
      toast.error('Failed to update account status');
    }
  };

  const handleDelete = async (account) => {
    if (!confirm(`Are you sure you want to delete "${account.displayName}"?`)) {
      return;
    }

    try {
      await deleteUserCreatedAccount(account.id);
      toast.success('Account deleted successfully');
      loadAccounts();
    } catch (error) {
      toast.error(error.message || 'Failed to delete account');
    }
  };

  const openAddDialog = (type) => {
    setAddDialogType(type);
    setAddDialogOpen(true);
  };

  const handleManualProvision = async () => {
    try {
      setLoading(true);
      const result = await manualProvisionCurrentUser();
      if (result.success) {
        toast.success(`Provisioned ${result.accounts_provisioned} accounts successfully`);
        await loadAccounts();
      } else {
        toast.error(result.error || 'Failed to provision accounts');
      }
    } catch (error) {
      toast.error(error.message || 'Failed to provision accounts');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return <div className="p-4">Loading chart of accounts...</div>;
  }

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-semibold">Chart of Accounts</h3>
        <p className="text-sm text-gray-600 mt-1">
          Manage your unified chart of accounts. Accounts activate automatically when used in budgets or linked to financial instruments.
        </p>
      </div>

      <div className="flex justify-between items-center">
        <div className="flex gap-2">
          <Button onClick={() => openAddDialog('income')}>
            <Plus className="h-4 w-4 mr-2" />
            Add Income Category
          </Button>
          <Button onClick={() => openAddDialog('expense')}>
            <Plus className="h-4 w-4 mr-2" />
            Add Expense Category
          </Button>
        </div>

        <div className="flex items-center gap-2">
          <Switch
            checked={showInactive}
            onCheckedChange={setShowInactive}
          />
          <Label className="cursor-pointer" onClick={() => setShowInactive(!showInactive)}>
            {showInactive ? (
              <span className="flex items-center gap-1">
                <Eye className="h-4 w-4" />
                Showing Inactive
              </span>
            ) : (
              <span className="flex items-center gap-1">
                <EyeOff className="h-4 w-4" />
                Hiding Inactive
              </span>
            )}
          </Label>
        </div>
      </div>

      <Separator />

      {accounts.length === 0 ? (
        <div className="p-8 text-center text-gray-500">
          <p>No accounts found.</p>
          {!showInactive && (
            <p className="text-sm mt-2">Try enabling "Show Inactive" to see all accounts.</p>
          )}
          <div className="mt-4">
            <Button onClick={handleManualProvision}>
              Provision Chart of Accounts
            </Button>
            <p className="text-xs mt-2 text-gray-400">
              This will create 81 standard accounts for your use
            </p>
          </div>
        </div>
      ) : (
        <div className="space-y-2">
          {accounts.map(account => (
            <AccountNode
              key={account.id}
              account={account}
              onEdit={handleEdit}
              onToggleActive={handleToggleActive}
              onDelete={handleDelete}
            />
          ))}
        </div>
      )}

      <EditAccountDialog
        account={selectedAccount}
        open={editDialogOpen}
        onClose={() => {
          setEditDialogOpen(false);
          setSelectedAccount(null);
        }}
        onSave={loadAccounts}
      />

      <AddCategoryDialog
        accountType={addDialogType}
        open={addDialogOpen}
        onClose={() => setAddDialogOpen(false)}
        onSave={loadAccounts}
      />
    </div>
  );
}
