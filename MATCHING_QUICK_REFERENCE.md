# Matching System - Quick Reference Guide

## For Developers: How to Use the Unified System

---

## 1. Import the Unified Hook

```javascript
import { useUnifiedMatching } from '@/hooks/useUnifiedMatching';

// In your component
const { activeProfile } = useProfile();
const { user } = useAuth();

const matching = useUnifiedMatching(activeProfile?.id, user?.id);
```

---

## 2. Check If Transaction Is Matched

```javascript
// Using the hook
if (matching.isPaired(transaction)) {
  console.log('Transaction is part of a pair');
}

// Or using compatibility layer (works with old and new columns)
import * as matchCompat from '@/utils/matchingCompatibility';

if (matchCompat.isMatched(transaction)) {
  console.log('Transaction is matched');
}
```

---

## 3. Find the Paired Transaction

```javascript
const pairedTxn = matching.findPair(transaction, allTransactions);

if (pairedTxn) {
  console.log('Found pair:', pairedTxn);
}
```

---

## 4. Get Match Suggestions

```javascript
const { data: suggestions } = await matching.getSuggestedMatches(transactionId);

suggestions.forEach(match => {
  console.log('Potential match:', match);
  console.log('Confidence:', match.confidence);
  console.log('Match type:', match.match_type); // 'transfer' or 'credit_card_payment'
});
```

---

## 5. Link Two Transactions Manually

```javascript
const handleLink = async () => {
  const matchType = matching.determineMatchType(txn1, txn2, accounts);

  const result = await matching.linkMatches(txn1.id, txn2.id, matchType);

  if (result.success) {
    console.log('Linked successfully!');
  }
};
```

---

## 6. Unmatch a Pair

```javascript
const handleUnmatch = async (transactionId) => {
  const result = await matching.unmatch(transactionId);

  if (result.success) {
    console.log('Unmatched successfully!');
  }
};
```

---

## 7. Accept Auto-Detected Match

```javascript
const handleAccept = async (transactionId) => {
  const result = await matching.acceptMatch(transactionId);

  if (result.success) {
    console.log('Match accepted!');
  }
};
```

---

## 8. Reject Auto-Detected Match (Prevents Re-Suggestion)

```javascript
const handleReject = async (transactionId) => {
  const result = await matching.rejectMatch(transactionId);

  if (result.success) {
    console.log('Match rejected and will not be suggested again');
  }
};
```

---

## 9. Trigger Detection Manually

```javascript
const runDetection = async () => {
  // For specific transactions
  const result = await matching.detectMatches([txnId1, txnId2, txnId3]);

  // For all pending transactions
  const result = await matching.detectMatches(null);

  console.log('Found', result.data.pair_count, 'potential matches');
};
```

---

## 10. Check Processing State

```javascript
if (matching.isProcessing) {
  return <Loader2 className="animate-spin" />;
}
```

---

## Database Schema Quick Reference

### Unified Columns (Use These)
```sql
transactions.paired_transaction_id  -- UUID of the other transaction
transactions.match_type             -- 'transfer' or 'credit_card_payment'
transactions.match_confidence       -- 0-100 (confidence score)
transactions.match_auto_detected    -- boolean
transactions.match_reviewed         -- boolean
```

### Legacy Columns (Deprecated, But Still Work)
```sql
transactions.transfer_pair_id
transactions.cc_payment_pair_id
transactions.transfer_match_confidence
transactions.cc_payment_match_confidence
transactions.transfer_auto_detected
transactions.cc_payment_auto_detected
transactions.transfer_reviewed
transactions.cc_payment_reviewed
```

---

## API Reference

### Direct API Calls (Without Hook)

```javascript
import { matchingAPI } from '@/api/matchingAPI';

// Detect matches
const { data, error } = await matchingAPI.detectMatches(profileId, transactionIds);

// Get unreviewed matches
const { data: matches } = await matchingAPI.getUnreviewedMatches(profileId);
// Or filter by type
const { data: transfers } = await matchingAPI.getUnreviewedMatches(profileId, 'transfer');

// Manual link
await matchingAPI.linkManual(txnId1, txnId2, 'transfer', profileId, userId);

// Unmatch
await matchingAPI.unmatch(transactionId, profileId);

// Accept
await matchingAPI.acceptMatch(transactionId, profileId);

// Reject
await matchingAPI.rejectMatch(transactionId, profileId, userId);

// Get suggestions
const { data: suggestions } = await matchingAPI.getSuggestedMatches(txnId, profileId);

// Get history
const { data: history } = await matchingAPI.getMatchHistory(profileId, 100);
```

---

## SQL Functions Reference

### Unified Detection (Recommended)
```sql
SELECT * FROM auto_detect_matches_unified(
  p_profile_id := 'uuid',
  p_transaction_ids := ARRAY['uuid1', 'uuid2']  -- Optional
);

-- Returns: matched_count, pair_count, transfer_count, cc_payment_count
```

### Manual Link
```sql
CALL link_match_unified(
  p_profile_id := 'uuid',
  p_transaction_id_1 := 'uuid1',
  p_transaction_id_2 := 'uuid2',
  p_match_type := 'transfer',  -- or 'credit_card_payment'
  p_user_id := 'uuid'
);
```

### Reject Match
```sql
CALL reject_match_unified(
  p_profile_id := 'uuid',
  p_transaction_id := 'uuid',
  p_user_id := 'uuid'
);
```

---

## Compatibility Layer Functions

When you need to support both old and new schema:

```javascript
import * as matchCompat from '@/utils/matchingCompatibility';

// Works with both old and new columns
matchCompat.isMatched(transaction)
matchCompat.getPairedTransactionId(transaction)
matchCompat.getMatchType(transaction)
matchCompat.getMatchConfidence(transaction)
matchCompat.isAutoDetected(transaction)
matchCompat.isReviewed(transaction)
matchCompat.findPairedTransaction(transaction, allTransactions)
matchCompat.getUnreviewedMatchCount(transactions)
matchCompat.normalizeTransaction(transaction)  // Converts to unified format
```

---

## Common Patterns

### Pattern 1: Display Match Badge
```javascript
const MatchBadge = ({ transaction }) => {
  const matchType = matchCompat.getMatchType(transaction);
  const confidence = matchCompat.getMatchConfidence(transaction);

  if (!matchType) return null;

  return (
    <Badge variant={matchType === 'transfer' ? 'blue' : 'green'}>
      {matchType === 'transfer' ? '↔️ Transfer' : '💳 CC Payment'}
      {confidence && ` (${confidence}%)`}
    </Badge>
  );
};
```

### Pattern 2: Show Unreviewed Count
```javascript
const UnreviewedBadge = ({ transactions }) => {
  const count = matchCompat.getUnreviewedMatchCount(transactions);

  if (count === 0) return null;

  return (
    <Badge variant="warning">
      {count} match{count === 1 ? '' : 'es'} to review
    </Badge>
  );
};
```

### Pattern 3: Match/Unmatch Button
```javascript
const MatchButton = ({ transaction, allTransactions }) => {
  const matching = useUnifiedMatching(profileId, userId);

  if (matching.isPaired(transaction)) {
    return (
      <Button onClick={() => matching.unmatch(transaction.id)}>
        Unmatch
      </Button>
    );
  }

  return (
    <Button onClick={async () => {
      const suggestions = await matching.getSuggestedMatches(transaction.id);
      // Show suggestions dialog
    }}>
      Find Match
    </Button>
  );
};
```

---

## Migration Notes

### Old Code (Still Works)
```javascript
// Legacy API
import { transferAutoDetectionAPI } from '@/api/transferAutoDetection';

const { data } = await transferAutoDetectionAPI.detectTransfers(profileId);
```

### New Code (Recommended)
```javascript
// Unified API
import { matchingAPI } from '@/api/matchingAPI';

const { data } = await matchingAPI.detectMatches(profileId);
```

### Why Migrate?
- ✅ Single API call instead of two
- ✅ Handles both transfer and CC payment matching
- ✅ Simpler error handling
- ✅ Better performance
- ✅ Easier to maintain

---

## Troubleshooting

### Issue: "Cannot find paired transaction"
**Solution:** Use compatibility layer which checks both old and new columns:
```javascript
const paired = matchCompat.findPairedTransaction(transaction, allTransactions);
```

### Issue: "Match confidence is null"
**Solution:** Check both old and new fields:
```javascript
const confidence = matchCompat.getMatchConfidence(transaction);
```

### Issue: "Detection not finding matches"
**Solution:** Verify transaction dates are within window (3 days for transfers, 5 for CC payments) and amounts are exactly opposite.

---

## Performance Tips

1. **Use batch detection** instead of per-transaction:
   ```javascript
   // Good
   await matching.detectMatches(allNewTransactionIds);

   // Bad
   for (const id of ids) {
     await matching.detectMatches([id]);
   }
   ```

2. **Check pairing locally** before API calls:
   ```javascript
   if (!matching.isPaired(transaction)) {
     // Only then call API
   }
   ```

3. **Use compatibility functions** to avoid multiple field checks:
   ```javascript
   // Good
   if (matchCompat.isMatched(txn)) { ... }

   // Bad
   if (txn.paired_transaction_id || txn.transfer_pair_id || txn.cc_payment_pair_id) { ... }
   ```

---

## Questions?

Refer to:
- Full implementation details: `UNIFIED_MATCHING_IMPLEMENTATION.md`
- Original system documentation: (see code review output above)
- Database schema: `supabase/migrations/[timestamp]_create_unified_matching_system.sql`
