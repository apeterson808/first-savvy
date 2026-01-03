# External Integrations & User Collaboration System

## Overview

A comprehensive system for connecting external services (Amazon, Netflix, Spotify, etc.) and enabling multi-user collaboration through households, relationships, and resource sharing.

## Database Schema

### Tables Created

#### 1. service_connections
Stores third-party service integrations with OAuth support and credential management.

**Key Features:**
- OAuth token management (access/refresh tokens with expiry)
- Alternative credential types (API keys, username/password)
- Connection status tracking (active, expired, error, disconnected)
- Sync history and metadata storage
- Per-user service connections

#### 2. user_relationships
Manages connections between users with different relationship types.

**Relationship Types:**
- Spouse
- Partner
- Family
- Roommate
- Friend

**Features:**
- Bidirectional relationships
- Status tracking (pending, accepted, declined, blocked)
- Customizable permissions per relationship
- Accept/decline workflow

#### 3. shared_resources
Granular permission control for sharing specific resources between users.

**Shareable Resources:**
- Accounts
- Categories
- Budgets
- Contacts
- Transactions

**Permission Levels:**
- View only
- Edit
- Full management

#### 4. household_groups
Multi-user household management for families, roommates, and couples.

**Features:**
- Multiple household types (family, roommates, couple)
- Custom household settings
- Creator tracking
- Update triggers for audit trail

#### 5. household_members
Links users to households with role-based access control.

**Roles:**
- Admin (full management)
- Member (standard access)
- Viewer (read-only)

**Features:**
- Join date tracking
- Unique member constraint per household
- Cascade deletion when household is removed

#### 6. invitations
Secure invitation system with token-based acceptance.

**Invitation Types:**
- User connection
- Household member
- Shared resource

**Features:**
- Secure UUID tokens
- 7-day default expiration
- Email and optional phone targeting
- Status tracking (pending, accepted, expired, cancelled)
- Relationship metadata for context

## Security

### Row Level Security (RLS)

All tables have comprehensive RLS policies:

**service_connections:** Users can only access their own connections
**user_relationships:** Both parties in relationship can view/manage
**shared_resources:** Owner has full control, shared user can view
**household_groups:** Members can view, admins can manage
**household_members:** Members can view household roster
**invitations:** Inviters can manage their sent invitations

### Demo Mode Support

All policies use `COALESCE(auth.uid(), user_id)` pattern to support both authenticated and anonymous demo usage while maintaining proper security when auth is enabled.

## API Layer

### Service Integrations API (`/src/api/serviceIntegrations.js`)

**Functions:**
- `connectService()` - Connect to external service
- `getMyConnections()` - List all active connections
- `getConnectionByService()` - Get specific service connection
- `updateConnection()` - Update connection details
- `updateConnectionStatus()` - Change connection status
- `refreshToken()` - Update OAuth tokens
- `updateLastSync()` - Track sync timestamp
- `updateMetadata()` - Store service-specific data
- `disconnectService()` - Deactivate connection
- `deleteConnection()` - Permanently remove
- `getActiveConnections()` - List active only
- `getExpiredConnections()` - Find expired tokens
- `syncService()` - Trigger service sync

### Collaboration API (`/src/api/collaboration.js`)

**Household Management:**
- `createHousehold()` - Create new household with creator as admin
- `getMyHouseholds()` - List households user belongs to
- `getHouseholdMembers()` - List members in household
- `addHouseholdMember()` - Add user to household
- `updateMemberRole()` - Change member role
- `removeHouseholdMember()` - Remove member

**Invitations:**
- `sendInvitation()` - Send email invitation
- `getMyInvitations()` - List sent invitations
- `getInvitationByToken()` - Retrieve by token
- `acceptInvitation()` - Accept and process invitation
- `cancelInvitation()` - Cancel pending invitation

**Relationships:**
- `createRelationship()` - Initiate connection
- `getMyRelationships()` - List all relationships
- `updateRelationship()` - Modify relationship
- `acceptRelationship()` - Accept pending
- `declineRelationship()` - Decline request
- `blockRelationship()` - Block user
- `deleteRelationship()` - Remove connection

**Resource Sharing:**
- `shareResource()` - Share resource with user
- `getSharedWithMe()` - Resources shared to me
- `getMySharedResources()` - Resources I've shared
- `updateResourcePermission()` - Change permission level
- `unshareResource()` - Revoke sharing

## Contact Connection Detection

### Overview
The contacts system now includes intelligent account detection that checks if email addresses or phone numbers belong to existing platform users. When adding or editing contacts, the system automatically:
- Detects if the email/phone matches a registered user
- Offers to send connection requests to existing users
- Allows sending invitations to non-users
- Tracks connection status throughout the contact lifecycle

### Database Schema Enhancement

#### contacts table additions
- `connection_status` - Tracks connection state (not_checked, platform_user, invited, connected)
- `linked_user_id` - References the platform user if detected
- `invitation_id` - Links to invitation record if sent
- `last_account_check` - Timestamp of last account lookup

### Account Detection Service (`/src/api/accountDetection.js`)

**Functions:**
- `checkEmailForAccount()` - Queries auth.users by email
- `checkPhoneForAccount()` - Queries auth.users by phone
- `checkExistingConnection()` - Verifies if connection already exists
- `debounce()` - Rate limiting for input-triggered checks

**Features:**
- Automatic debounced checking while typing
- Fast indexed lookups on email/phone
- Returns user profile data when found
- Graceful error handling

### UI Components

#### AccountDetectionField Component
Reusable component that displays account detection results and actions.

**Display States:**
- Loading spinner during account lookup
- "Account found" alert with Connect button
- "No account found" alert with Invite button
- Success confirmation after action taken

**Features:**
- Auto-triggers on valid email or 10-digit phone
- Disabled state for already-connected contacts
- Visual feedback with color-coded alerts
- Icon-based status indicators

#### Contact Form Enhancements
Both the Add Contact sheet and Contact Detail sheet include:
- Helper text explaining account detection
- Real-time account checking on email/phone input
- Connect button when platform user detected
- Invite button when no account found
- Connection status badges in list and detail views

### Connection Status Badges

**Status Types:**
- **Connected** (blue) - Active user relationship established
- **Invited** (yellow) - Invitation sent, awaiting acceptance
- **On Platform** (purple) - User detected but not yet connected
- **-** (gray) - Not checked or no account found

Displayed in:
- Contacts table (new Connection column)
- Contact detail header
- Searchable/filterable in future enhancements

### Invitation Notification System

#### Edge Function: send-invitation-notification
Handles automated email/SMS notifications when invitations are sent.

**Features:**
- Generates secure invitation links with tokens
- Supports both email and SMS delivery
- Includes inviter information
- 7-day expiration links
- CORS-enabled for frontend calls

**Request Body:**
```json
{
  "invitationId": "uuid",
  "inviterName": "string",
  "inviteeEmail": "optional-email",
  "inviteePhone": "optional-phone",
  "invitationType": "user_connection",
  "invitationToken": "uuid"
}
```

**Integration:**
- Called automatically after invitation creation
- Non-blocking (errors don't fail invitation creation)
- Logs notification attempts
- Returns delivery confirmation

### Workflow Examples

#### Scenario 1: Existing Platform User
1. User adds contact with email address
2. System detects matching platform user
3. "Account found" alert appears with user name
4. User clicks Connect button
5. User relationship created with pending status
6. Contact marked as "Connected"
7. Connection request notification sent (future)

#### Scenario 2: Non-Platform User
1. User adds contact with email
2. System finds no matching account
3. "No account found" alert appears
4. User clicks Invite button
5. Invitation record created with token
6. Edge function sends invitation email
7. Contact marked as "Invited"
8. When invitee accepts, relationship auto-created

#### Scenario 3: Edit Existing Contact
1. User opens contact detail sheet
2. Updates email address in edit mode
3. Account detection runs on new email
4. Connect/Invite options appear if applicable
5. Action taken updates connection status
6. Contact saved with new linked_user_id

### Security Considerations

**Account Lookups:**
- Only searches auth.users table (no sensitive data exposed)
- Returns minimal user info (id, email/phone, name)
- No password or token information returned
- Respects RLS policies on relationships table

**Invitations:**
- Secure UUID tokens prevent guessing
- 7-day expiration reduces attack window
- Single-use tokens (future enhancement)
- Email/phone validation before sending
- Rate limiting on edge function calls

**Connections:**
- Requires authentication to create relationships
- Both parties must accept connection
- Permissions controlled via user_relationships
- Cannot force connections without consent

### Performance Optimizations

**Database Indexes:**
- `idx_contacts_email` - Fast email lookups
- `idx_contacts_phone` - Fast phone lookups
- `idx_contacts_connection_status` - Status filtering
- `idx_contacts_linked_user_id` - Join optimization

**Frontend Optimizations:**
- Debounced input checking (800ms delay)
- Prevents excessive API calls during typing
- Caches detection results during session
- Disabled state prevents duplicate actions

### Future Enhancements

**Account Detection:**
- Batch checking for imported contacts
- Automatic periodic re-checking
- Smart suggestions based on transaction patterns
- Social graph recommendations

**Invitations:**
- Reminder emails for pending invitations
- Custom invitation messages
- Multi-contact bulk invitations
- QR code invitation links
- SMS delivery integration

**Connections:**
- Connection request notifications
- Activity feed for relationship changes
- Connection strength indicators
- Mutual connection suggestions
- Permission templates per relationship type

### Testing Recommendations

1. **Account Detection:**
   - Test with valid/invalid email formats
   - Verify phone number validation (10 digits)
   - Test debouncing with rapid typing
   - Verify duplicate connection prevention

2. **Invitations:**
   - Test email invitation delivery
   - Verify token uniqueness
   - Test expiration handling
   - Validate invitation acceptance flow

3. **Connection Status:**
   - Verify status badge display accuracy
   - Test status transitions (not_checked → invited → connected)
   - Validate filtering by status
   - Test status persistence across sessions

4. **Edge Cases:**
   - User changes email after detection
   - Multiple contacts with same email
   - Invitation sent to already-registered user
   - Connection request to blocked user

## UI Components

### Integrations Page (`/src/pages/Integrations.jsx`)

**Available Services:**
- Amazon (order history import)
- Netflix (subscription tracking)
- Spotify (OAuth integration)
- Robinhood (investment tracking)

**Features:**
- Service connection cards with status badges
- One-click connect/disconnect
- Manual sync triggers
- Connection health monitoring
- Last sync timestamps
- Error state handling

**Visual Design:**
- Service-specific icons and colors
- Real-time connection status
- Loading states for async operations
- Toast notifications for feedback

### Collaboration Page (`/src/pages/Collaboration.jsx`)

**Four Main Tabs:**

1. **Households**
   - View all households
   - Create new households
   - Manage household members
   - Role-based access display

2. **Relationships**
   - List all user connections
   - Accept/decline pending requests
   - View relationship types
   - Status badges for each relationship

3. **Invitations**
   - Track sent invitations
   - View invitation status
   - Cancel pending invitations
   - Resend if needed

4. **Shared Resources**
   - View shared items
   - Permission level indicators
   - Quick unshare actions
   - Resource type display

**Features:**
- Dialog-based forms for creating households
- Email invitation modal
- Status badges with icons
- Permission level icons (View/Edit/Manage)
- Empty state messaging
- Real-time updates

## Navigation Integration

Added to sidebar navigation:
- **Integrations** (Cable icon) - Between Contacts and Collaboration
- **Collaboration** (UserCog icon) - Between Integrations and Password Vault

Routes registered in `/src/pages/index.jsx`

## Database Indexes

Optimized indexes for common query patterns:
- User-based lookups
- Service name searches
- Status filtering
- Relationship bidirectional queries
- Household member lookups
- Invitation token searches (unique)
- Shared resource queries

## Triggers

**Updated At Triggers:**
- `service_connections` - Auto-update timestamp
- `user_relationships` - Track modification time
- `household_groups` - Audit trail

## Future Enhancements

### Service Integration Ideas:
- Real Amazon OAuth integration
- Netflix API connection
- Spotify API for listening data
- Investment platforms (Robinhood, E*TRADE)
- Subscription tracking services
- Bill payment services

### Collaboration Features:
- Real-time collaboration notifications
- Activity feed for household changes
- Permission templates
- Bulk sharing operations
- Household budgets and goals
- Family transaction splitting
- Shared bill reminders

### Technical Improvements:
- Service sync scheduling
- Webhook handling for real-time updates
- OAuth token refresh automation
- Connection health checks
- Audit logging for sharing changes
- Permission inheritance patterns

## Testing Recommendations

1. **Service Connections:**
   - Test OAuth flow simulation
   - Verify token expiration handling
   - Validate connection status updates
   - Test sync operations

2. **Households:**
   - Create household as different users
   - Test role-based permissions
   - Verify member addition/removal
   - Test cascade deletion

3. **Relationships:**
   - Test bidirectional relationship queries
   - Verify accept/decline workflow
   - Test blocking functionality
   - Validate permission inheritance

4. **Invitations:**
   - Test email invitation flow
   - Verify token uniqueness
   - Test expiration logic
   - Validate auto-processing on accept

5. **Sharing:**
   - Test permission levels
   - Verify resource access control
   - Test unsharing
   - Validate RLS policies

## Security Considerations

- All tokens and credentials should be encrypted at rest
- OAuth refresh tokens need secure rotation
- Invitation tokens should be single-use
- RLS policies prevent unauthorized access
- Household permissions cascade properly
- Shared resource access is properly scoped

## API Integration Patterns

When adding new service integrations:

1. Add service to `AVAILABLE_SERVICES` in Integrations.jsx
2. Create connection via `serviceIntegrationsAPI.connectService()`
3. Store service-specific metadata in `metadata` jsonb field
4. Implement sync function to pull data
5. Update `last_sync_at` after successful sync
6. Handle token refresh for OAuth services
7. Update `connection_status` on errors

## Data Flow

**Service Connection:**
User clicks Connect → API creates service_connection record → Service authentication → Store tokens/credentials → Mark as active → Enable sync

**Household Creation:**
User creates household → household_groups record created → Creator added as admin to household_members → Can now invite others

**Invitation Flow:**
User sends invite → invitations record with token → Email sent → Recipient clicks link → Token validated → Invitation accepted → Relationship/membership created

**Resource Sharing:**
User selects resource → Chooses recipient from relationships → Sets permission level → shared_resources record created → Recipient gains access

## Performance Notes

- Indexes optimize common queries
- RLS policies use indexed columns
- Triggers are minimal and efficient
- JSONB fields indexed for metadata searches
- Cascade deletes prevent orphaned records
- Bidirectional relationship queries optimized

---

Built with Supabase, React, and TailwindCSS.
