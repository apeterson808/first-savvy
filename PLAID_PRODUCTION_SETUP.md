# Plaid Production Setup Guide

This guide walks you through setting up Plaid for production use.

## Overview

Your application already has all Plaid edge functions deployed and ready. You just need to configure production credentials.

## Step 1: Get Plaid Production Access

### Apply for Production Access
1. Go to [Plaid Dashboard](https://dashboard.plaid.com/)
2. Navigate to **Team Settings** > **Production Access**
3. Complete the production access application:
   - Company information
   - Use case details
   - Expected transaction volume
   - Security and compliance information
4. Wait for Plaid approval (typically 1-3 business days)

### Get Your Production Credentials
1. Once approved, go to **Team Settings** > **Keys**
2. Copy your credentials:
   - `client_id` (same for all environments)
   - `production` secret key

## Step 2: Configure Supabase Secrets

### Add Secrets to Supabase
1. Go to [Supabase Dashboard](https://app.supabase.com/project/lfisuvkmkwsublkiyimv)
2. Navigate to **Project Settings** > **Edge Functions** (in the left sidebar)
3. Scroll to the **Secrets** section
4. Add these three secrets:

   | Secret Name | Value | Example |
   |-------------|-------|---------|
   | `PLAID_CLIENT_ID` | Your Plaid client ID | `6abc123def456` |
   | `PLAID_SECRET` | Your production secret | `a1b2c3d4e5f6...` |
   | `PLAID_ENV` | `production` | `production` |

**Important**: Make sure the secret names match exactly (case-sensitive).

## Step 3: Configure Webhooks (Recommended)

Webhooks enable automatic transaction syncing in production.

### Set Up Webhook URL in Plaid Dashboard
1. Go to [Plaid Dashboard](https://dashboard.plaid.com/)
2. Navigate to **Team Settings** > **Webhooks**
3. Add your webhook URL:
   ```
   https://lfisuvkmkwsublkiyimv.supabase.co/functions/v1/plaid-webhook
   ```
4. Enable these webhook types:
   - **TRANSACTIONS**: `DEFAULT_UPDATE`, `INITIAL_UPDATE`, `HISTORICAL_UPDATE`, `TRANSACTIONS_REMOVED`
   - **ITEM**: `ERROR`, `PENDING_EXPIRATION`, `USER_PERMISSION_REVOKED`

### Webhook Benefits
- ✅ Automatic transaction updates when new data is available
- ✅ Immediate notification of connection issues
- ✅ Better user experience with real-time data
- ✅ Reduced API calls (more efficient)

## Step 4: Verify Deployment

All required edge functions are deployed:
- ✅ `plaid-create-link-token` - Creates Plaid Link tokens
- ✅ `plaid-exchange-token` - Exchanges public tokens for access tokens
- ✅ `plaid-get-accounts` - Fetches account details
- ✅ `plaid-import-transactions` - Imports historical transactions
- ✅ `plaid-sync-transactions` - Syncs new/modified transactions (webhook-driven)
- ✅ `plaid-webhook` - Receives webhook notifications from Plaid

### Production Features Enabled
- ✅ Support for all account types (checking, savings, credit cards, loans, mortgages)
- ✅ Extended transaction history (up to 2 years)
- ✅ Automatic webhook-driven syncing
- ✅ Real-time error notifications
- ✅ Identity and liabilities data collection

## Step 5: Test Production Integration

### Testing Checklist
1. **Launch the app**: Access your production application
2. **Connect a bank**:
   - Navigate to Banking > Add Account
   - Click "Connect Bank Account"
   - Select your financial institution
   - Click "Continue with Plaid"
3. **Authenticate**: Log in with your real bank credentials
4. **Map accounts**: Match Plaid accounts to your local accounts
5. **Import transactions**: Select date ranges and import

### Expected Behavior
- Plaid Link should open with real financial institutions
- You can authenticate with actual bank credentials
- Transaction data should sync from your real accounts
- All transactions should appear in your application

## Step 6: Monitoring and Maintenance

### Monitor Edge Function Logs
1. Go to Supabase Dashboard > **Edge Functions**
2. Click on each Plaid function to view logs
3. Look for errors or warnings

### Check Plaid Dashboard
1. Go to [Plaid Dashboard](https://dashboard.plaid.com/)
2. Navigate to **Activity** to see API usage
3. Monitor for errors or rate limit warnings

### Common Production Issues

#### Issue: "Plaid credentials not configured"
**Solution**: Verify secrets are set correctly in Supabase
- Check secret names match exactly (case-sensitive)
- Ensure `PLAID_ENV` is set to `production`

#### Issue: "Invalid credentials"
**Solution**: Verify you're using production credentials
- Make sure you copied the `production` secret (not sandbox/development)
- Confirm your client ID is correct

#### Issue: Institution not available
**Solution**: Check Plaid production coverage
- Not all institutions available in sandbox are in production
- Some institutions require additional approval

#### Issue: Rate limits exceeded
**Solution**: Review your Plaid plan limits
- Production has different rate limits than sandbox
- Consider upgrading your Plaid plan if needed

## Environment Comparison

| Feature | Sandbox | Development | Production |
|---------|---------|-------------|------------|
| Real banks | ❌ Test only | ✅ Yes | ✅ Yes |
| Test credentials | ✅ user_good/pass_good | ❌ No | ❌ No |
| Item limit | Unlimited | 100 items | Unlimited |
| Approval needed | ❌ No | ⚠️ Verification | ✅ Full approval |
| Cost | Free | Free | Paid |

## Security Best Practices

### Protecting Secrets
- ✅ Secrets are stored in Supabase (secure)
- ✅ Never commit secrets to Git
- ✅ Never expose secrets in client-side code
- ✅ Edge functions run server-side (secure)

### User Data Protection
- All Plaid tokens are encrypted in transit
- Access tokens are stored securely in database
- RLS policies ensure users only access their own data
- Regular security audits recommended

## Support Resources

### Plaid Support
- [Plaid Documentation](https://plaid.com/docs/)
- [Plaid API Reference](https://plaid.com/docs/api/)
- [Plaid Status Page](https://status.plaid.com/)
- [Plaid Support](https://dashboard.plaid.com/support)

### Application Support
- Check Supabase Edge Function logs
- Review browser console for client-side errors
- Verify database RLS policies
- Test with sandbox first, then production

## Migration Path

### From Sandbox to Production

1. **Test thoroughly in sandbox**
   - Verify all flows work
   - Test error handling
   - Confirm transaction import

2. **Apply for production access**
   - Complete Plaid application
   - Wait for approval

3. **Update secrets**
   - Change `PLAID_ENV` to `production`
   - Update `PLAID_SECRET` to production key

4. **Test with real account**
   - Connect one real account
   - Verify transaction import
   - Monitor for errors

5. **Roll out to users**
   - Announce new feature
   - Provide user documentation
   - Monitor for issues

## Troubleshooting Commands

### Check if secrets are set (via Supabase CLI)
```bash
supabase secrets list
```

### View edge function logs
```bash
supabase functions logs plaid-create-link-token
```

### Test a function locally
```bash
supabase functions serve plaid-create-link-token
```

## Next Steps

1. ✅ Complete Steps 1-2 above (get credentials, set secrets)
2. ✅ Test with your own bank account
3. ✅ Monitor logs for any issues
4. ✅ Roll out to production users

---

**Need Help?** Check the Plaid Dashboard logs and Supabase Edge Function logs for detailed error messages.
