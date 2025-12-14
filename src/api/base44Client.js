import { createClient } from '@base44/sdk';
// import { getAccessToken } from '@base44/sdk/utils/auth-utils';

// Create a client with authentication required
export const base44 = createClient({
  appId: "691922f27f68103164a7760e", 
  requiresAuth: true // Ensure authentication is required for all operations
});
