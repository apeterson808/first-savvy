import React, { useState, useEffect, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Separator } from '@/components/ui/separator';
import { format } from 'date-fns';
import { formatCurrency } from '@/components/utils/formatters';
import {
  getJournalEntryWithLines,
  updateJournalEntryWithLines,
  getJournalEntryAttachments,
  uploadJournalEntryAttachment,
  deleteJournalEntryAttachment,
  getAttachmentUrl
} from '@/api/journalEntries';
import { FileText, Calendar, User, CheckCircle2, AlertCircle, Edit2, X, Save, Upload, Paperclip, Download, Trash2, Lock } from 'lucide-react';
import { getIconComponent } from '@/components/utils/iconMapper';
import { toast } from 'sonner';
import { useProfile } from '@/contexts/ProfileContext';
import { useAuth } from '@/contexts/AuthContext';
import CalculatorAmountInput from '@/components/common/CalculatorAmountInput';

export default function JournalEntryDialog({ entryId, open, onClose }) {
  const { currentProfile } = useProfile();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const fileInputRef = useRef(null);
  const [isEditMode, setIsEditMode] = useState(false);
  const [editedDescription, setEditedDescription] = useState('');
  const [editedMemo, setEditedMemo] = useState('');
  const [editedLines, setEditedLines] = useState([]);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [uploadingFile, setUploadingFile] = useState(false);

  const { data: entry, isLoading } = useQuery({
    queryKey: ['journal-entry', entryId],
    queryFn: () => getJournalEntryWithLines(entryId),
    enabled: open && !!entryId
  });

  const { data: attachments = [], isLoading: attachmentsLoading } = useQuery({
    queryKey: ['journal-entry-attachments', entryId],
    queryFn: () => getJournalEntryAttachments(entryId),
    enabled: open && !!entryId
  });

  const updateMutation = useMutation({
    mutationFn: updateJournalEntryWithLines,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['journal-entry', entryId] });
      queryClient.invalidateQueries({ queryKey: ['account-journal-lines'] });
      toast.success('Journal entry updated successfully');
      setIsEditMode(false);
      setHasUnsavedChanges(false);
    },
    onError: (error) => {
      toast.error(error.message || 'Failed to update journal entry');
    }
  });

  useEffect(() => {
    if (entry && !isEditMode) {
      setEditedDescription(entry.description || '');
      setEditedMemo(entry.memo || '');
      setEditedLines(entry.lines || []);
      setHasUnsavedChanges(false);
    }
  }, [entry, isEditMode]);

  if (!open) return null;

  if (isLoading) {
    return (
      <Dialog open={open} onOpenChange={onClose}>
        <DialogContent className="max-w-3xl">
          <div className="p-8 text-center">Loading journal entry...</div>
        </DialogContent>
      </Dialog>
    );
  }

  if (!entry) {
    return (
      <Dialog open={open} onOpenChange={onClose}>
        <DialogContent className="max-w-3xl">
          <div className="p-8 text-center text-muted-foreground">
            Journal entry not found
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  const calculateTotals = (lines) => {
    const totalDebits = lines.reduce((sum, line) => sum + (parseFloat(line.debit_amount) || 0), 0);
    const totalCredits = lines.reduce((sum, line) => sum + (parseFloat(line.credit_amount) || 0), 0);
    return { totalDebits, totalCredits };
  };

  const { totalDebits, totalCredits } = isEditMode
    ? calculateTotals(editedLines)
    : { totalDebits: entry.total_debits, totalCredits: entry.total_credits };

  const isBalanced = Math.abs(totalDebits - totalCredits) < 0.01;
  const isLocked = entry.status === 'locked';
  const canEdit = !isLocked && (entry.source === 'manual' || entry.source === 'opening_balance');

  const handleEditClick = () => {
    if (isLocked) {
      toast.error('Cannot edit locked journal entry');
      return;
    }
    setEditedDescription(entry.description || '');
    setEditedMemo(entry.memo || '');
    setEditedLines(JSON.parse(JSON.stringify(entry.lines || [])));
    setIsEditMode(true);
    setHasUnsavedChanges(false);
  };

  const handleCancelEdit = () => {
    if (hasUnsavedChanges) {
      if (!window.confirm('You have unsaved changes. Are you sure you want to cancel?')) {
        return;
      }
    }
    setIsEditMode(false);
    setHasUnsavedChanges(false);
  };

  const handleSave = async () => {
    if (!isBalanced) {
      toast.error('Cannot save: journal entry must be balanced');
      return;
    }

    const lines = editedLines.map(line => ({
      id: line.id,
      debit_amount: parseFloat(line.debit_amount) || 0,
      credit_amount: parseFloat(line.credit_amount) || 0,
      description: line.description || null
    }));

    await updateMutation.mutateAsync({
      entryId: entry.id,
      profileId: currentProfile.id,
      description: editedDescription,
      memo: editedMemo,
      lines
    });
  };

  const handleFileSelect = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (file.size > 10 * 1024 * 1024) {
      toast.error('File size must be less than 10MB');
      return;
    }

    setUploadingFile(true);
    try {
      await uploadJournalEntryAttachment({
        journalEntryId: entry.id,
        profileId: currentProfile.id,
        file
      });
      queryClient.invalidateQueries({ queryKey: ['journal-entry-attachments', entry.id] });
      toast.success('File uploaded successfully');
    } catch (error) {
      toast.error(error.message || 'Failed to upload file');
    } finally {
      setUploadingFile(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const handleDeleteAttachment = async (attachment) => {
    if (!window.confirm(`Delete ${attachment.file_name}?`)) return;

    try {
      await deleteJournalEntryAttachment(attachment.id, attachment.storage_path);
      queryClient.invalidateQueries({ queryKey: ['journal-entry-attachments', entry.id] });
      toast.success('File deleted');
    } catch (error) {
      toast.error(error.message || 'Failed to delete file');
    }
  };

  const handleDownloadAttachment = async (attachment) => {
    try {
      const url = await getAttachmentUrl(attachment.storage_path);
      if (url) {
        window.open(url, '_blank');
      }
    } catch (error) {
      toast.error('Failed to download file');
    }
  };

  const handleLineAmountChange = (lineIndex, field, value) => {
    const newLines = [...editedLines];
    const numValue = value === '' ? 0 : parseFloat(value) || 0;
    newLines[lineIndex] = {
      ...newLines[lineIndex],
      [field]: numValue
    };
    setEditedLines(newLines);
    setHasUnsavedChanges(true);
  };

  const handleLineDescriptionChange = (lineIndex, value) => {
    const newLines = [...editedLines];
    newLines[lineIndex] = {
      ...newLines[lineIndex],
      description: value
    };
    setEditedLines(newLines);
    setHasUnsavedChanges(true);
  };

  const handleDescriptionChange = (value) => {
    setEditedDescription(value);
    setHasUnsavedChanges(true);
  };

  const handleMemoChange = (value) => {
    setEditedMemo(value);
    setHasUnsavedChanges(true);
  };

  const getEntryTypeLabel = (type) => {
    const labels = {
      opening_balance: 'Opening Balance',
      adjustment: 'Adjustment',
      transfer: 'Transfer',
      reclassification: 'Reclassification',
      closing: 'Closing Entry',
      depreciation: 'Depreciation',
      accrual: 'Accrual',
      reversal: 'Reversal'
    };
    return labels[type] || type;
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'posted':
        return 'default';
      case 'draft':
        return 'secondary';
      case 'void':
        return 'destructive';
      default:
        return 'outline';
    }
  };

  const displayLines = isEditMode ? editedLines : entry.lines;
  const displayDescription = isEditMode ? editedDescription : entry.description;
  const displayMemo = isEditMode ? editedMemo : entry.memo;

  const getStatusBadge = (status) => {
    if (status === 'locked') {
      return (
        <Badge variant="destructive" className="gap-1">
          <Lock className="h-3 w-3" />
          Locked
        </Badge>
      );
    }
    return (
      <Badge variant="default" className="bg-green-600 hover:bg-green-700">
        Posted
      </Badge>
    );
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-start justify-between pr-8">
            <div className="flex items-center gap-3">
              <FileText className="h-6 w-6 text-muted-foreground" />
              <div>
                <DialogTitle className="text-2xl">
                  Journal Entry {entry.entry_number}
                </DialogTitle>
                {isEditMode && (
                  <div className="flex items-center gap-2 mt-2">
                    <Badge variant="secondary">Editing</Badge>
                  </div>
                )}
              </div>
            </div>
            <div className="flex items-center gap-2">
              <div className="text-right text-sm text-muted-foreground">
                <div className="flex items-center gap-1.5">
                  <Calendar className="h-3.5 w-3.5" />
                  {format(new Date(entry.entry_date), 'MMMM d, yyyy')}
                </div>
              </div>
              {!isEditMode && canEdit && (
                <Button
                  onClick={handleEditClick}
                  variant="outline"
                  size="sm"
                >
                  <Edit2 className="h-4 w-4 mr-2" />
                  Edit
                </Button>
              )}
            </div>
          </div>
        </DialogHeader>

        <div className="space-y-6">
          <div>
            <div className="text-sm font-medium mb-1">Description</div>
            {isEditMode ? (
              <Textarea
                value={displayDescription}
                onChange={(e) => handleDescriptionChange(e.target.value)}
                className="min-h-[60px]"
                placeholder="Enter journal entry description"
              />
            ) : (
              <div className="text-muted-foreground">{displayDescription}</div>
            )}
          </div>

          <div>
            <div className="text-sm font-medium mb-1">Memo</div>
            {isEditMode ? (
              <Textarea
                value={displayMemo || ''}
                onChange={(e) => handleMemoChange(e.target.value)}
                className="min-h-[50px]"
                placeholder="Optional memo or notes"
              />
            ) : (
              <div className="text-sm text-muted-foreground">
                {displayMemo || 'No memo'}
              </div>
            )}
          </div>

          {attachments.length > 0 && (
            <div>
              <div className="text-sm font-medium mb-2">Attachments</div>
              <div className="space-y-2">
                {attachments.map((attachment) => (
                  <div
                    key={attachment.id}
                    className="flex items-center justify-between p-2 rounded border bg-muted/30"
                  >
                    <div className="flex items-center gap-2 flex-1 min-w-0">
                      <Paperclip className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                      <span className="text-sm truncate">{attachment.file_name}</span>
                      <span className="text-xs text-muted-foreground flex-shrink-0">
                        ({(attachment.file_size / 1024).toFixed(1)} KB)
                      </span>
                    </div>
                    <div className="flex gap-1">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleDownloadAttachment(attachment)}
                      >
                        <Download className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleDeleteAttachment(attachment)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          <Separator />

          <div>
            <div className="text-sm font-medium mb-3">Journal Entry Lines</div>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-12">#</TableHead>
                  <TableHead>Account</TableHead>
                  <TableHead>Description</TableHead>
                  <TableHead className="w-24 text-center">Type</TableHead>
                  <TableHead className="text-right">Amount</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {displayLines && displayLines.map((line, index) => {
                  const Icon = line.account_icon ? getIconComponent(line.account_icon) : null;
                  const isDebit = parseFloat(line.debit_amount || 0) > 0;
                  const amount = isDebit ? line.debit_amount : line.credit_amount;
                  const currentType = isEditMode ? (parseFloat(editedLines[index]?.debit_amount || 0) > 0 ? 'debit' : 'credit') : (isDebit ? 'debit' : 'credit');

                  return (
                    <TableRow key={line.id}>
                      <TableCell className="text-muted-foreground">
                        {line.line_number}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          {Icon && <Icon className="h-4 w-4" style={{ color: line.account_color }} />}
                          <div>
                            <div className="font-medium">
                              {line.account_number} - {line.account_name}
                            </div>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className="text-sm">
                        {isEditMode ? (
                          <Input
                            value={line.description || ''}
                            onChange={(e) => handleLineDescriptionChange(index, e.target.value)}
                            placeholder="Line description"
                            className="h-8 text-sm"
                          />
                        ) : (
                          <span className="text-muted-foreground">{line.description || '—'}</span>
                        )}
                      </TableCell>
                      <TableCell className="text-center">
                        {isEditMode ? (
                          <div className="flex gap-1 justify-center">
                            <Button
                              size="sm"
                              variant={currentType === 'debit' ? 'default' : 'outline'}
                              className="h-7 px-2 text-xs"
                              onClick={() => {
                                const currentAmount = parseFloat(line.credit_amount || line.debit_amount || 0);
                                handleLineAmountChange(index, 'debit_amount', currentAmount.toString());
                                handleLineAmountChange(index, 'credit_amount', '0');
                              }}
                            >
                              DR
                            </Button>
                            <Button
                              size="sm"
                              variant={currentType === 'credit' ? 'default' : 'outline'}
                              className="h-7 px-2 text-xs"
                              onClick={() => {
                                const currentAmount = parseFloat(line.debit_amount || line.credit_amount || 0);
                                handleLineAmountChange(index, 'credit_amount', currentAmount.toString());
                                handleLineAmountChange(index, 'debit_amount', '0');
                              }}
                            >
                              CR
                            </Button>
                          </div>
                        ) : (
                          <Badge variant={isDebit ? 'default' : 'secondary'} className="text-xs">
                            {isDebit ? 'DR' : 'CR'}
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        {isEditMode ? (
                          <CalculatorAmountInput
                            value={parseFloat(amount) || 0}
                            onChange={(value) => {
                              if (currentType === 'debit') {
                                handleLineAmountChange(index, 'debit_amount', value.toString());
                                handleLineAmountChange(index, 'credit_amount', '0');
                              } else {
                                handleLineAmountChange(index, 'credit_amount', value.toString());
                                handleLineAmountChange(index, 'debit_amount', '0');
                              }
                            }}
                            className="h-8 text-right font-mono"
                            placeholder="0.00"
                          />
                        ) : (
                          <span className="font-mono">
                            {amount ? formatCurrency(amount) : ''}
                          </span>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })}
                <TableRow className="font-bold border-t-2">
                  <TableCell colSpan={4} className="text-right">
                    Total Debits / Credits
                  </TableCell>
                  <TableCell className="text-right font-mono">
                    {formatCurrency(totalDebits)} / {formatCurrency(totalCredits)}
                  </TableCell>
                </TableRow>
                {isEditMode && (
                  <TableRow className="bg-muted/30">
                    <TableCell colSpan={4} className="text-right text-sm">
                      Difference
                    </TableCell>
                    <TableCell className="text-right font-mono">
                      <span className={isBalanced ? 'text-green-600' : 'text-destructive'}>
                        {formatCurrency(Math.abs(totalDebits - totalCredits))}
                      </span>
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>

          {isEditMode ? (
            <div className="flex items-center justify-between gap-4">
              <div className="flex items-center gap-2">
                {!isBalanced && (
                  <>
                    <AlertCircle className="h-5 w-5 text-destructive" />
                    <span className="font-medium text-destructive text-sm">
                      Out of balance by {formatCurrency(Math.abs(totalDebits - totalCredits))}
                    </span>
                  </>
                )}
              </div>
              <div className="flex gap-2">
                <Button
                  onClick={handleCancelEdit}
                  variant="outline"
                  disabled={updateMutation.isPending}
                >
                  <X className="h-4 w-4 mr-2" />
                  Cancel
                </Button>
                <Button
                  onClick={handleSave}
                  disabled={!isBalanced || updateMutation.isPending}
                >
                  <Save className="h-4 w-4 mr-2" />
                  {updateMutation.isPending ? 'Saving...' : 'Save Changes'}
                </Button>
              </div>
            </div>
          ) : (
            <div className="flex items-center justify-between p-3 rounded-lg bg-muted/30">
              <div className="flex items-center gap-3">
                <div className="text-sm text-muted-foreground">
                  Created {format(new Date(entry.created_at), 'MMM d, yyyy')}
                  {entry.user_id && user && (
                    <> by {user.email?.split('@')[0] || 'User'}</>
                  )}
                </div>
                {getStatusBadge(entry.status)}
              </div>
              <div className="flex items-center gap-3">
                {entry.edited_at && (
                  <div className="text-sm text-muted-foreground">
                    Last edited {format(new Date(entry.edited_at), 'MMM d, yyyy')}
                  </div>
                )}
                {!isLocked && (
                  <>
                    <input
                      ref={fileInputRef}
                      type="file"
                      onChange={handleFileSelect}
                      className="hidden"
                      accept=".pdf,.jpg,.jpeg,.png,.gif,.doc,.docx,.xls,.xlsx"
                    />
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => fileInputRef.current?.click()}
                      disabled={uploadingFile}
                    >
                      <Upload className="h-4 w-4 mr-2" />
                      {uploadingFile ? 'Uploading...' : 'Add Attachment'}
                    </Button>
                  </>
                )}
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
