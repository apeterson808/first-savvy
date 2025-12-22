# Plaid Integration Setup Guide

This guide will help you set up Plaid integration for bank account connections.

## Prerequisites

1. A Plaid account ([Sign up here](https://dashboard.plaid.com/signup))
2. Plaid API credentials (Client ID and Secret)

## Step 1: Get Plaid Credentials

1. Go to [Plaid Dashboard](https://dashboard.plaid.com/)
2. Sign in or create a new account
3. Navigate to **Team Settings** > **Keys**
4. Copy your:
   - `client_id`
   - `sandbox` secret (for development) or `development`/`production` secret

## Step 2: Configure Supabase Edge Functions

You need to add your Plaid credentials as secrets in Supabase:

1. Go to your [Supabase Dashboard](https://app.supabase.com/)
2. Select your project
3. Navigate to **Edge Functions** > **Settings**
4. Add the following secrets:
   - `PLAID_CLIENT_ID`: Your Plaid client ID
   - `PLAID_SECRET`: Your Plaid secret key
   - `PLAID_ENV`: Environment (`sandbox`, `development`, or `production`)

## Step 3: Deploy Edge Functions

The following edge functions need to be deployed:

- `plaid-create-link-token` - Creates Plaid Link tokens for authentication
- `plaid-exchange-token` - Exchanges public tokens for access tokens
- `plaid-get-accounts` - Fetches account details from Plaid
- `plaid-import-transactions` - Imports transactions from Plaid

These functions are already created in your `supabase/functions` directory.

## Step 4: Test the Integration

1. Start your development server: `npm run dev`
2. Log in to your application
3. Navigate to Banking > Add Account
4. Select "Connect Bank Account"
5. Choose a financial institution
6. Click "Continue with Plaid"
7. Complete the Plaid Link flow
8. Map your accounts and import transactions

## Development vs Production

### Sandbox Environment (Development)
- Use `sandbox` credentials for testing
- No real bank connections
- Use test credentials provided by Plaid
- Free to use

### Development Environment
- Connect to real financial institutions
- Limited to 100 unique Items
- Requires verification with Plaid

### Production Environment
- Full access to all financial institutions
- Requires Plaid approval
- Production-ready credentials

## Plaid Test Credentials (Sandbox)

When testing in sandbox mode, use these credentials:
- Username: `user_good`
- Password: `pass_good`
- MFA: `1234` (if prompted)

## Troubleshooting

### "Plaid credentials not configured" Error
- Ensure you've added all three secrets to Supabase Edge Functions
- Verify the secret names match exactly: `PLAID_CLIENT_ID`, `PLAID_SECRET`, `PLAID_ENV`
- Redeploy the edge functions after adding secrets

### "Failed to create link token" Error
- Check that your Plaid Client ID and Secret are correct
- Verify your Plaid account is active
- Ensure you're using the correct environment (sandbox/development/production)

### Transactions Not Importing
- Verify the account mapping was completed successfully
- Check that the date ranges are valid
- Look at the browser console for error messages
- Check Supabase Edge Function logs

## How the Flow Works

1. **User selects institution**: User searches and selects their bank
2. **Plaid Link opens**: PlaidLinkButton creates a link token and opens Plaid Link
3. **User authenticates**: User logs in to their bank through Plaid
4. **Token exchange**: Public token is exchanged for access token
5. **Account mapping**: User maps Plaid accounts to local accounts
6. **Transaction import**: Historical transactions are imported based on date ranges

## Support

For Plaid-specific issues:
- [Plaid Documentation](https://plaid.com/docs/)
- [Plaid Support](https://dashboard.plaid.com/support)

For application issues:
- Check Supabase Edge Function logs
- Review browser console errors
- Verify database permissions and RLS policies
