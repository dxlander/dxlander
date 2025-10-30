# Configuration Deletion Feature

## Overview

The configuration deletion feature allows users to delete individual build configurations from a project, rather than only being able to delete the entire project. This provides more granular control and prevents unnecessary data loss when only specific configurations need to be removed.

## Implementation Details

### Frontend

The deletion functionality is implemented in the following components:

1. **Build Configurations Page** (`apps/web/app/project/[id]/configs/page.tsx`):
   - Each configuration card includes a delete button (trash icon)
   - Clicking the delete button opens the confirmation dialog
   - The page manages the state of the selected configuration and dialog visibility

2. **Delete Configuration Dialog** (`apps/web/components/configuration/delete-dialog.tsx`):
   - Provides a confirmation mechanism to prevent accidental deletions
   - Requires users to type the configuration name and version to confirm deletion
   - Displays warnings about the consequences of deletion
   - Calls the TRPC mutation to delete the configuration

### Backend

The deletion functionality is implemented in the following services:

1. **Configs Router** (`apps/api/src/routes/configs.ts`):
   - Exposes a `delete` mutation that accepts a configuration ID
   - Validates user permissions before allowing deletion

2. **Config Generation Service** (`apps/api/src/services/config-generation.service.ts`):
   - Implements the `deleteConfigSet` method that:
     - Verifies the configuration exists and belongs to the user's project
     - Deletes all associated configuration files from the database
     - Removes the configuration set record from the database

## User Workflow

1. User navigates to the project's build configurations page
2. User clicks the delete (trash) icon on the configuration they want to remove
3. A confirmation dialog appears with details about the configuration to be deleted
4. User must type the configuration type and version (e.g., "docker v1") to confirm
5. User clicks the "Delete Configuration" button
6. The system deletes the configuration and all associated files
7. The configurations list is automatically refreshed to reflect the change
8. A success message is displayed to the user

## Edge Cases Handled

1. **Deleting the Last Configuration**:
   - The system allows deletion of the last configuration
   - The project status remains unchanged

2. **Configurations in Use by Deployments**:
   - The system warns users that existing deployments won't be affected
   - Users won't be able to redeploy with the deleted configuration

3. **Permission Validation**:
   - The system verifies that users can only delete configurations from their own projects
   - Unauthorized deletion attempts are rejected

## Security Considerations

- All deletion operations are protected by authentication
- Users can only delete configurations from projects they own
- Confirmation dialog prevents accidental deletions
- All operations are logged for audit purposes

## Testing

Unit tests verify:

- The delete dialog renders correctly
- Validation works properly
- TRPC mutations are called with correct parameters
- Success and error handling work as expected

Integration tests verify:

- The backend delete service functions correctly
- Database records are properly removed
- Associated files are cleaned up

## API Endpoints

### TRPC Mutation

```
configs.delete({ id: string })
```

Parameters:

- `id`: The ID of the configuration set to delete

Returns:

- `{ success: true }` on successful deletion
- Throws an error on failure

## Future Enhancements

1. **Bulk Deletion**: Allow users to select multiple configurations for deletion
2. **Configuration Restore**: Implement a trash/recycle bin feature for configurations
3. **Audit Logging**: Track all configuration deletion activities
4. **Soft Delete**: Implement soft delete with retention period before permanent removal
