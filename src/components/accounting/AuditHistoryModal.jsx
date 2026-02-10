import React from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { FileText, Clock } from 'lucide-react';
import { format } from 'date-fns';
import { formatCurrency } from '@/components/utils/formatters';
import { getJournalEntryEditHistory } from '@/api/journalEntries';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';

export default function AuditHistoryModal({ open, onClose, journalEntryId, entryNumber }) {
  const { data: editHistory = [], isLoading } = useQuery({
    queryKey: ['journalEntryEditHistory', journalEntryId],
    queryFn: () => getJournalEntryEditHistory(journalEntryId),
    enabled: open && !!journalEntryId,
  });

  return (
    <Dialog open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
      <DialogContent className="max-w-6xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Edit History for Journal Entry {entryNumber}
          </DialogTitle>
          <DialogDescription>
            Complete history of all edits made to this journal entry.
          </DialogDescription>
        </DialogHeader>

        {isLoading ? (
          <div className="py-8 text-center text-muted-foreground">
            Loading edit history...
          </div>
        ) : editHistory.length === 0 ? (
          <div className="py-8 text-center text-muted-foreground">
            No edits have been made to this journal entry.
          </div>
        ) : (
          <div className="space-y-4">
            {editHistory.map((edit, index) => {
              const oldState = edit.metadata?.old_state;
              const newState = edit.metadata?.new_state;
              const editReason = edit.metadata?.edit_reason;

              return (
                <Accordion key={edit.id} type="single" collapsible>
                  <AccordionItem value="edit" className="border rounded-lg px-4">
                    <AccordionTrigger className="hover:no-underline">
                      <div className="flex items-center justify-between w-full pr-4">
                        <div className="flex items-center gap-3">
                          <Clock className="h-4 w-4 text-muted-foreground" />
                          <div className="text-left">
                            <div className="font-medium">
                              {format(new Date(edit.created_at), 'MMM d, yyyy h:mm a')}
                            </div>
                            <div className="text-sm text-muted-foreground">
                              {editReason || edit.description}
                            </div>
                          </div>
                        </div>
                        <Badge variant={index === 0 ? "default" : "secondary"}>
                          {index === 0 ? "Latest Edit" : `Edit ${editHistory.length - index}`}
                        </Badge>
                      </div>
                    </AccordionTrigger>
                    <AccordionContent>
                      <div className="space-y-4 pt-4">
                        {oldState && newState && (
                          <div className="grid grid-cols-2 gap-4">
                            <div>
                              <h4 className="font-medium mb-2 text-sm text-muted-foreground">Before</h4>
                              <div className="text-sm space-y-2">
                                <div>
                                  <span className="font-medium">Description: </span>
                                  {oldState.description}
                                </div>
                                <div className="rounded-md border">
                                  <Table>
                                    <TableHeader>
                                      <TableRow>
                                        <TableHead className="text-xs">Account</TableHead>
                                        <TableHead className="text-xs text-right">Debit</TableHead>
                                        <TableHead className="text-xs text-right">Credit</TableHead>
                                      </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                      {oldState.lines?.map((line) => (
                                        <TableRow key={line.line_id}>
                                          <TableCell className="text-xs">
                                            <div>{line.account_name}</div>
                                            <div className="text-muted-foreground">{line.account_number}</div>
                                          </TableCell>
                                          <TableCell className="text-xs text-right">
                                            {line.debit_amount ? formatCurrency(line.debit_amount) : ''}
                                          </TableCell>
                                          <TableCell className="text-xs text-right">
                                            {line.credit_amount ? formatCurrency(line.credit_amount) : ''}
                                          </TableCell>
                                        </TableRow>
                                      ))}
                                    </TableBody>
                                  </Table>
                                </div>
                              </div>
                            </div>
                            <div>
                              <h4 className="font-medium mb-2 text-sm text-muted-foreground">After</h4>
                              <div className="text-sm space-y-2">
                                <div>
                                  <span className="font-medium">Description: </span>
                                  {newState.description}
                                </div>
                                <div className="rounded-md border">
                                  <Table>
                                    <TableHeader>
                                      <TableRow>
                                        <TableHead className="text-xs">Account</TableHead>
                                        <TableHead className="text-xs text-right">Debit</TableHead>
                                        <TableHead className="text-xs text-right">Credit</TableHead>
                                      </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                      {newState.lines?.map((line) => (
                                        <TableRow key={line.line_id}>
                                          <TableCell className="text-xs">
                                            <div>{line.account_name}</div>
                                            <div className="text-muted-foreground">{line.account_number}</div>
                                          </TableCell>
                                          <TableCell className="text-xs text-right">
                                            {line.debit_amount ? formatCurrency(line.debit_amount) : ''}
                                          </TableCell>
                                          <TableCell className="text-xs text-right">
                                            {line.credit_amount ? formatCurrency(line.credit_amount) : ''}
                                          </TableCell>
                                        </TableRow>
                                      ))}
                                    </TableBody>
                                  </Table>
                                </div>
                              </div>
                            </div>
                          </div>
                        )}
                      </div>
                    </AccordionContent>
                  </AccordionItem>
                </Accordion>
              );
            })}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
