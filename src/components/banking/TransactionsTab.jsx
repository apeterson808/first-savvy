import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ClickThroughSelect, ClickThroughSelectItem, ClickThroughSelectSeparator } from '@/components/ui/ClickThroughSelect';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetFooter,
} from "@/components/ui/sheet";
import {
  ClickThroughDropdownMenu,
  ClickThroughDropdownMenuContent,
  ClickThroughDropdownMenuItem,
  ClickThroughDropdownMenuTrigger,
} from "@/components/ui/ClickThroughDropdownMenu";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Plus, Search, ChevronDown, SlidersHorizontal, Printer, Download, Settings, Loader2, ArrowRightLeft, Info } from 'lucide-react';
import { subDays, subMonths, startOfMonth, endOfMonth, startOfQuarter, endOfQuarter, startOfYear, endOfYear, isWithinInterval, parseISO, format } from 'date-fns';
import TransactionFilterPanel from './TransactionFilterPanel';
import CategorySuggestion, { suggestCategory } from './CategorySuggestion';
import AddFinancialAccountSheet from './AddFinancialAccountSheet';
import { validateAmount, sanitizeForLLM, validateDate } from '../utils/validation';
import { withRetry, showErrorToast, logError } from '../utils/errorHandler';
import { formatTransactionDescription } from '../utils/formatters';
import CategoryDropdown from '../common/CategoryDropdown';
import AccountDropdown from '../common/AccountDropdown';
import ContactDropdown from '../common/ContactDropdown';
import TransferMatchDialog from './TransferMatchDialog';
import { getAccountDisplayName } from '../utils/constants';
import { toast } from 'sonner';
export default function TransactionsTab({ initialFilters, onFiltersApplied }) {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingTransaction, setEditingTransaction] = useState(null);
  const [transferDialogOpen, setTransferDialogOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState(() => {
    return (initialFilters?.date || initialFilters?.category) ? 'posted' : 'pending';
  });
  const [sortBy, setSortBy] = useState('-date');
  const [selectedTransactions, setSelectedTransactions] = useState([]);
  const [selectedAccount, setSelectedAccount] = useState(initialFilters?.account || 'all');
  const [filterPanelOpen, setFilterPanelOpen] = useState(false);
  const [addAccountSheetOpen, setAddAccountSheetOpen] = useState(false);
  const [categorySearchTerm, setCategorySearchTerm] = useState('');
  const [addContactSheetOpen, setAddContactSheetOpen] = useState(false);
  const [contactSearchTerm, setContactSearchTerm] = useState('');
  const [isAutoCategorizing, setIsAutoCategorizing] = useState(false);
  const [autoCategorizingIds, setAutoCategorizingIds] = useState(new Set());
  const [autoContactSuggestionIds, setAutoContactSuggestionIds] = useState(new Set());
  const [transferMatchDialogOpen, setTransferMatchDialogOpen] = useState(false);
  const [matchingTransfer, setMatchingTransfer] = useState(null);
  const [pairedTransfer, setPairedTransfer] = useState(null);
  const [expandedTransactionId, setExpandedTransactionId] = useState(null);
  const [manualActionOverrides, setManualActionOverrides] = useState({});
  const [selectedMatches, setSelectedMatches] = useState({});
  const [formSelectedAccountType, setFormSelectedAccountType] = useState(null);
  const [manualMatchSearch, setManualMatchSearch] = useState({});
  const [manualMatchFilters, setManualMatchFilters] = useState({});
  const [manualMatchFilterInputs, setManualMatchFilterInputs] = useState({});

  const getAccountDetails = (accountId) => {
    return accounts.find(acc => acc.id === accountId);
  };
  
  // Initialize filters from props (chart click) or URL params
  const [filters, setFilters] = useState(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const urlCategory = urlParams.get('category');
    
    if (initialFilters?.date) {
      console.log('TransactionsTab initialFilters:', initialFilters);
      return {
        datePreset: 'custom',
        dateFrom: initialFilters.date,
        dateTo: initialFilters.date,
        account: initialFilters.account || 'all',
        category: initialFilters.category || urlCategory || 'all',
        type: 'all',
        amountMin: '',
        amountMax: '',
        paymentMethod: 'all'
      };
    }
    if (initialFilters?.category) {
      // Calculate month range based on the month offset (0 = current, 1 = last month, etc.)
      const monthOffset = parseInt(initialFilters.month || '0');
      const today = new Date();
      const targetDate = new Date(today.getFullYear(), today.getMonth() - monthOffset, 1);
      const monthStart = format(startOfMonth(targetDate), 'yyyy-MM-dd');
      const monthEnd = format(endOfMonth(targetDate), 'yyyy-MM-dd');
      
      return {
        datePreset: 'custom',
        dateFrom: monthStart,
        dateTo: monthEnd,
        account: initialFilters.account || 'all',
        category: initialFilters.category,
        type: 'expense',
        amountMin: '',
        amountMax: '',
        paymentMethod: 'all'
      };
    }
    return {
      datePreset: 'all',
      dateFrom: '',
      dateTo: '',
      account: 'all',
      category: urlCategory || 'all',
      type: 'all',
      amountMin: '',
      amountMax: '',
      paymentMethod: 'all'
    };
  });

  // Clear parent's transactionFilters after initial load
  React.useEffect(() => {
    if (initialFilters?.date && onFiltersApplied) {
      // Call after a short delay to ensure filters are applied
      const timer = setTimeout(() => onFiltersApplied(), 100);
      return () => clearTimeout(timer);
    }
  }, []);
  const [columnWidths, setColumnWidths] = useState({
    account: 140,
    description: 200,
    spent: 96,
    received: 96,
    fromTo: 150,
    categorize: 150
  });
  const [resizing, setResizing] = useState(null);
  const tableContainerRef = React.useRef(null);
  const queryClient = useQueryClient();

  const { data: fullPendingTransactions = [] } = useQuery({
    queryKey: ['fullPendingTransactions'],
    queryFn: () => base44.entities.Transaction.filter({ status: 'pending' }, '-date', 10000)
  });

  const { data: fullPostedTransactions = [] } = useQuery({
    queryKey: ['fullPostedTransactions'],
    queryFn: () => base44.entities.Transaction.filter({ status: 'posted' }, '-date', 10000)
  });

  const { data: fullExcludedTransactions = [] } = useQuery({
    queryKey: ['fullExcludedTransactions'],
    queryFn: () => base44.entities.Transaction.filter({ status: 'excluded' }, '-date', 10000)
  });

  const transactions = [...fullPendingTransactions, ...fullPostedTransactions, ...fullExcludedTransactions];

  const { data: bankAccounts = [] } = useQuery({
    queryKey: ['activeBankAccounts'],
    queryFn: () => base44.entities.BankAccount.filter({ is_active: true })
  });

  const { data: creditCards = [] } = useQuery({
    queryKey: ['activeCreditCards'],
    queryFn: () => base44.entities.CreditCard.filter({ is_active: true })
  });

  // Filter out BankAccounts with account_type='credit_card' to avoid duplicates with CreditCard entities
  const filteredBankAccounts = bankAccounts.filter(a => a.account_type !== 'credit_card');
  const accounts = [...filteredBankAccounts, ...creditCards.map(cc => ({ ...cc, account_name: cc.name }))];

  // Fetch all active accounts for Match tab dropdown (bank accounts, credit cards, assets, liabilities)
  const { data: allActiveAccounts = [] } = useQuery({
    queryKey: ['allActiveAccountsForMatch'],
    queryFn: async () => {
      const [bankAccounts, creditCards, assets, liabilities] = await Promise.all([
        base44.entities.BankAccount.filter({ is_active: true }),
        base44.entities.CreditCard.filter({ is_active: true }),
        base44.entities.Asset.filter({ is_active: true }),
        base44.entities.Liability.filter({ is_active: true })
      ]);
      
      // Filter out BankAccounts with account_type='credit_card' to avoid duplicates with CreditCard entities
      const filteredBankAccounts = bankAccounts.filter(a => a.account_type !== 'credit_card');
      
      return [
        ...filteredBankAccounts.map(a => ({ ...a, entityType: 'BankAccount' })),
        ...creditCards.map(a => ({ ...a, account_name: a.name, entityType: 'CreditCard' })),
        ...assets.map(a => ({ ...a, account_name: a.name, entityType: 'Asset' })),
        ...liabilities.map(a => ({ ...a, account_name: a.name, entityType: 'Liability' }))
      ];
    }
  });



  const { data: categories = [] } = useQuery({
    queryKey: ['categories'],
    queryFn: () => base44.entities.Category.list('name')
  });

  const { data: categorizationRules = [] } = useQuery({
    queryKey: ['categorizationRules'],
    queryFn: () => base44.entities.CategorizationRule.list('-priority')
  });

  const { data: contacts = [] } = useQuery({
    queryKey: ['contacts'],
    queryFn: () => base44.entities.Contact.list('name', 1000)
  });

  const [newDescription, setNewDescription] = useState('');
  const [categorySuggestion, setCategorySuggestion] = useState(null);
  const [selectedCategory, setSelectedCategory] = useState('other');
  const [selectedType, setSelectedType] = useState('expense');

  React.useEffect(() => {
    if (newDescription.length >= 2) {
      suggestCategory(newDescription, transactions, categorizationRules, null, categories).then(suggestion => {
        setCategorySuggestion(suggestion);
      });
    } else {
      setCategorySuggestion(null);
    }
  }, [newDescription, transactions, categorizationRules, categories]);

  React.useEffect(() => {
    const generateSuggestions = async () => {
      if (!fullPendingTransactions.length || !categories.length) return;

      const transactionsNeedingSuggestions = fullPendingTransactions.filter(
        t => !t.ai_suggested_category_id && t.type !== 'transfer' && t.description
      );

      if (transactionsNeedingSuggestions.length === 0) return;

      console.log(`Generating AI suggestions for ${Math.min(5, transactionsNeedingSuggestions.length)} transactions...`);

      const batchSize = 5;
      for (let i = 0; i < Math.min(batchSize, transactionsNeedingSuggestions.length); i++) {
        const transaction = transactionsNeedingSuggestions[i];

        try {
          const suggestion = await suggestCategory(
            transaction.description,
            fullPostedTransactions,
            categorizationRules,
            transaction.amount,
            categories
          );

          if (suggestion && suggestion.category) {
            const matchingCategory = categories.find(c =>
              c.name.toLowerCase() === suggestion.category.toLowerCase() &&
              c.type === suggestion.type
            );

            if (matchingCategory) {
              console.log(`Suggested ${suggestion.category} for "${transaction.description}"`);
              await base44.entities.Transaction.update(transaction.id, {
                ai_suggested_category_id: matchingCategory.id
              });
              queryClient.invalidateQueries({ queryKey: ['fullPendingTransactions'] });
            }
          }
        } catch (err) {
          console.error('Failed to generate suggestion for transaction:', transaction.id, err);
        }
      }
    };

    generateSuggestions();
  }, [fullPendingTransactions.length, categories.length, fullPostedTransactions.length, categorizationRules.length]);

  // Auto-apply AI-suggested contacts
  React.useEffect(() => {
    const applyContactSuggestions = async () => {
      if (!fullPendingTransactions.length || !contacts.length) return;

      const transactionsNeedingContactApplication = fullPendingTransactions.filter(
        t => t.ai_suggested_contact_id && !t.contact_id
      );

      if (transactionsNeedingContactApplication.length === 0) return;

      console.log(`Auto-applying ${transactionsNeedingContactApplication.length} AI contact suggestions...`);

      for (const transaction of transactionsNeedingContactApplication) {
        try {
          await base44.entities.Transaction.update(transaction.id, {
            contact_id: transaction.ai_suggested_contact_id
          });
        } catch (err) {
          console.error('Failed to apply contact suggestion for transaction:', transaction.id, err);
        }
      }

      queryClient.invalidateQueries({ queryKey: ['fullPendingTransactions'] });
    };

    applyContactSuggestions();
  }, [fullPendingTransactions.length, contacts.length]);

  const createMutation = useMutation({
    mutationFn: (data) => withRetry(() => base44.entities.Transaction.create(data), { maxRetries: 2 }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['fullPendingTransactions'] });
      queryClient.invalidateQueries({ queryKey: ['fullPostedTransactions'] });
      queryClient.invalidateQueries({ queryKey: ['fullExcludedTransactions'] });
      queryClient.invalidateQueries({ queryKey: ['accounts'] });
      setDialogOpen(false);
      setEditingTransaction(null);
      setNewDescription('');
      setCategorySuggestion(null);
      setSelectedCategory('other');
      setSelectedType('expense');
    },
    onError: (error) => {
      logError(error, { action: 'createTransaction' });
      showErrorToast(error);
    }
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => withRetry(() => base44.entities.Transaction.update(id, data), { maxRetries: 2 }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['fullPendingTransactions'] });
      queryClient.invalidateQueries({ queryKey: ['fullPostedTransactions'] });
      queryClient.invalidateQueries({ queryKey: ['fullExcludedTransactions'] });
      queryClient.invalidateQueries({ queryKey: ['accounts'] });
      setDialogOpen(false);
      setEditingTransaction(null);
    },
    onError: (error) => {
      logError(error, { action: 'updateTransaction' });
      showErrorToast(error);
    }
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => withRetry(() => base44.entities.Transaction.delete(id), { maxRetries: 2 }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['fullPendingTransactions'] });
      queryClient.invalidateQueries({ queryKey: ['fullPostedTransactions'] });
      queryClient.invalidateQueries({ queryKey: ['fullExcludedTransactions'] });
      queryClient.invalidateQueries({ queryKey: ['accounts'] });
    },
    onError: (error) => {
      logError(error, { action: 'deleteTransaction' });
      showErrorToast(error);
    }
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    const formData = new FormData(e.target);
    
    // Validate amount
    const amountValidation = validateAmount(formData.get('amount'));
    if (!amountValidation.valid) {
      alert(amountValidation.error);
      return;
    }

    // Validate date
    const dateValidation = validateDate(formData.get('date'));
    if (!dateValidation.valid) {
      alert(dateValidation.error);
      return;
    }

    const bankAccountId = formData.get('bank_account_id');
    const accountDetails = getAccountDetails(bankAccountId);
    let paymentMethod = formData.get('payment_method');

    if (accountDetails?.account_type === 'credit_card') {
      paymentMethod = 'credit_card';
    }

    const data = {
              date: formData.get('date'),
              description: formData.get('description'),
              category_id: formData.get('category_id'),
              type: formData.get('type'),
              amount: amountValidation.value,
              bank_account_id: bankAccountId,
              payment_method: paymentMethod,
              status: 'posted',
              notes: formData.get('notes'),
            };

            // Store original description when first editing
            if (editingTransaction && !editingTransaction.original_description) {
              data.original_description = editingTransaction.description;
            }

    if (editingTransaction) {
      updateMutation.mutate({ id: editingTransaction.id, data });
    } else {
      createMutation.mutate(data);
    }
  };

  const getDateRange = () => {
    const today = new Date();
    switch (filters.datePreset) {
      case 'today':
        return { from: today, to: today };
      case 'yesterday':
        const yesterday = subDays(today, 1);
        return { from: yesterday, to: yesterday };
      case 'last7':
        return { from: subDays(today, 7), to: today };
      case 'last30':
        return { from: subDays(today, 30), to: today };
      case 'thisMonth':
        return { from: startOfMonth(today), to: endOfMonth(today) };
      case 'lastMonth':
        const lastMonth = subMonths(today, 1);
        return { from: startOfMonth(lastMonth), to: endOfMonth(lastMonth) };
      case 'thisQuarter':
        return { from: startOfQuarter(today), to: endOfQuarter(today) };
      case 'thisYear':
        return { from: startOfYear(today), to: endOfYear(today) };
      case 'custom':
        return { 
          from: filters.dateFrom || null, 
          to: filters.dateTo || null 
        };
      default:
        return { from: null, to: null };
    }
  };

  const getActiveFilterCount = () => {
    let count = 0;
    if (filters.datePreset !== 'all') count++;
    if (filters.account !== 'all') count++;
    if (filters.category !== 'all') count++;
    if (filters.type !== 'all') count++;
    if (filters.amountMin || filters.amountMax) count++;
    if (filters.paymentMethod !== 'all') count++;
    return count;
  };

  // Get all accounts (including inactive) to check if transaction belongs to an active account
  const activeAccountIds = accounts.map(a => a.id);

  const filteredTransactions = (statusFilter === 'pending' ? fullPendingTransactions :
                                  statusFilter === 'posted' ? fullPostedTransactions :
                                  fullExcludedTransactions)
  .filter(t => {
    // Only show transactions from active accounts
    const isFromActiveAccount = activeAccountIds.includes(t.bank_account_id);
    if (!isFromActiveAccount) return false;

    const category = categories.find(c => c.id === t.category_id);
    const categoryName = category?.name || '';
    const matchesSearch = searchTerm === '' || 
      t.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
      categoryName.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesAccount = (selectedAccount === 'all' && filters.account === 'all') || 
      t.bank_account_id === selectedAccount || 
      t.bank_account_id === filters.account;
    
    // Date filter
    const dateRange = getDateRange();
    let matchesDate = true;
    if (!t.date) {
      matchesDate = false;
    } else if (dateRange.from && dateRange.to) {
      // For custom dates, compare strings directly; for presets, format Date objects
      const fromStr = typeof dateRange.from === 'string' ? dateRange.from : format(dateRange.from, 'yyyy-MM-dd');
      const toStr = typeof dateRange.to === 'string' ? dateRange.to : format(dateRange.to, 'yyyy-MM-dd');
      // Extract just the date portion (yyyy-MM-dd) from transaction date for comparison
      const tDateStr = t.date.substring(0, 10);
      matchesDate = tDateStr >= fromStr && tDateStr <= toStr;
    } else if (dateRange.from) {
      const fromStr = typeof dateRange.from === 'string' ? dateRange.from : format(dateRange.from, 'yyyy-MM-dd');
      const tDateStr = t.date.substring(0, 10);
      matchesDate = tDateStr >= fromStr;
    } else if (dateRange.to) {
      const toStr = typeof dateRange.to === 'string' ? dateRange.to : format(dateRange.to, 'yyyy-MM-dd');
      const tDateStr = t.date.substring(0, 10);
      matchesDate = tDateStr <= toStr;
    }
    
    // Category filter
    const matchesCategory = filters.category === 'all' || t.category_id === filters.category;
    
    // Type filter - handle 'expense_income' for showing both but not transfers
    let matchesType = true;
    if (filters.type === 'all') {
      matchesType = true;
    } else if (filters.type === 'expense_income') {
      matchesType = t.type === 'expense' || t.type === 'income';
    } else {
      matchesType = t.type === filters.type;
    }
    
    // Amount filter
    let matchesAmount = true;
    if (filters.amountMin) matchesAmount = t.amount >= parseFloat(filters.amountMin);
    if (filters.amountMax && matchesAmount) matchesAmount = t.amount <= parseFloat(filters.amountMax);
    
    // Payment method filter
    const matchesPaymentMethod = filters.paymentMethod === 'all' || t.payment_method === filters.paymentMethod;
    
    return matchesSearch && matchesAccount && matchesDate && matchesCategory && matchesType && matchesAmount && matchesPaymentMethod;
  });

  const toggleSelectAll = () => {
    if (selectedTransactions.length === filteredTransactions.length) {
      setSelectedTransactions([]);
    } else {
      setSelectedTransactions(filteredTransactions.map(t => t.id));
    }
  };

  const toggleSelect = (id) => {
    if (selectedTransactions.includes(id)) {
      setSelectedTransactions(selectedTransactions.filter(tid => tid !== id));
    } else {
      setSelectedTransactions([...selectedTransactions, id]);
    }
  };

  // Group categories by type for display
  const expenseCategories = categories.filter(c => c.type === 'expense');
  const incomeCategories = categories.filter(c => c.type === 'income');

  const getCategoryById = (id) => categories.find(c => c.id === id);

  const autoCategorizeTransactions = async () => {
    // Get uncategorized pending transactions
    const uncategorized = filteredTransactions.filter(t => 
      !t.category_id && (t.status === 'pending' || !t.status)
    );
    
    if (uncategorized.length === 0) {
      alert('No uncategorized pending transactions to categorize.');
      return;
    }

    setIsAutoCategorizing(true);
    
    try {
      // Build category list for LLM
      const categoryList = categories.map(c => ({
        id: c.id,
        name: c.name,
        type: c.type
      }));

      // Process in batches of 10
      const batchSize = 10;
      for (let i = 0; i < uncategorized.length; i += batchSize) {
        const batch = uncategorized.slice(i, i + batchSize);
        
        const transactionDescriptions = batch.map(t => ({
          id: t.id,
          description: sanitizeForLLM(t.description),
          amount: t.amount
        }));

        const result = await base44.integrations.Core.InvokeLLM({
          prompt: `You are a financial transaction categorizer. Given these transactions and available categories, assign the most appropriate category to each transaction.

Available Categories:
${categoryList.map(c => `- ${sanitizeForLLM(c.name)} (${c.type}) [ID: ${c.id}]`).join('\n')}

Transactions to categorize:
${transactionDescriptions.map(t => `- ID: ${t.id}, Description: "${t.description}", Amount: $${t.amount}`).join('\n')}

For each transaction, return the category_id that best matches. Consider:
- The description text and what it implies about the transaction
- Whether it's likely income or expense based on context
- Common spending patterns (e.g., "Starbucks" = food/dining, "Payroll" = salary)`,
          response_json_schema: {
            type: "object",
            properties: {
              categorizations: {
                type: "array",
                items: {
                  type: "object",
                  properties: {
                    transaction_id: { type: "string" },
                    category_id: { type: "string" },
                    type: { type: "string", enum: ["income", "expense"] }
                  },
                  required: ["transaction_id", "category_id", "type"]
                }
              }
            },
            required: ["categorizations"]
          }
        });

        // Apply categorizations
        for (const cat of result.categorizations) {
          const transaction = batch.find(t => t.id === cat.transaction_id);
          if (transaction && cat.category_id) {
            await base44.entities.Transaction.update(cat.transaction_id, {
              ...transaction,
              category_id: cat.category_id,
              type: cat.type
            });
          }
        }
      }

      queryClient.invalidateQueries({ queryKey: ['fullPendingTransactions'] });
      queryClient.invalidateQueries({ queryKey: ['fullPostedTransactions'] });
      queryClient.invalidateQueries({ queryKey: ['fullExcludedTransactions'] });
    } catch (error) {
      console.error('Auto-categorize error:', error);
      alert('Failed to auto-categorize. Please try again.');
    } finally {
      setIsAutoCategorizing(false);
    }
  };

  // Auto-categorize uncategorized transactions on load - batched to avoid rate limits
  React.useEffect(() => {
    // Find transactions that need AI suggestions (ones without existing ai_suggested_category_id)
    const needsSuggestion = filteredTransactions.filter(t => 
      !t.ai_suggested_category_id && 
      !autoCategorizingIds.has(t.id)
    );
    
    if (needsSuggestion.length === 0 || categories.length === 0) return;
    
    // Limit to first 3 transactions and add delay to avoid rate limits
    const batch = needsSuggestion.slice(0, 3);
    
    // Mark as being processed
    setAutoCategorizingIds(prev => {
      const next = new Set(prev);
      batch.forEach(t => next.add(t.id));
      return next;
    });
    
    // Add 2 second delay before processing to avoid rate limits
    const timer = setTimeout(() => {
      processBatch();
    }, 2000);
    
    const processBatch = async () => {
      try {
        for (const transaction of batch) {
          try {
            const suggestion = await suggestCategory(
              transaction.description,
              transactions,
              categorizationRules,
              transaction.amount
            );

            if (suggestion && suggestion.category) {
              const matchingCategory = categories.find(c =>
                c.name.toLowerCase() === suggestion.category.toLowerCase() &&
                c.type === suggestion.type
              );

              if (matchingCategory) {
                updateMutation.mutate({
                  id: transaction.id,
                  data: {
                    ai_suggested_category_id: matchingCategory.id
                  }
                });
              }
            }
          } catch (err) {
            console.error(`Failed to categorize transaction ${transaction.id}:`, err);
          }
        }
      } catch (err) {
        console.error('Auto-categorize batch error:', err);
      }
    };

    return () => clearTimeout(timer);
    }, [filteredTransactions.length, categories.length]);

    // Auto-suggest contacts for transactions without contact_id
    React.useEffect(() => {
    const needsContactSuggestion = filteredTransactions.filter(t => 
      !t.ai_suggested_contact_id && 
      !autoContactSuggestionIds.has(t.id)
    );

    if (needsContactSuggestion.length === 0 || contacts.length === 0) return;

    // Limit to first 3 transactions and add delay to avoid rate limits
    const batch = needsContactSuggestion.slice(0, 3);

    // Mark as being processed
    setAutoContactSuggestionIds(prev => {
      const next = new Set(prev);
      batch.forEach(t => next.add(t.id));
      return next;
    });

    // Add 2 second delay before processing to avoid rate limits
    const timer = setTimeout(() => {
      processBatch();
    }, 2000);

    const processBatch = async () => {
      try {
        const activeContacts = contacts.filter(c => c.status === 'active');
        if (activeContacts.length === 0) return;

        const contactList = activeContacts.map(c => ({
          id: c.id,
          name: c.name
        }));

        for (const transaction of batch) {
          try {
            if (!transaction.description || transaction.type === 'transfer') continue;

            const result = await base44.integrations.Core.aiSuggestContact({
              description: transaction.description,
              contacts: contactList
            });

            if (result.contactId) {
              updateMutation.mutate({
                id: transaction.id,
                data: {
                  ai_suggested_contact_id: result.contactId
                }
              });
            }
          } catch (err) {
            console.error(`Failed to suggest contact for transaction ${transaction.id}:`, err);
          }
        }
      } catch (err) {
        console.error('Auto-suggest contact batch error:', err);
      }
    };

    return () => clearTimeout(timer);
    }, [filteredTransactions.length, contacts.length]);

  const pendingCount = fullPendingTransactions.filter(t => {
    const isFromActiveAccount = activeAccountIds.includes(t.bank_account_id);
    const matchesAccount = selectedAccount === 'all' || t.bank_account_id === selectedAccount;
    return isFromActiveAccount && matchesAccount;
  }).length;

  const postedCount = fullPostedTransactions.filter(t => {
    const isFromActiveAccount = activeAccountIds.includes(t.bank_account_id);
    const matchesAccount = selectedAccount === 'all' || t.bank_account_id === selectedAccount;
    return isFromActiveAccount && matchesAccount;
  }).length;

  const excludedCount = fullExcludedTransactions.filter(t => {
    const isFromActiveAccount = activeAccountIds.includes(t.bank_account_id);
    const matchesAccount = selectedAccount === 'all' || t.bank_account_id === selectedAccount;
    return isFromActiveAccount && matchesAccount;
  }).length;

  // Find paired transfer transaction by transfer_pair_id
  const findPairedTransfer = (transaction) => {
    if (!transaction || transaction.type !== 'transfer' || !transaction.transfer_pair_id) return null;

    return transactions.find(t => 
      t.id !== transaction.id && 
      t.transfer_pair_id === transaction.transfer_pair_id &&
      activeAccountIds.includes(t.bank_account_id)
    );
  };

  // Find potential matches for a transaction (checks both pending and posted)
  const findPotentialMatches = (transaction) => {
    if (!transaction) return [];

    // For credit card payments - look for income transactions on credit cards
    if (transaction.type === 'credit_card_payment') {
      return transactions.filter(t => {
        if (t.id === transaction.id) return false;
        if (t.type !== 'income') return false;
        if (t.status === 'excluded') return false;
        if (!activeAccountIds.includes(t.bank_account_id)) return false;
        
        // Must be on a credit card account
        const tAccount = accounts.find(a => a.id === t.bank_account_id);
        if (!tAccount || tAccount.account_type !== 'credit_card') return false;

        // Check if amounts match (both should be positive for this comparison)
        const amountMatch = Math.abs(Math.abs(t.amount) - Math.abs(transaction.amount)) < 0.01;

        // Check if dates are close (within 7 days)
        const tDate = new Date(t.date);
        const txDate = new Date(transaction.date);
        const daysDiff = Math.abs((txDate - tDate) / (1000 * 60 * 60 * 24));
        const dateMatch = daysDiff <= 7;

        return amountMatch && dateMatch;
      });
    }

    // For transfers, look for opposite amount transfers
    if (transaction.type === 'transfer') {
      return transactions.filter(t => {
        if (t.id === transaction.id) return false;
        if (t.type !== 'transfer') return false;
        if (t.status === 'excluded') return false;
        if (!activeAccountIds.includes(t.bank_account_id)) return false;
        if (t.bank_account_id === transaction.bank_account_id) return false; // Must be different account

        // Check if amounts are opposite (one positive, one negative, same magnitude)
        const amountMatch = Math.abs(Math.abs(t.amount) - Math.abs(transaction.amount)) < 0.01 &&
                           (t.amount > 0) !== (transaction.amount > 0);

        // Check if dates are close (within 7 days)
        const tDate = new Date(t.date);
        const txDate = new Date(transaction.date);
        const daysDiff = Math.abs((txDate - tDate) / (1000 * 60 * 60 * 24));
        const dateMatch = daysDiff <= 7;

        return amountMatch && dateMatch;
      });
    }

    // For income/expense, look for opposite type transaction
    const oppositeType = transaction.type === 'income' ? 'expense' : 'income';

    const potentialMatches = transactions.filter(t => {
      if (t.id === transaction.id) return false;
      if (t.type !== oppositeType) return false;
      if (t.status === 'excluded') return false;
      if (!activeAccountIds.includes(t.bank_account_id)) return false;

      // Check if amounts are similar (within $0.01)
      const amountMatch = Math.abs(t.amount - transaction.amount) < 0.01;

      // Check if dates are close (within 7 days)
      const tDate = new Date(t.date);
      const txDate = new Date(transaction.date);
      const daysDiff = Math.abs((txDate - tDate) / (1000 * 60 * 60 * 24));
      const dateMatch = daysDiff <= 7;

      return amountMatch && dateMatch;
    });

    return potentialMatches;
  };

  // Calculate match confidence percentage
  const calculateMatchConfidence = (transaction, match) => {
    let confidence = 0;

    // Amount match (40 points for exact, scaled down for differences)
    const amountDiff = Math.abs(transaction.amount - match.amount);
    if (amountDiff < 0.01) {
      confidence += 40;
    } else {
      confidence += Math.max(0, 40 - amountDiff * 10);
    }

    // Date proximity (30 points, decreasing with distance)
    const tDate = new Date(transaction.date);
    const mDate = new Date(match.date);
    const daysDiff = Math.abs((tDate - mDate) / (1000 * 60 * 60 * 24));
    if (daysDiff === 0) {
      confidence += 30;
    } else if (daysDiff <= 1) {
      confidence += 25;
    } else if (daysDiff <= 3) {
      confidence += 15;
    } else {
      confidence += Math.max(0, 10 - daysDiff);
    }

    // Description similarity (30 points)
    const desc1 = (transaction.description || '').toLowerCase();
    const desc2 = (match.description || '').toLowerCase();
    const commonWords = desc1.split(' ').filter(word => desc2.includes(word)).length;
    confidence += Math.min(30, commonWords * 5);

    return Math.min(100, Math.round(confidence));
  };

  const handleTransferMatch = (transaction) => {
    const paired = findPairedTransfer(transaction);

    if (!paired) {
      // No pair found, just post this transaction
      updateMutation.mutate({
        id: transaction.id,
        data: { ...transaction, status: 'posted' }
      });
      return;
    }

    // If paired transaction is already posted, auto-post this one
    if (paired.status === 'posted') {
      updateMutation.mutate({
        id: transaction.id,
        data: { ...transaction, status: 'posted' }
      });
      toast.success(transaction.type === 'transfer' ? 'Transfer matched and confirmed' : 'Credit card payment matched and confirmed');
      return;
    }

    // Both pending, show match dialog
    setMatchingTransfer(transaction);
    setPairedTransfer(paired);
    setTransferMatchDialogOpen(true);
  };

  const handleConfirmTransferMatch = (toAccountId) => {
    // Post both sides of the transfer
    updateMutation.mutate({
      id: matchingTransfer.id,
      data: { ...matchingTransfer, status: 'posted' }
    });
    if (pairedTransfer) {
      updateMutation.mutate({
        id: pairedTransfer.id,
        data: { ...pairedTransfer, status: 'posted' }
      });
    }
    toast.success('Transfer matched and confirmed');
  };

  const handleMatchClick = (transaction) => {
    const selectedMatch = selectedMatches[transaction.id];

    if (selectedMatch) {
      // User selected a match, confirm it
      const matchedTransaction = transactions.find(t => t.id === selectedMatch);

      // Ensure both transactions have the same transfer_pair_id
      const pairId = transaction.transfer_pair_id || matchedTransaction?.transfer_pair_id || `transfer_${Date.now()}`;

      // Always post the current transaction with transfer_pair_id
      updateMutation.mutate({
        id: transaction.id,
        data: { ...transaction, status: 'posted', transfer_pair_id: pairId }
      });

      // Only post matched transaction if it's not already posted, with transfer_pair_id
      if (matchedTransaction && matchedTransaction.status !== 'posted') {
        updateMutation.mutate({
          id: selectedMatch,
          data: { ...matchedTransaction, status: 'posted', transfer_pair_id: pairId }
        });
      }

      // Clear selection
      setSelectedMatches(prev => {
        const next = { ...prev };
        delete next[transaction.id];
        return next;
      });
      setExpandedTransactionId(null);
    } else {
      // No match selected, just post the transaction
      const matches = findPotentialMatches(transaction);
      if (matches.length === 0) {
        updateMutation.mutate({
          id: transaction.id,
          data: { ...transaction, status: 'posted' }
        });
      }
    }
  };

  const startResize = (column, e) => {
    e.preventDefault();
    setResizing({ column, startX: e.clientX, startWidth: columnWidths[column] });
  };

  React.useEffect(() => {
    if (!resizing) return;

    const handleMouseMove = (e) => {
      const diff = e.clientX - resizing.startX;
      const newWidth = Math.max(50, resizing.startWidth + diff);
      setColumnWidths(prev => ({ ...prev, [resizing.column]: newWidth }));
    };

    const handleMouseUp = () => {
      setResizing(null);
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [resizing]);

  React.useEffect(() => {
    if (tableContainerRef.current) {
      tableContainerRef.current.scrollTop = 0;
    }
  }, [selectedAccount]);

  // Set match mode when expanded if there are potential matches or existing relationship
  React.useEffect(() => {
    if (expandedTransactionId) {
      const transaction = transactions.find(t => t.id === expandedTransactionId);
      if (transaction) {
        // Only set defaults if user hasn't manually overridden for this transaction
        const hasManualOverride = manualActionOverrides[expandedTransactionId];
        
        if (!hasManualOverride) {
          // Check for existing database relationship first
          if (transaction.transfer_pair_id) {
            const paired = transactions.find(t => 
              t.id !== transaction.id && 
              t.transfer_pair_id === transaction.transfer_pair_id &&
              activeAccountIds.includes(t.bank_account_id)
            );
            
            if (paired) {
              setManualActionOverrides(prev => ({
                ...prev,
                [expandedTransactionId]: 'match'
              }));
              setSelectedMatches(prev => ({
                ...prev,
                [expandedTransactionId]: paired.id
              }));
            }
          } else {
            // No existing relationship - check for potential matches
            const potentialMatches = findPotentialMatches(transaction);
            if (potentialMatches.length > 0) {
              // Set to match mode to show the suggestions
              setManualActionOverrides(prev => ({
                ...prev,
                [expandedTransactionId]: 'match'
              }));
            }
          }
        }
      }
    }
  }, [expandedTransactionId]);

  return (
      <>
        <Card className="shadow-sm border-slate-200">
        <CardContent className="p-0">
          {/* Tabs & Top Actions */}
          <div className="border-b border-slate-200 px-4 pt-4">
            <div className="flex items-center justify-between mb-3">
              <AccountDropdown
                value={selectedAccount}
                onValueChange={setSelectedAccount}
                showPendingCounts={true}
                transactions={fullPendingTransactions}
                accounts={accounts}
              />
              
              <div className="flex items-center gap-2">
                <Button
                  size="sm"
                  onClick={() => setDialogOpen(true)}
                  className="bg-blue-600 hover:bg-blue-700 h-9"
                >
                  <Plus className="w-4 h-4 mr-2" />
                  Add Transaction
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setTransferDialogOpen(true)}
                  className="h-9"
                  title="Move money between your accounts (e.g., Checking to Savings). No impact on income/expenses."
                >
                  <ArrowRightLeft className="w-4 h-4 mr-2" />
                  Transfer
                </Button>
              </div>
            </div>

            {/* Search & Filters */}
            <div className="flex items-center gap-2 pb-4">
              <Tabs value={statusFilter} onValueChange={setStatusFilter}>
                <TabsList>
                  <TabsTrigger value="pending">Pending ({pendingCount})</TabsTrigger>
                  <TabsTrigger value="posted">Posted</TabsTrigger>
                  <TabsTrigger value="excluded">Excluded</TabsTrigger>
                </TabsList>
              </Tabs>
              <div className="relative w-64">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-slate-400" />
                <Input
                  placeholder="Search"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-9 h-9"
                />
              </div>
              
              <Button 
                                    variant="outline" 
                                    size="icon" 
                                    className="h-9 w-9 relative"
                                    onClick={() => setFilterPanelOpen(true)}
                                  >
                                    <SlidersHorizontal className="w-4 h-4" />
                                    {getActiveFilterCount() > 0 && (
                                      <span className="absolute -top-1 -right-1 bg-blue-600 text-white rounded-full w-4 h-4 flex items-center justify-center text-[10px] font-semibold">
                                        {getActiveFilterCount()}
                                      </span>
                                    )}
                                  </Button>

              <div className="flex-1"></div>

              <div className="flex items-center gap-1">
                <Button variant="ghost" size="icon" className="h-8 w-8">
                  <Printer className="w-4 h-4" />
                </Button>
                <Button variant="ghost" size="icon" className="h-8 w-8">
                  <Download className="w-4 h-4" />
                </Button>
                <Button variant="ghost" size="icon" className="h-8 w-8">
                  <Settings className="w-4 h-4" />
                </Button>
              </div>
            </div>
          </div>

          {/* Table */}
          <div ref={tableContainerRef} className="max-h-[520px] overflow-auto relative">
            <table className="w-max min-w-full" style={{ tableLayout: 'auto' }}>
              <colgroup>
                <col style={{ width: 32, minWidth: 32 }} />
                <col style={{ width: 70, minWidth: 70 }} />
                {selectedAccount === 'all' && <col style={{ width: columnWidths.account, minWidth: 50 }} />}
                <col style={{ width: columnWidths.description, minWidth: 100 }} />
                <col style={{ width: 1 }} />
                                      <col style={{ width: 1 }} />
                <col style={{ width: columnWidths.fromTo, minWidth: 100 }} />
                <col style={{ width: columnWidths.categorize, minWidth: 100 }} />
                <col style={{ width: 20, minWidth: 20, maxWidth: 20 }} />
              </colgroup>
              <thead className="sticky top-0 z-30 bg-slate-100 shadow-sm">
                <tr className="bg-slate-100 h-8">
                  <th className="border-r border-slate-200 text-center w-8 min-w-8 max-w-8 bg-slate-100 font-semibold text-slate-700 py-2 px-0">
                                           <input
                                             type="checkbox"
                                             checked={selectedTransactions.length === filteredTransactions.length && filteredTransactions.length > 0}
                                             onChange={toggleSelectAll}
                                             className="rounded w-3.5 h-3.5"
                                           />
                                          </th>
                  <th className="font-semibold text-slate-700 border-r border-slate-200 bg-slate-100 text-left pl-2 pr-1 py-2">
                   Date
                  </th>
                  {selectedAccount === 'all' && (
                                           <th className="font-semibold text-slate-700 border-r border-slate-200 relative bg-slate-100 text-left px-4 pl-2 py-2" style={{ width: columnWidths.account }}>
                                             Account
                                             <div 
                                               className="absolute right-0 top-0 bottom-0 w-1 cursor-col-resize hover:bg-blue-400"
                                               onMouseDown={(e) => startResize('account', e)}
                                             />
                                           </th>
                                          )}
                  <th className="font-semibold text-slate-700 border-r border-slate-200 relative bg-slate-100 text-left px-4 pl-2 py-2" style={{ width: columnWidths.description }}>
                   Description
                   <div 
                     className="absolute right-0 top-0 bottom-0 w-1 cursor-col-resize hover:bg-blue-400"
                     onMouseDown={(e) => startResize('description', e)}
                   />
                  </th>
                  <th className="font-semibold text-slate-700 border-r border-slate-200 bg-slate-100 text-left pl-2 py-2 whitespace-nowrap">
                   Spent
                  </th>
                  <th className="font-semibold text-slate-700 border-r border-slate-200 bg-slate-100 text-left pl-2 py-2 whitespace-nowrap">
                   Received
                  </th>
                  <th className="font-semibold text-slate-700 border-r border-slate-200 relative bg-slate-100 text-left px-4 pl-2 py-2" style={{ width: columnWidths.fromTo }}>
                   From/To
                   <div 
                     className="absolute right-0 top-0 bottom-0 w-1 cursor-col-resize hover:bg-blue-400"
                     onMouseDown={(e) => startResize('fromTo', e)}
                   />
                  </th>
                  <th className="font-semibold text-slate-700 border-r border-slate-200 relative bg-slate-100 text-left px-4 pl-2 py-2" style={{ width: columnWidths.categorize }}>
                   Category
                   <div 
                     className="absolute right-0 top-0 bottom-0 w-1 cursor-col-resize hover:bg-blue-400"
                     onMouseDown={(e) => startResize('categorize', e)}
                   />
                  </th>
                  <th className="font-semibold text-slate-700 bg-slate-100 text-left pl-2 pr-0 py-2 whitespace-nowrap">
                   Action
                  </th>
                  </tr>
                  </thead>
                  <tbody>
                    {filteredTransactions.length === 0 ? (
                  <tr>
                    <td colSpan={selectedAccount === 'all' ? 9 : 8} className="text-center py-12 text-slate-500">
                      No transactions found
                    </td>
                  </tr>
                  ) : (
                  filteredTransactions.map((transaction, index) => {
                    const account = accounts.find(a => a.id === transaction.bank_account_id);
                    const isSelected = selectedTransactions.includes(transaction.id);
                    return (
                      <React.Fragment key={transaction.id}>
                        <tr
                          className={`${index % 2 === 0 ? 'bg-white' : 'bg-slate-50'} h-8 ${statusFilter === 'pending' ? 'cursor-pointer' : ''} ${expandedTransactionId === transaction.id ? 'bg-slate-100' : ''}`}
                          onClick={(e) => {
                            if (statusFilter !== 'pending') return;
                            const targetNode = e.target;
                            if (targetNode.closest('input') || targetNode.closest('button') || targetNode.closest('[role="combobox"]')) {
                              return;
                            }
                            setExpandedTransactionId(expandedTransactionId === transaction.id ? null : transaction.id);
                          }}
                        >
                          <td className="border-r border-slate-200 py-1 text-center w-8 min-w-8 max-w-8 px-0">
                            <input
                              type="checkbox"
                              checked={isSelected}
                              onChange={(e) => { e.stopPropagation(); toggleSelect(transaction.id); }}
                              className="rounded w-3.5 h-3.5"
                            />
                          </td>
                          <td className="text-sm border-r border-slate-200 py-1 pl-2 pr-1">
                            {transaction.date && !isNaN(new Date(transaction.date).getTime())
                              ? format(parseISO(transaction.date), 'MM/dd/yy')
                              : 'Invalid'}
                          </td>
                        {selectedAccount === 'all' && (
                                                        <td className="text-sm border-r border-slate-200 py-1 px-4 pl-2 whitespace-nowrap overflow-hidden text-ellipsis" style={{ width: columnWidths.account, minWidth: columnWidths.account, maxWidth: columnWidths.account }}>
                                                          {account ? `${getAccountDisplayName(account)}${account.account_number ? ` (${account.account_number})` : ''}` : 'N/A'}
                                                        </td>
                                                      )}
                        <td className="text-sm border-r border-slate-200 py-1 px-4 pl-2" style={{ width: columnWidths.description, minWidth: columnWidths.description, maxWidth: columnWidths.description }}>
                          {statusFilter === 'pending' ? (
                            <Input
                              defaultValue={formatTransactionDescription(transaction.description)}
                              disabled={!activeAccountIds.includes(transaction.bank_account_id)}
                              className="h-7 text-xs border-transparent bg-transparent shadow-none hover:border-slate-300 hover:bg-white focus:border-slate-300 focus:bg-white transition-colors px-1 disabled:opacity-50 disabled:cursor-not-allowed"
                              onBlur={(e) => {
                                if (e.target.value !== formatTransactionDescription(transaction.description)) {
                                  updateMutation.mutate({
                                    id: transaction.id,
                                    data: { ...transaction, description: e.target.value }
                                  });
                                }
                              }}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') {
                                  e.target.blur();
                                }
                              }}
                            />
                          ) : (
                            <span className="text-xs px-1">{formatTransactionDescription(transaction.description)}</span>
                          )}
                        </td>
                                                    <td className="text-right text-sm border-r border-slate-200 py-1 pl-1 pr-2 whitespace-nowrap">
                                                                                                                                                               {(transaction.type === 'expense' || transaction.type === 'credit_card_payment' || (transaction.type === 'transfer' && transaction.amount < 0)) && `$${Math.abs(transaction.amount).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
                                                                                                                                                             </td>
                                                                                                       <td className="text-right text-sm border-r border-slate-200 py-1 pl-1 pr-2 whitespace-nowrap">
                                                                                                                                                               {(transaction.type === 'income' || (transaction.type === 'transfer' && transaction.amount > 0)) && `$${Math.abs(transaction.amount).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}

                                                    </td>
                        <td className="border-r border-slate-200 py-1 px-4 pl-2" style={{ width: columnWidths.fromTo, minWidth: columnWidths.fromTo, maxWidth: columnWidths.fromTo }}>
                          {statusFilter === 'pending' ? (
                            (() => {
                              const manualAction = manualActionOverrides[transaction.id];
                              const isInMatchMode = manualAction === 'match' || (
                                !manualAction && 
                                (transaction.type === 'transfer' || transaction.type === 'credit_card_payment') && 
                                findPairedTransfer(transaction)
                              );

                              if (isInMatchMode) {
                                const paired = findPairedTransfer(transaction);
                                const pairedAccountId = paired ? paired.bank_account_id : '';
                                return (
                                  <ClickThroughSelect
                                    value={pairedAccountId}
                                    onValueChange={(accountId) => {
                                      if (!activeAccountIds.includes(transaction.bank_account_id)) return;
                                      // Find or create matching transaction with selected account
                                      if (paired) {
                                        updateMutation.mutate({
                                          id: paired.id,
                                          data: { ...paired, bank_account_id: accountId }
                                        });
                                      }
                                    }}
                                    disabled={!activeAccountIds.includes(transaction.bank_account_id)}
                                    triggerClassName="h-7 border-slate-300 text-xs"
                                    placeholder="Select account"
                                  >
                                    {allActiveAccounts.map(acc => (
                                      <ClickThroughSelectItem key={acc.id} value={acc.id}>
                                        {getAccountDisplayName(acc)}
                                      </ClickThroughSelectItem>
                                    ))}
                                  </ClickThroughSelect>
                                );
                              }

                              return (
                                <ContactDropdown
                                  value={transaction.contact_id}
                                  onValueChange={(value) => {
                                    if (!activeAccountIds.includes(transaction.bank_account_id)) return;
                                    updateMutation.mutate({
                                      id: transaction.id,
                                      data: { ...transaction, contact_id: value }
                                    });
                                  }}
                                  transactionDescription={transaction.description}
                                  aiSuggestionId={transaction.ai_suggested_contact_id}
                                  disabled={!activeAccountIds.includes(transaction.bank_account_id)}
                                  onAddNew={(searchTerm) => {
                                    setContactSearchTerm(searchTerm);
                                    setAddContactSheetOpen(true);
                                  }}
                                  triggerClassName="h-7 border-slate-300"
                                  placeholder="Select contact"
                                />
                              );
                            })()
                          ) : (
                            <span className="text-xs px-1">
                              {(() => {
                                // For posted transactions, show paired account if it's a transfer/credit_card_payment
                                if ((transaction.type === 'transfer' || transaction.type === 'credit_card_payment') && transaction.transfer_pair_id) {
                                  const paired = findPairedTransfer(transaction);
                                  if (paired) {
                                    const pairedAccount = allActiveAccounts.find(a => a.id === paired.bank_account_id) || accounts.find(a => a.id === paired.bank_account_id);
                                    return pairedAccount ? getAccountDisplayName(pairedAccount) : '—';
                                  }
                                }
                                // Otherwise show contact
                                return contacts.find(c => c.id === transaction.contact_id)?.name || '—';
                              })()}
                            </span>
                          )}
                        </td>
                        <td className="border-r border-slate-200 py-1 px-4 pl-2" style={{ width: columnWidths.categorize, minWidth: columnWidths.categorize, maxWidth: columnWidths.categorize }}>
                          {statusFilter === 'pending' ? (
                            (() => {
                              const manualAction = manualActionOverrides[transaction.id];
                              const isInMatchMode = manualAction === 'match' || (
                                !manualAction && 
                                (transaction.type === 'transfer' || transaction.type === 'credit_card_payment') && 
                                findPairedTransfer(transaction)
                              );

                              if (isInMatchMode) {
                                return (
                                  <ClickThroughSelect
                                    value={transaction.type}
                                    onValueChange={(newType) => {
                                      if (!activeAccountIds.includes(transaction.bank_account_id)) return;
                                      updateMutation.mutate({
                                        id: transaction.id,
                                        data: { ...transaction, type: newType }
                                      });
                                    }}
                                    disabled={!activeAccountIds.includes(transaction.bank_account_id)}
                                    triggerClassName="h-7 border-slate-300 text-xs"
                                    placeholder="Select type"
                                  >
                                    <ClickThroughSelectItem value="transfer">
                                      Transfer
                                    </ClickThroughSelectItem>
                                    <ClickThroughSelectItem value="credit_card_payment">
                                      Credit Card Payment
                                    </ClickThroughSelectItem>
                                  </ClickThroughSelect>
                                );
                              }

                              return (
                                <CategoryDropdown
                                  value={transaction.category_id}
                                  onValueChange={(value) => {
                                    if (!activeAccountIds.includes(transaction.bank_account_id)) return;
                                    const selectedCategory = categories.find(c => c.id === value);
                                    updateMutation.mutate({
                                      id: transaction.id,
                                      data: {
                                        ...transaction,
                                        category_id: value,
                                        type: selectedCategory ? selectedCategory.type : transaction.type
                                      }
                                    });
                                  }}
                                  transactionType={transaction.type}
                                  aiSuggestionId={transaction.ai_suggested_category_id}
                                  disabled={!activeAccountIds.includes(transaction.bank_account_id)}
                                  onAddNew={(searchTerm) => {
                                    setCategorySearchTerm(searchTerm);
                                    setAddAccountSheetOpen(true);
                                  }}
                                  triggerClassName="h-7 border-slate-300"
                                  placeholder="Select category"
                                  isTransactionTransfer={transaction.type === 'transfer'}
                                  transactionAmount={transaction.amount}
                                />
                              );
                            })()
                          ) : (
                            <span className="text-xs px-1">
                              {(() => {
                                // For posted transactions, show transaction type label for transfers/credit card payments
                                if (transaction.type === 'transfer') {
                                  return 'Transfer';
                                } else if (transaction.type === 'credit_card_payment') {
                                  return 'Credit Card Payment';
                                }
                                // Otherwise show category
                                return categories.find(c => c.id === transaction.category_id)?.name || '—';
                              })()}
                            </span>
                          )}
                        </td>
                        <td className="py-1 pl-2 pr-1 whitespace-nowrap text-left">
                        {(() => {
                          const isInactiveAccount = !activeAccountIds.includes(transaction.bank_account_id);
                          if (isInactiveAccount) {
                            return <span className="text-xs text-slate-400 italic">Inactive</span>;
                          }

                          if (statusFilter === 'pending') {
                            return (
                              <div className="flex items-center justify-start gap-1 pl-1">
                                {(() => {
                                  const manualAction = manualActionOverrides[transaction.id];

                                  let actionText, actionHandler;

                                  if (manualAction === 'post') {
                                    actionText = 'Post';
                                    actionHandler = () => {
                                      updateMutation.mutate({
                                        id: transaction.id,
                                        data: { ...transaction, status: 'posted' }
                                      });
                                    };
                                  } else if (manualAction === 'match') {
                                    actionText = 'Match';
                                    actionHandler = () => {
                                      const matches = (transaction.type === 'transfer' || transaction.type === 'credit_card_payment')
                                        ? [findPairedTransfer(transaction)].filter(Boolean)
                                        : findPotentialMatches(transaction);
                                      setMatchingTransaction(transaction);
                                      setPotentialMatches(matches);
                                      setMatchDialogOpen(true);
                                    };
                                  } else {
                                    if (transaction.type === 'transfer' || transaction.type === 'credit_card_payment') {
                                      const paired = findPairedTransfer(transaction);
                                      actionText = paired ? 'Match' : 'Post';
                                      actionHandler = () => handleTransferMatch(transaction);
                                    } else {
                                      const matches = findPotentialMatches(transaction);
                                      actionText = matches.length > 0 ? 'Match' : 'Post';
                                      actionHandler = () => handleMatchClick(transaction);
                                    }
                                  }

                                  return (
                                    <button
                                      className="text-xs text-blue-600 hover:underline"
                                      onClick={(e) => {
                                        e?.stopPropagation();
                                        actionHandler();
                                      }}
                                    >
                                      {actionText}
                                    </button>
                                  );
                                })()}
                                  <div className="border-l border-slate-300 h-4" />
                                  <ClickThroughDropdownMenu>
                                    <ClickThroughDropdownMenuTrigger asChild>
                                      <button
                                        className="text-slate-600 hover:text-slate-900"
                                        onClick={(e) => e?.stopPropagation()}
                                      >
                                        <ChevronDown className="w-4 h-4" />
                                      </button>
                                    </ClickThroughDropdownMenuTrigger>
                                    <ClickThroughDropdownMenuContent>
                                      <ClickThroughDropdownMenuItem
                                        onClick={(e) => {
                                          e?.stopPropagation();
                                          setExpandedTransactionId(expandedTransactionId === transaction.id ? null : transaction.id);
                                        }}
                                      >
                                        Edit
                                      </ClickThroughDropdownMenuItem>
                                      <ClickThroughDropdownMenuItem
                                        onClick={(e) => {
                                          e?.stopPropagation();
                                          // TODO: Implement split functionality
                                        }}
                                      >
                                        Split
                                      </ClickThroughDropdownMenuItem>
                                      <ClickThroughDropdownMenuItem
                                        onClick={(e) => {
                                          e?.stopPropagation();
                                          // TODO: Implement create rule functionality
                                        }}
                                      >
                                        Create Rule
                                      </ClickThroughDropdownMenuItem>
                                      <ClickThroughDropdownMenuItem
                                        onClick={(e) => {
                                          e?.stopPropagation();
                                          updateMutation.mutate({
                                            id: transaction.id,
                                            data: { ...transaction, status: 'excluded' }
                                          });
                                        }}
                                      >
                                        Exclude
                                      </ClickThroughDropdownMenuItem>
                                    </ClickThroughDropdownMenuContent>
                                  </ClickThroughDropdownMenu>
                                </div>
                              );
                            }

                            if (statusFilter === 'posted') {
                              return (
                                <button
                                  className="text-xs text-blue-600 hover:underline"
                                  onClick={(e) => {
                                    e?.stopPropagation();
                                    updateMutation.mutate({
                                      id: transaction.id,
                                      data: { ...transaction, status: 'pending' }
                                    });
                                  }}
                                >
                                  Undo
                                </button>
                              );
                            }

                            if (statusFilter === 'excluded') {
                              return (
                                <button
                                  className="text-xs text-blue-600 hover:underline"
                                  onClick={(e) => {
                                    e?.stopPropagation();
                                    updateMutation.mutate({
                                      id: transaction.id,
                                      data: { ...transaction, status: 'pending' }
                                    });
                                  }}
                                >
                                  Undo
                                </button>
                              );
                            }

                            return null;
                          })()}
                        </td>
                        </tr>
                        {expandedTransactionId === transaction.id && (
                          <tr className={`${index % 2 === 0 ? 'bg-white' : 'bg-slate-50'} border-t border-slate-100`}>
                            <td colSpan={selectedAccount === 'all' ? 9 : 8} className="p-0">
                              <div className="bg-slate-50 p-4 border-l-4 border-blue-500">
                                {activeAccountIds.includes(transaction.bank_account_id) ? (
                                  <div className="space-y-3">
                                    {statusFilter === 'pending' && (
                                      <div className="flex items-center gap-2 mb-3">
                                        <Tabs
                                          value={manualActionOverrides[transaction.id] || (() => {
                                            if (transaction.type === 'transfer') {
                                              return findPairedTransfer(transaction) ? 'match' : 'post';
                                            }
                                            const matches = findPotentialMatches(transaction);
                                            return matches.length > 0 ? 'match' : 'post';
                                          })()}
                                          onValueChange={(val) => {
                                            setManualActionOverrides(prev => ({
                                              ...prev,
                                              [transaction.id]: val
                                            }));
                                          }}
                                          className="h-8"
                                        >
                                          <TabsList className="h-8">
                                            <TabsTrigger value="post" className="h-7 text-xs">Categorize</TabsTrigger>
                                            <TabsTrigger value="match" className="h-7 text-xs">Match</TabsTrigger>
                                          </TabsList>
                                        </Tabs>
                                      </div>
                                    )}

                                    {/* Categorize Tab Content */}
                                    {(() => {
                                      const override = manualActionOverrides[transaction.id];
                                      if (override === 'match') return false;
                                      if (override === 'post') return true;
                                      // Check default
                                      if (transaction.type === 'transfer' || transaction.type === 'credit_card_payment') {
                                        return !findPairedTransfer(transaction);
                                      }
                                      return findPotentialMatches(transaction).length === 0;
                                    })() && (
                                      <div className="grid grid-cols-2 gap-3">
                                        {transaction.type !== 'transfer' && transaction.type !== 'credit_card_payment' && (
                                          <div>
                                            <Label className="text-xs mb-1 block">Payment Method</Label>
                                            {getAccountDetails(transaction.bank_account_id)?.account_type === 'credit_card' ? (
                                              <Input value="Credit Card" readOnly className="h-8 text-xs bg-slate-50" />
                                            ) : (
                                              <ClickThroughSelect
                                                value={transaction.payment_method || 'debit_card'}
                                                onValueChange={(val) => {
                                                  updateMutation.mutate({
                                                    id: transaction.id,
                                                    data: { ...transaction, payment_method: val }
                                                  });
                                                }}
                                                triggerClassName="h-8 text-xs"
                                              >
                                                <ClickThroughSelectItem value="cash">Cash</ClickThroughSelectItem>
                                                <ClickThroughSelectItem value="debit_card">Debit Card</ClickThroughSelectItem>
                                                <ClickThroughSelectItem value="bank_transfer">ACH / Bank Transfer</ClickThroughSelectItem>
                                                <ClickThroughSelectItem value="check">Check</ClickThroughSelectItem>
                                                <ClickThroughSelectItem value="online_bank_payment">Online Bank Payment</ClickThroughSelectItem>
                                                <ClickThroughSelectItem value="other">Other</ClickThroughSelectItem>
                                              </ClickThroughSelect>
                                            )}
                                          </div>
                                        )}
                                      </div>
                                    )}

                                    {/* Match Tab Content */}
                                    {(() => {
                                      const override = manualActionOverrides[transaction.id];
                                      if (override === 'post') return false;
                                      if (override === 'match') return true;
                                      // Check default
                                      if (transaction.type === 'transfer' || transaction.type === 'credit_card_payment') {
                                        return !!findPairedTransfer(transaction);
                                      }
                                      return findPotentialMatches(transaction).length > 0;
                                    })() && (
                                      <>
                                        {/* Potential Matches */}
                                        {(() => {
                                        // Always show potential matches in expanded view, regardless of whether currently paired
                                        const autoMatches = findPotentialMatches(transaction);
                                        const filters = manualMatchFilters[transaction.id] || {};
                                        const filterInputs = manualMatchFilterInputs[transaction.id] || {};
                                        const hasFilters = filters.account || filters.amountMin || filters.amountMax || filters.dateFrom || filters.dateTo;

                                        // If filtering manually, apply filters to all transactions
                                        const manualMatches = hasFilters ? transactions.filter(t => {
                                          if (t.id === transaction.id) return false;
                                          if (t.status === 'excluded') return false;
                                          if (!activeAccountIds.includes(t.bank_account_id)) return false;

                                          // Account filter
                                          if (filters.account && t.bank_account_id !== filters.account) return false;

                                          // Amount filter
                                          if (filters.amountMin && Math.abs(t.amount) < parseFloat(filters.amountMin)) return false;
                                          if (filters.amountMax && Math.abs(t.amount) > parseFloat(filters.amountMax)) return false;

                                          // Date filter
                                          if (filters.dateFrom && t.date < filters.dateFrom) return false;
                                          if (filters.dateTo && t.date > filters.dateTo) return false;

                                          return true;
                                        }) : [];

                                        const matches = hasFilters ? manualMatches : autoMatches;

                                        return (
                                          <div className="text-xs">

                                            <div className="mb-3">
                                              <p className="text-xs text-slate-600 mb-2">Filter transactions to find a match:</p>
                                              <div className="flex gap-2">
                                                <div className="flex-1">
                                                  <Label className="text-xs mb-1 block">Account</Label>
                                                  <AccountDropdown
                                                    value={filterInputs.account || 'all'}
                                                    onValueChange={(val) => {
                                                      const newVal = val === 'all' ? null : val;
                                                      setManualMatchFilterInputs(prev => ({
                                                        ...prev,
                                                        [transaction.id]: {
                                                          ...prev[transaction.id],
                                                          account: newVal
                                                        }
                                                      }));
                                                      setManualMatchFilters(prev => ({
                                                        ...prev,
                                                        [transaction.id]: {
                                                          ...prev[transaction.id],
                                                          account: newVal
                                                        }
                                                      }));
                                                    }}
                                                    showAllOption={true}
                                                    showPendingCounts={false}
                                                    triggerClassName="h-8 text-xs"
                                                    placeholder="All Accounts"
                                                  />
                                                </div>
                                                <div className="w-32">
                                                  <Label className="text-xs mb-1 block">Min</Label>
                                                  <div className="relative">
                                                    <span className="absolute left-2 top-1/2 -translate-y-1/2 text-slate-500 text-xs">$</span>
                                                    <Input
                                                      type="number"
                                                      step="0.01"
                                                      placeholder="0.00"
                                                      value={filterInputs.amountMin || ''}
                                                      onChange={(e) => {
                                                        setManualMatchFilterInputs(prev => ({
                                                          ...prev,
                                                          [transaction.id]: {
                                                            ...prev[transaction.id],
                                                            amountMin: e.target.value
                                                          }
                                                        }));
                                                      }}
                                                      onBlur={(e) => {
                                                        setManualMatchFilters(prev => ({
                                                          ...prev,
                                                          [transaction.id]: {
                                                            ...prev[transaction.id],
                                                            amountMin: e.target.value
                                                          }
                                                        }));
                                                      }}
                                                      className="h-8 text-xs pl-5"
                                                    />
                                                  </div>
                                                </div>
                                                <div className="w-32">
                                                  <Label className="text-xs mb-1 block">Max</Label>
                                                  <div className="relative">
                                                    <span className="absolute left-2 top-1/2 -translate-y-1/2 text-slate-500 text-xs">$</span>
                                                    <Input
                                                      type="number"
                                                      step="0.01"
                                                      placeholder="0.00"
                                                      value={filterInputs.amountMax || ''}
                                                      onChange={(e) => {
                                                        setManualMatchFilterInputs(prev => ({
                                                          ...prev,
                                                          [transaction.id]: {
                                                            ...prev[transaction.id],
                                                            amountMax: e.target.value
                                                          }
                                                        }));
                                                      }}
                                                      onBlur={(e) => {
                                                        setManualMatchFilters(prev => ({
                                                          ...prev,
                                                          [transaction.id]: {
                                                            ...prev[transaction.id],
                                                            amountMax: e.target.value
                                                          }
                                                        }));
                                                      }}
                                                      className="h-8 text-xs pl-5"
                                                    />
                                                  </div>
                                                </div>
                                                <div className="w-36">
                                                  <Label className="text-xs mb-1 block">Date From</Label>
                                                  <Input
                                                    type="date"
                                                    value={filterInputs.dateFrom || ''}
                                                    onChange={(e) => {
                                                      setManualMatchFilterInputs(prev => ({
                                                        ...prev,
                                                        [transaction.id]: {
                                                          ...prev[transaction.id],
                                                          dateFrom: e.target.value
                                                        }
                                                      }));
                                                    }}
                                                    onBlur={(e) => {
                                                      setManualMatchFilters(prev => ({
                                                        ...prev,
                                                        [transaction.id]: {
                                                          ...prev[transaction.id],
                                                          dateFrom: e.target.value
                                                        }
                                                      }));
                                                    }}
                                                    className="h-8 text-xs"
                                                  />
                                                </div>
                                                <div className="w-36">
                                                  <Label className="text-xs mb-1 block">Date To</Label>
                                                  <Input
                                                    type="date"
                                                    value={filterInputs.dateTo || ''}
                                                    onChange={(e) => {
                                                      setManualMatchFilterInputs(prev => ({
                                                        ...prev,
                                                        [transaction.id]: {
                                                          ...prev[transaction.id],
                                                          dateTo: e.target.value
                                                        }
                                                      }));
                                                    }}
                                                    onBlur={(e) => {
                                                      setManualMatchFilters(prev => ({
                                                        ...prev,
                                                        [transaction.id]: {
                                                          ...prev[transaction.id],
                                                          dateTo: e.target.value
                                                        }
                                                      }));
                                                    }}
                                                    className="h-8 text-xs"
                                                  />
                                                </div>
                                              </div>
                                            </div>

                                            {(autoMatches.length > 0 || hasFilters) && (
                                              <div className="mb-2">
                                                <p className="text-xs font-semibold text-slate-700 mb-2">
                                                  {hasFilters ? 'Filtered Results:' : 'Suggested Matches:'}
                                                </p>
                                              </div>
                                            )}

                                            {(autoMatches.length > 0 || hasFilters) && (
                                              <>
                                                <div className="space-y-2 max-h-64 overflow-y-auto">
                                                  {matches.length === 0 && hasFilters ? (
                                                    <p className="text-slate-500 text-center py-2">No transactions found matching filters</p>
                                                  ) : (
                                                    matches.map(match => {
                                                      const matchAccount = allActiveAccounts.find(a => a.id === match.bank_account_id) || accounts.find(a => a.id === match.bank_account_id);
                                                      const confidence = (transaction.type === 'transfer' || transaction.type === 'credit_card_payment') && !hasFilters ? 100 : calculateMatchConfidence(transaction, match);
                                                      const isSelected = selectedMatches[transaction.id] === match.id;

                                                      return (
                                                        <div
                                                          key={match.id}
                                                          className={`p-2 border rounded flex items-center gap-2 cursor-pointer transition-colors ${
                                                            isSelected ? 'bg-blue-50 border-blue-400' : 'bg-white hover:bg-slate-50'
                                                          }`}
                                                          onClick={() => {
                                                            const willBeSelected = !isSelected;

                                                            if (willBeSelected) {
                                                              // Establish relationship - set transfer_pair_id on both transactions
                                                              const pairId = `transfer_${Date.now()}`;
                                                              
                                                              // Ensure correct types for credit card payments
                                                              let transactionType = transaction.type;
                                                              let matchType = match.type;
                                                              
                                                              if (transaction.type === 'credit_card_payment' || match.type === 'income') {
                                                                // Transaction is paying credit card, match is receiving on credit card
                                                                transactionType = 'credit_card_payment';
                                                                matchType = 'income';
                                                              } else if (transaction.type === 'income' || match.type === 'credit_card_payment') {
                                                                // Transaction is receiving on credit card, match is paying credit card
                                                                transactionType = 'income';
                                                                matchType = 'credit_card_payment';
                                                              } else {
                                                                // Regular transfer
                                                                transactionType = 'transfer';
                                                                matchType = 'transfer';
                                                              }
                                                              
                                                              updateMutation.mutate({
                                                                id: transaction.id,
                                                                data: { ...transaction, transfer_pair_id: pairId, type: transactionType }
                                                              });
                                                              updateMutation.mutate({
                                                                id: match.id,
                                                                data: { ...match, transfer_pair_id: pairId, type: matchType }
                                                              });
                                                              setSelectedMatches(prev => ({
                                                                ...prev,
                                                                [transaction.id]: match.id
                                                              }));
                                                            } else {
                                                              // Remove relationship - clear transfer_pair_id on both transactions
                                                              updateMutation.mutate({
                                                                id: transaction.id,
                                                                data: { ...transaction, transfer_pair_id: null }
                                                              });
                                                              updateMutation.mutate({
                                                                id: match.id,
                                                                data: { ...match, transfer_pair_id: null }
                                                              });
                                                              setSelectedMatches(prev => ({
                                                                ...prev,
                                                                [transaction.id]: undefined
                                                              }));
                                                            }
                                                          }}
                                                        >
                                                          <input
                                                            type="checkbox"
                                                            checked={isSelected}
                                                            onChange={() => {}}
                                                            className="rounded w-3.5 h-3.5 flex-shrink-0"
                                                          />
                                                          <div className="flex items-center gap-2 flex-1 min-w-0">
                                                            <span className="text-xs text-slate-600 whitespace-nowrap">{format(parseISO(match.date), 'MM/dd/yy')}</span>
                                                            <span className="font-medium text-slate-900 truncate">{formatTransactionDescription(match.description)}</span>
                                                            <span className="font-semibold text-slate-900 whitespace-nowrap">
                                                              {match.amount < 0 ? '-' : ''}${Math.abs(match.amount).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                                                            </span>
                                                            <span className="text-xs text-slate-600 truncate">{getAccountDisplayName(matchAccount)}</span>
                                                            {!hasFilters && (
                                                              <span className="text-xs text-blue-600 font-medium whitespace-nowrap">
                                                                {confidence}% match
                                                              </span>
                                                            )}
                                                          </div>
                                                        </div>
                                                      );
                                                    })
                                                  )}
                                                </div>
                                              </>
                                            )}
                                          </div>
                                        );
                                        })()}
                                      </>
                                    )}

                                    <div className="grid grid-cols-2 gap-3">
                                      <div>
                                        <Label className="text-xs mb-1 block">Notes</Label>
                                        <Textarea
                                          defaultValue={transaction.notes || ''}
                                          className="text-xs min-h-[60px] resize-none"
                                          placeholder="Add notes..."
                                          onBlur={(e) => {
                                            if (e.target.value !== (transaction.notes || '')) {
                                              updateMutation.mutate({
                                                id: transaction.id,
                                                data: { ...transaction, notes: e.target.value }
                                              });
                                            }
                                          }}
                                          onClick={(e) => e.stopPropagation()}
                                        />
                                      </div>
                                      <div>
                                        <Label className="text-xs mb-1 block">Receipt / Files</Label>
                                        <div 
                                          className="border-2 border-dashed border-slate-300 rounded-md p-3 text-center hover:border-slate-400 transition-colors cursor-pointer h-[60px] flex items-center justify-center"
                                          onDragOver={(e) => {
                                            e.preventDefault();
                                            e.stopPropagation();
                                            e.currentTarget.classList.add('border-blue-400', 'bg-blue-50');
                                          }}
                                          onDragLeave={(e) => {
                                            e.preventDefault();
                                            e.stopPropagation();
                                            e.currentTarget.classList.remove('border-blue-400', 'bg-blue-50');
                                          }}
                                          onDrop={async (e) => {
                                            e.preventDefault();
                                            e.stopPropagation();
                                            e.currentTarget.classList.remove('border-blue-400', 'bg-blue-50');
                                            const file = e.dataTransfer.files?.[0];
                                            if (file) {
                                              const { file_url } = await base44.integrations.Core.UploadFile({ file });
                                              updateMutation.mutate({
                                                id: transaction.id,
                                                data: { ...transaction, receipt_url: file_url }
                                              });
                                            }
                                          }}
                                        >
                                          <input
                                            type="file"
                                            className="hidden"
                                            id={`file-${transaction.id}`}
                                            onChange={async (e) => {
                                              const file = e.target.files?.[0];
                                              if (file) {
                                                const { file_url } = await base44.integrations.Core.UploadFile({ file });
                                                updateMutation.mutate({
                                                  id: transaction.id,
                                                  data: { ...transaction, receipt_url: file_url }
                                                });
                                              }
                                            }}
                                          />
                                          <label htmlFor={`file-${transaction.id}`} className="text-xs text-slate-500 cursor-pointer">
                                            {transaction.receipt_url ? 'Change file' : 'Drag & drop or click to upload'}
                                          </label>
                                        </div>
                                        {transaction.receipt_url && (
                                          <a href={transaction.receipt_url} target="_blank" rel="noopener noreferrer" className="text-xs text-blue-600 hover:underline mt-1 block">
                                            View attached file
                                          </a>
                                        )}
                                      </div>
                                    </div>
                                    <div className="flex items-center justify-between pt-2">
                                      <div className="flex items-center gap-2">
                                        {statusFilter === 'pending' && (
                                          <>
                                            {(() => {
                                              const manualAction = manualActionOverrides[transaction.id];

                                              let actionText, actionHandler;

                                              if (manualAction === 'post') {
                                                actionText = 'Post';
                                                actionHandler = () => {
                                                  updateMutation.mutate({
                                                    id: transaction.id,
                                                    data: { ...transaction, status: 'posted' }
                                                  });
                                                  setExpandedTransactionId(null);
                                                };
                                              } else if (manualAction === 'match') {
                                                actionText = 'Match';
                                                actionHandler = () => {
                                                  const matches = transaction.type === 'transfer'
                                                    ? [findPairedTransfer(transaction)].filter(Boolean)
                                                    : findPotentialMatches(transaction);
                                                  setMatchingTransaction(transaction);
                                                  setPotentialMatches(matches);
                                                  setMatchDialogOpen(true);
                                                  setExpandedTransactionId(null);
                                                };
                                              } else {
                                                if (transaction.type === 'transfer') {
                                                  const paired = findPairedTransfer(transaction);
                                                  actionText = paired ? 'Match' : 'Post';
                                                  actionHandler = () => {
                                                    handleTransferMatch(transaction);
                                                    setExpandedTransactionId(null);
                                                  };
                                                } else {
                                                  const matches = findPotentialMatches(transaction);
                                                  actionText = matches.length > 0 ? 'Match' : 'Post';
                                                  actionHandler = () => {
                                                    handleMatchClick(transaction);
                                                    setExpandedTransactionId(null);
                                                  };
                                                }
                                              }

                                              const matches = (transaction.type === 'transfer' || transaction.type === 'credit_card_payment')
                                                ? [findPairedTransfer(transaction)].filter(Boolean)
                                                : findPotentialMatches(transaction);
                                              const hasSelection = selectedMatches[transaction.id];

                                              return (
                                                <Button
                                                  size="sm"
                                                  variant="outline"
                                                  className="h-7 text-xs bg-blue-600 text-white hover:bg-blue-700 hover:text-white"
                                                  onClick={(e) => {
                                                    e?.stopPropagation();
                                                    if (actionText === 'Match') {
                                                      if (hasSelection || matches.length === 0) {
                                                        handleMatchClick(transaction);
                                                      }
                                                    } else {
                                                      actionHandler();
                                                    }
                                                  }}
                                                >
                                                  {actionText}
                                                </Button>
                                              );
                                              })()}
                                            <Button
                                              size="sm"
                                              variant="outline"
                                              className="h-7 text-xs"
                                              onClick={(e) => {
                                                e?.stopPropagation();
                                                // TODO: Implement split functionality
                                              }}
                                            >
                                              Split
                                            </Button>
                                            <Button
                                              size="sm"
                                              variant="outline"
                                              className="h-7 text-xs"
                                              onClick={(e) => {
                                                e?.stopPropagation();
                                                // TODO: Implement create rule functionality
                                              }}
                                            >
                                              Create Rule
                                            </Button>
                                            <Button
                                              size="sm"
                                              variant="outline"
                                              className="h-7 text-xs"
                                              onClick={(e) => {
                                                e?.stopPropagation();
                                                updateMutation.mutate({
                                                  id: transaction.id,
                                                  data: { ...transaction, status: 'excluded' }
                                                });
                                                setExpandedTransactionId(null);
                                              }}
                                            >
                                              Exclude
                                            </Button>
                                          </>
                                        )}
                                      </div>
                                      {transaction.original_description && (
                                        <div className="text-xs text-slate-500 bg-white rounded px-2 py-1">
                                          <strong>Bank Note:</strong> {transaction.original_description}
                                        </div>
                                      )}
                                    </div>
                                  </div>
                                ) : (
                                  <div className="text-xs text-slate-500">
                                    <p>Transaction from inactive account</p>
                                    <p className="mt-1"><strong>ID:</strong> {transaction.id}</p>
                                  </div>
                                )}
                              </div>
                            </td>
                          </tr>
                        )}
                      </React.Fragment>
                                );
                                })
                                )}
                                </tbody>
                                </table>
                                </div>

                                {/* Footer */}
                                {filteredTransactions.length > 0 && (
                                  <div className="flex items-center justify-between px-4 py-3 border-t border-slate-200">
                                    <div className="text-sm text-slate-600">
                                      Showing {filteredTransactions.length} transaction{filteredTransactions.length === 1 ? '' : 's'}
                                    </div>
                                  </div>
                                )}

                                </CardContent>
                                </Card>
      <TransactionFilterPanel
                            isOpen={filterPanelOpen}
                            onClose={() => setFilterPanelOpen(false)}
                            filters={filters}
                            onApply={(newFilters) => {
                              console.log('Received filters:', newFilters);
                              setFilters({...newFilters});
                              if (newFilters.account !== 'all') {
                                setSelectedAccount(newFilters.account);
                              }
                              setFilterPanelOpen(false);
                            }}
                            onReset={() => {
                              setFilters({
                                datePreset: 'all',
                                dateFrom: '',
                                dateTo: '',
                                account: 'all',
                                category: 'all',
                                type: 'all',
                                amountMin: '',
                                amountMax: '',
                                paymentMethod: 'all'
                              });
                              setSelectedAccount('all');
                              setFilterPanelOpen(false);
                            }}
                            accounts={accounts}
                            categories={categories}
                            expenseCategories={expenseCategories}
                            incomeCategories={incomeCategories}
                          />

                          <AddFinancialAccountSheet
                                            open={addAccountSheetOpen}
                                            onOpenChange={setAddAccountSheetOpen}
                                            mode="category"
                                            initialCategoryName={categorySearchTerm}
                                            onAccountCreated={async ({ account: newCategory }) => {
                                              setCategorySearchTerm('');
                                              await queryClient.invalidateQueries({ queryKey: ['categories'] });
                                              if (expandedTransactionId && newCategory) {
                                                const transaction = transactions.find(t => t.id === expandedTransactionId);
                                                if (transaction) {
                                                  updateMutation.mutate({
                                                    id: transaction.id,
                                                    data: { ...transaction, category_id: newCategory.id, type: newCategory.type }
                                                  });
                                                }
                                              }
                                            }}
                                          />

                          <Sheet open={addContactSheetOpen} onOpenChange={setAddContactSheetOpen}>
                            <SheetContent className="overflow-y-auto">
                              <SheetHeader>
                                <SheetTitle>Add Contact</SheetTitle>
                              </SheetHeader>
                              <form onSubmit={async (e) => {
                                e.preventDefault();
                                const formData = new FormData(e.target);
                                const data = {
                                  name: formData.get('name'),
                                  type: formData.get('type'),
                                  email: formData.get('email') || undefined,
                                  phone: formData.get('phone') || undefined,
                                  notes: formData.get('notes') || undefined,
                                  status: 'Active'
                                };
                                const newContact = await base44.entities.Contact.create(data);

                                // Auto-populate the expanded transaction's contact field with newly created contact
                                if (expandedTransactionId) {
                                  const transaction = transactions.find(t => t.id === expandedTransactionId);
                                  if (transaction) {
                                    await updateMutation.mutateAsync({
                                      id: transaction.id,
                                      data: { ...transaction, contact_id: newContact.id }
                                    });
                                  }
                                }

                                await queryClient.invalidateQueries({ queryKey: ['contacts'] });
                                setAddContactSheetOpen(false);
                                setContactSearchTerm('');
                              }} className="space-y-4 mt-4">
                                <div>
                                  <Label htmlFor="contact-name">Name *</Label>
                                  <Input
                                    id="contact-name"
                                    name="name"
                                    defaultValue={contactSearchTerm}
                                    placeholder="e.g., Starbucks, Netflix"
                                    required
                                  />
                                </div>
                                <div>
                                  <Label htmlFor="contact-type">Type</Label>
                                  <ClickThroughSelect name="type" defaultValue="Vendor">
                                    <ClickThroughSelectItem value="Vendor">Vendor</ClickThroughSelectItem>
                                    <ClickThroughSelectItem value="Customer">Customer</ClickThroughSelectItem>
                                  </ClickThroughSelect>
                                </div>
                                <div>
                                  <Label htmlFor="contact-email">Email</Label>
                                  <Input id="contact-email" name="email" type="email" placeholder="contact@example.com" />
                                </div>
                                <div>
                                  <Label htmlFor="contact-phone">Phone</Label>
                                  <Input id="contact-phone" name="phone" placeholder="(555) 123-4567" />
                                </div>
                                <div>
                                  <Label htmlFor="contact-notes">Notes</Label>
                                  <Textarea id="contact-notes" name="notes" placeholder="e.g., Recurring $15.99/month" rows={3} />
                                </div>
                                <SheetFooter className="pt-4">
                                  <Button type="button" variant="outline" onClick={() => setAddContactSheetOpen(false)}>Cancel</Button>
                                  <Button type="submit" className="bg-blue-600 hover:bg-blue-700">Create</Button>
                                </SheetFooter>
                              </form>
                            </SheetContent>
                          </Sheet>

                          <TransferMatchDialog
                            isOpen={transferMatchDialogOpen}
                            onClose={() => {
                              setTransferMatchDialogOpen(false);
                              setMatchingTransfer(null);
                              setPairedTransfer(null);
                            }}
                            transaction={matchingTransfer}
                            pairedTransaction={pairedTransfer}
                            accounts={accounts}
                            onConfirm={handleConfirmTransferMatch}
                          />



                          {/* Add/Edit Sheet */}
                  <Sheet open={dialogOpen} onOpenChange={setDialogOpen}>
        <SheetContent className="overflow-y-auto">
          <SheetHeader>
            <SheetTitle>{editingTransaction ? 'Edit Transaction' : 'New Transaction'}</SheetTitle>
          </SheetHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="date">Date</Label>
                <Input
                  id="date"
                  name="date"
                  type="date"
                  defaultValue={editingTransaction?.date || format(new Date(), 'yyyy-MM-dd')}
                  required
                />
              </div>
              <div>
                <Label htmlFor="type">Type</Label>
                {editingTransaction ? (
                  <ClickThroughSelect 
                    name="type" 
                    defaultValue={editingTransaction.type}
                    triggerClassName="hover:bg-slate-50"
                  >
                    <ClickThroughSelectItem 
                      value="income" 
                      className={editingTransaction.type === 'expense' ? 'text-slate-400 pointer-events-none' : ''}
                    >
                      Income
                    </ClickThroughSelectItem>
                    <ClickThroughSelectItem 
                      value="expense" 
                      className={editingTransaction.type === 'income' ? 'text-slate-400 pointer-events-none' : ''}
                    >
                      Expense
                    </ClickThroughSelectItem>
                  </ClickThroughSelect>
                ) : (
                  <ClickThroughSelect 
                    name="type" 
                    value={selectedType}
                    onValueChange={setSelectedType}
                    triggerClassName="hover:bg-slate-50"
                  >
                    <ClickThroughSelectItem value="income">Income</ClickThroughSelectItem>
                    <ClickThroughSelectItem value="expense">Expense</ClickThroughSelectItem>
                  </ClickThroughSelect>
                )}
              </div>
            </div>

            <div>
              <Label htmlFor="description">Description</Label>
              <Input
                id="description"
                name="description"
                defaultValue={editingTransaction?.description}
                value={editingTransaction ? undefined : newDescription}
                onChange={editingTransaction ? undefined : (e) => setNewDescription(e.target.value)}
                placeholder="e.g., Grocery shopping"
                required
              />
              {!editingTransaction && categorySuggestion && (
                <div className="mt-2">
                  <CategorySuggestion 
                    suggestion={categorySuggestion} 
                    onApply={(s) => {
                      setSelectedCategory(s.category);
                      setSelectedType(s.type);
                    }}
                  />
                </div>
              )}
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                                    <Label htmlFor="amount">Amount</Label>
                                    <div className="relative">
                                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500">$</span>
                                      <Input
                                        id="amount"
                                        name="amount"
                                        type="text"
                                        defaultValue={editingTransaction?.amount?.toFixed(2)}
                                        placeholder="0.00"
                                        className="pl-7"
                                        required
                                      />
                                    </div>
                                  </div>
              <div>
                <Label htmlFor="bank_account_id">Account</Label>
                <ClickThroughSelect 
                  name="bank_account_id" 
                  defaultValue={editingTransaction?.bank_account_id} 
                  placeholder="Select account" 
                  triggerClassName="hover:bg-slate-50"
                  onValueChange={(val) => {
                    const account = getAccountDetails(val);
                    setFormSelectedAccountType(account?.account_type || null);
                  }}
                >
                    {accounts.map(acc => (
                      <ClickThroughSelectItem key={acc.id} value={acc.id}>
                        {getAccountDisplayName(acc)}
                      </ClickThroughSelectItem>
                    ))}
                </ClickThroughSelect>
              </div>
            </div>

            {(!editingTransaction || editingTransaction.type !== 'transfer') && (
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="category_id">Category</Label>
                  <ClickThroughSelect 
                    name="category_id" 
                    value={editingTransaction ? undefined : selectedCategory}
                    defaultValue={editingTransaction?.category_id} 
                    onValueChange={editingTransaction ? undefined : (val) => {
                      setSelectedCategory(val);
                      const cat = categories.find(c => c.id === val);
                      if (cat) setSelectedType(cat.type);
                    }}
                    placeholder="Select category"
                    triggerClassName="hover:bg-slate-50"
                  >
                      {expenseCategories.length > 0 && (
                        <>
                          <div className="px-2 py-1 text-xs font-semibold text-slate-500">Expenses</div>
                          {expenseCategories.map(cat => (
                            <ClickThroughSelectItem key={cat.id} value={cat.id}>
                              {cat.name}
                            </ClickThroughSelectItem>
                          ))}
                        </>
                      )}
                      {incomeCategories.length > 0 && (
                        <>
                          <div className="px-2 py-1 text-xs font-semibold text-slate-500 mt-2">Income</div>
                          {incomeCategories.map(cat => (
                            <ClickThroughSelectItem key={cat.id} value={cat.id}>
                              {cat.name}
                            </ClickThroughSelectItem>
                          ))}
                        </>
                      )}
                  </ClickThroughSelect>
                </div>
                <div>
                  <Label htmlFor="payment_method">Payment Method</Label>
                  {formSelectedAccountType === 'credit_card' || (editingTransaction && getAccountDetails(editingTransaction.bank_account_id)?.account_type === 'credit_card') ? (
                    <Input value="Credit Card" readOnly className="hover:bg-slate-50 bg-slate-50" name="payment_method" />
                  ) : (
                    <ClickThroughSelect name="payment_method" defaultValue={editingTransaction?.payment_method || 'debit_card'} triggerClassName="hover:bg-slate-50">
                        <ClickThroughSelectItem value="cash">Cash</ClickThroughSelectItem>
                        <ClickThroughSelectItem value="debit_card">Debit Card</ClickThroughSelectItem>
                        <ClickThroughSelectItem value="bank_transfer">ACH / Bank Transfer</ClickThroughSelectItem>
                        <ClickThroughSelectItem value="check">Check</ClickThroughSelectItem>
                        <ClickThroughSelectItem value="online_bank_payment">Online Bank Payment</ClickThroughSelectItem>
                        <ClickThroughSelectItem value="other">Other</ClickThroughSelectItem>
                    </ClickThroughSelect>
                  )}
                </div>
              </div>
            )}

            <div>
              <Label htmlFor="notes">Notes (optional)</Label>
              <Textarea
                id="notes"
                name="notes"
                defaultValue={editingTransaction?.notes}
                placeholder="Add any additional details..."
                rows={3}
              />
            </div>

            {editingTransaction && (
              <div className="text-xs text-slate-500 bg-slate-50 rounded-md p-3 space-y-1">
                <p className="font-medium text-slate-600">Bank Data</p>
                <p>Original description: {editingTransaction.original_description || editingTransaction.description}</p>
                <p>Date imported: {editingTransaction.created_at && !isNaN(new Date(editingTransaction.created_at).getTime()) ? new Date(editingTransaction.created_at).toLocaleDateString() : 'N/A'}</p>
              </div>
            )}

            <SheetFooter className="pt-4">
              <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" className="bg-blue-600 hover:bg-blue-700">
                Post
              </Button>
            </SheetFooter>
          </form>
        </SheetContent>
      </Sheet>

      {/* Transfer Dialog */}
      <Sheet open={transferDialogOpen} onOpenChange={setTransferDialogOpen}>
        <SheetContent className="overflow-y-auto">
          <SheetHeader>
            <SheetTitle>Transfer Money</SheetTitle>
            <p className="text-sm text-slate-600">Move money between your accounts. No impact on income/expenses.</p>
          </SheetHeader>
          <form onSubmit={async (e) => {
            e.preventDefault();
            const formData = new FormData(e.target);
            
            const fromAccountId = formData.get('from_account');
            const toAccountId = formData.get('to_account');
            const amount = parseFloat(formData.get('amount'));
            const date = formData.get('date');
            const memo = formData.get('memo') || 'Transfer';

            if (!fromAccountId || !toAccountId || !amount || !date) {
              alert('Please fill in all required fields');
              return;
            }

            if (fromAccountId === toAccountId) {
              alert('From and To accounts must be different');
              return;
            }

            const transferPairId = `transfer_${Date.now()}`;
            
            // Find account names for description
            const fromAccount = accounts.find(a => a.id === fromAccountId);
            const toAccount = accounts.find(a => a.id === toAccountId);

            // Create outgoing transaction (negative amount from source)
            await createMutation.mutateAsync({
              date,
              description: `Transfer: ${memo} to ${getAccountDisplayName(toAccount)}`,
              type: 'transfer',
              amount: -amount,
              bank_account_id: fromAccountId,
              status: 'posted',
              payment_method: 'bank_transfer',
              notes: memo,
              transfer_pair_id: transferPairId
            });

            // Create incoming transaction (positive amount to destination)
            await createMutation.mutateAsync({
              date,
              description: `Transfer: ${memo} from ${getAccountDisplayName(fromAccount)}`,
              type: 'transfer',
              amount: amount,
              bank_account_id: toAccountId,
              status: 'posted',
              payment_method: 'bank_transfer',
              notes: memo,
              transfer_pair_id: transferPairId
            });

            setTransferDialogOpen(false);
          }} className="space-y-4 mt-4">
            <div>
              <Label htmlFor="from_account">From Account</Label>
              <ClickThroughSelect name="from_account" placeholder="Select source account" triggerClassName="hover:bg-slate-50" required>
                {accounts.map(acc => (
                  <ClickThroughSelectItem key={acc.id} value={acc.id}>
                    {getAccountDisplayName(acc)} (${acc.current_balance?.toFixed(2) || '0.00'})
                  </ClickThroughSelectItem>
                ))}
              </ClickThroughSelect>
            </div>

            <div>
              <Label htmlFor="to_account">To Account</Label>
              <ClickThroughSelect name="to_account" placeholder="Select destination account" triggerClassName="hover:bg-slate-50" required>
                {accounts.map(acc => (
                  <ClickThroughSelectItem key={acc.id} value={acc.id}>
                    {getAccountDisplayName(acc)} (${acc.current_balance?.toFixed(2) || '0.00'})
                  </ClickThroughSelectItem>
                ))}
              </ClickThroughSelect>
            </div>

            <div>
              <Label htmlFor="amount">Amount</Label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500">$</span>
                <Input
                  id="amount"
                  name="amount"
                  type="number"
                  step="0.01"
                  min="0.01"
                  placeholder="0.00"
                  className="pl-7"
                  required
                />
              </div>
            </div>

            <div>
              <Label htmlFor="date">Date</Label>
              <Input
                id="date"
                name="date"
                type="date"
                defaultValue={format(new Date(), 'yyyy-MM-dd')}
                required
              />
            </div>

            <div>
              <Label htmlFor="memo">Memo (optional)</Label>
              <Input
                id="memo"
                name="memo"
                placeholder="e.g., Emergency Fund"
              />
            </div>

            <SheetFooter className="pt-4">
              <Button type="button" variant="outline" onClick={() => setTransferDialogOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" className="bg-blue-600 hover:bg-blue-700">
                Create Transfer
              </Button>
            </SheetFooter>
          </form>
        </SheetContent>
      </Sheet>
    </>
  );
}