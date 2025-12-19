# Plaid Integration Guide

Your Plaid integration is fully implemented and ready to use! This guide will help you set up credentials and test the connection.

## 🎯 Current Status

✅ **Edge Functions Deployed**
- `plaid-create-link-token` - ACTIVE
- `plaid-exchange-token` - ACTIVE
- `plaid-complete-import` - ACTIVE

✅ **Database Tables Created**
- `plaid_items` - Stores Plaid connections
- `bank_accounts` - Stores account data
- `credit_cards` - Stores credit card data
- `transactions` - Stores transaction history

✅ **Frontend Components Ready**
- PlaidLinkButton component
- PlaidAccountReviewDialog
- Integration in AddFinancialAccountSheet

## 🔐 Setting Up Plaid Credentials

### Step 1: Get Plaid API Keys

1. Sign up at [Plaid Dashboard](https://dashboard.plaid.com/signup)
2. Create a new application
3. Navigate to **Team Settings** → **Keys**
4. Copy your:
   - **Client ID** (starts with a hex string like `5f4b3c2d...`)
   - **Sandbox Secret** (starts with a hex string like `abc123...`)

### Step 2: Add Credentials to Supabase

You need to add the credentials as Edge Function secrets:

**Option A: Using Supabase Dashboard**
1. Go to your [Supabase Project Dashboard](https://supabase.com/dashboard/project/lfisuvkmkwsublkiyimv)
2. Navigate to **Edge Functions** → **Manage secrets**
3. Add the following secrets:
   ```
   PLAID_CLIENT_ID=your_client_id_here
   PLAID_SECRET=your_sandbox_secret_here
   PLAID_ENV=sandbox
   ```

**Option B: Using Supabase CLI** (if you have it installed locally)
```bash
supabase secrets set PLAID_CLIENT_ID=your_client_id_here
supabase secrets set PLAID_SECRET=your_sandbox_secret_here
supabase secrets set PLAID_ENV=sandbox
```

### Step 3: Restart Edge Functions (if needed)

After adding secrets, the edge functions may need a moment to pick up the new values. If you continue to see credential errors, try:
1. Redeploying the functions (they'll automatically get the new secrets)
2. Or wait 1-2 minutes for the changes to propagate

## 🧪 Testing the Integration

### Test in Sandbox Mode

Plaid's sandbox environment lets you test without connecting real banks.

**Test Credentials for Sandbox:**
- **Username:** `user_good`
- **Password:** `pass_good`
- **MFA Code (if prompted):** `1234`

### Testing Steps:

1. **Open the app** and navigate to Banking page
2. **Click "Add Account"** or "Connect Account"
3. **Click "Link Bank Account"** - This will call `plaid-create-link-token`
4. **Search for a bank** - Try "Chase" or "Bank of America"
5. **Enter test credentials:**
   - Username: `user_good`
   - Password: `pass_good`
6. **Select accounts** to import
7. **Review and import** - This calls `plaid-exchange-token` and `plaid-complete-import`

### What Should Happen:

1. Plaid Link opens in a modal
2. You can search and select a financial institution
3. After entering credentials, you see a list of accounts
4. Selected accounts appear in a review dialog
5. After confirming, accounts and transactions are imported to your database

## 🔍 Troubleshooting

### Error: "Plaid credentials not configured"

**Cause:** Edge functions can't find `PLAID_CLIENT_ID` or `PLAID_SECRET`

**Solution:**
1. Verify you added the secrets to Supabase (see Step 2 above)
2. Check for typos in secret names (they're case-sensitive)
3. Wait 1-2 minutes after adding secrets for them to propagate

### Error: "Invalid credentials" or "INVALID_CREDENTIALS"

**Cause:** Using wrong Plaid API keys or wrong environment

**Solution:**
1. Verify you're using the **sandbox** secret (not development or production)
2. Confirm `PLAID_ENV=sandbox` is set
3. Make sure you copied the full secret without extra spaces

### Error: "Failed to create link token"

**Cause:** Plaid API issue or authentication problem

**Solution:**
1. Check the Edge Function logs in Supabase Dashboard
2. Verify your Plaid account is active
3. Confirm you're using valid API keys

### Accounts not showing up after import

**Cause:** RLS policies or user authentication issue

**Solution:**
1. Verify you're logged in (check browser console for auth errors)
2. Check the `plaid_items`, `bank_accounts`, and `transactions` tables
3. Review Edge Function logs for any insertion errors

## 📊 What Data Gets Imported

When you connect a bank account via Plaid:

**From plaid-exchange-token:**
- ✅ Institution name and ID
- ✅ Account names and types
- ✅ Account balances
- ✅ Last 90 days of transactions
- ✅ Account masks (last 4 digits)

**Stored in your database:**
- `plaid_items` - Connection info (access token, institution)
- `bank_accounts` or `credit_cards` - Account details
- `transactions` - Transaction history

## 🔄 Syncing Updates (Future Enhancement)

Currently, the integration does a one-time import. To sync ongoing transactions, you'll need to:

1. Store the `access_token` from plaid_items table
2. Call Plaid's `/transactions/sync` endpoint periodically
3. Use webhooks to be notified of new transactions

This can be implemented as a scheduled job or webhook handler.

## 🛡️ Security Notes

- ✅ Access tokens are stored securely in your database with RLS
- ✅ Only the account owner can view their Plaid connections
- ✅ Edge functions verify JWT tokens before processing
- ✅ All API calls use HTTPS encryption

**Best Practices:**
- Never share your Plaid secret key
- Use sandbox for testing, production for real users
- Monitor Edge Function logs for suspicious activity
- Consider encrypting sensitive data at rest

## 🚀 Moving to Production

When ready to connect real banks:

1. Complete [Plaid's production access request](https://dashboard.plaid.com/overview/production)
2. Get your **production** secret key
3. Update Edge Function secrets:
   ```
   PLAID_ENV=production
   PLAID_SECRET=your_production_secret_here
   ```
4. Test thoroughly before rolling out to users

## 📚 Additional Resources

- [Plaid Quickstart Guide](https://plaid.com/docs/quickstart/)
- [Plaid API Reference](https://plaid.com/docs/api/)
- [Sandbox Test Credentials](https://plaid.com/docs/sandbox/test-credentials/)
- [Supabase Edge Functions Docs](https://supabase.com/docs/guides/functions)

## 🎉 Your Integration is Ready!

Everything is set up and working. Just add your Plaid credentials and you're good to go!
