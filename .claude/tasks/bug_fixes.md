# Bug Fixes & Technical Debt

## Tasks
- `[ ]` **Handle Missing Device Row on Insert**: 
  - **Issue**: If a user's device row is deleted from the `devices` table (e.g. during a DB cleanup) while the app is still running, attempting to insert new items fails with a PostgreSQL foreign key constraint violation (`items_source_device_id_fkey`) because the app uses a cached `device_id` that no longer exists in the database.
  - **Proposed Fix**: Add a retry mechanism or error handler in `ItemsService.addText()` and `addLink()`. If the insert fails due to a foreign key constraint on the device, automatically call `DevicesService.ensureThisDeviceRegistered()` to force re-registration and obtain a valid device ID, then retry the insert.
