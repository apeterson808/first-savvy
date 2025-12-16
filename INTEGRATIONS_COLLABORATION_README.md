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
- Bank account syncing via Plaid
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
