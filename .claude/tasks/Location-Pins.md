# Goal Description

Implement the **Location Pins** feature (Phase 2, Feature 2). 
Whenever a user saves a new item (note, link, or media), the app will request geolocation permissions, capture the user's current coordinates (latitude & longitude), and automatically reverse-geocode them to a human-readable address. This location data will be stored with the item and displayed as a small pin on the item card.

## User Review Required

We need to decide on a reverse-geocoding service. I plan to use the free **OpenStreetMap Nominatim API** since it doesn't require any API keys or setup on your part. It's free but has rate limits. 

## Open Questions

- **Reverse Geocoding:** Are you okay with using the free OpenStreetMap (Nominatim) API for reverse geocoding, or do you have a Google Maps/Mapbox API key you'd prefer to use?
- **Permission Prompt:** Do you want the app to ask for location permission *every time* an item is created, or just once (and remember the choice)? (Usually, the browser/OS handles the "remember" part, but we can also add a toggle in the UI to turn location tagging on/off globally).

## Proposed Changes

### 1. Database Schema
#### [NEW] `supabase/migrations/20260729153000_add_location.sql`
- Create a migration to add a `location jsonb` column to the `items` table.
- Push the migration to the remote database using `npx supabase db push`.

### 2. Models & Services
#### [MODIFY] `item.model.ts`
- Add `location: { lat: number; lng: number; address: string } | null` to the `Item` interface.

#### [NEW] `location.service.ts`
- Create a new Angular service to handle:
  - Requesting browser `navigator.geolocation` permissions.
  - Fetching the current coordinates.
  - Calling the reverse-geocoding API to get a readable address string (e.g., "Koramangala, Bengaluru").

#### [MODIFY] `items.service.ts`
- Update `addText`, `addLink`, and `addMedia` methods to call the `location.service.ts` before inserting the item into Supabase, and attach the location data to the insert payload.

### 3. UI Updates
#### [MODIFY] `item-card.component.html` & `.scss`
- Add a small location pin icon (📍) and the address string to the footer or header of the item card (next to the date/timestamp).

## Verification Plan
### Manual Verification
- Create a new text note in the app.
- Accept the browser/OS prompt for location permission.
- Verify that the item appears in the feed with a location pin and a correct address.
- Verify that items created without location permission (or when denied) still save successfully without crashing.
