# MCP Server Installation Component Analysis

## Current State Management

### State Variables

- `deps`: Dependencies status from store
- `hasApiKey`: Boolean for API key availability
- `status`: Installation status object with properties:
  - `isInstalled`: Boolean
  - `isInstalling`: Boolean
  - `version`: String (optional)
  - `path`: String (optional)
  - `dir`: String (optional)
  - `updateAvailable`: Boolean (optional)

### Side Effects

1. Component Mount

   - Load dependencies via `loadDependencies(plugin)`
   - Check API key availability
   - Get installation status

2. Installation Process

   - Verify API key
   - Install MCP server
   - Update Claude config
   - Update status

3. Uninstallation Process
   - Remove binary
   - Remove Claude config
   - Update status

## UI States

### Installation Status Section

1. Not Installed

   - Show "Install" button if API key present
   - Show API key error message if missing

2. Installing

   - Show loading message

3. Installed

   - Show version
   - Show "Uninstall" button

4. Update Available
   - Show current version
   - Show "Update" button if API key present
   - Show API key error if missing

### Dependencies Section

For each dependency:

- Show name
- Show required/optional status
- Show installation status
- Show install link if not installed

### Resources Section

- Server install folder link (conditional on status.path)
- Log folder link
- GitHub repository link

## Component Requirements

### Core Functionality

1. Installation Management

   - Handle installation with proper error handling
   - Manage uninstallation cleanup
   - Support version updates

2. Dependency Tracking

   - Monitor required/optional dependencies
   - Provide installation links
   - Track dependency status changes

3. Status Management
   - Track installation state
   - Handle version information
   - Monitor update availability

### UI Requirements

1. Progressive Disclosure

   - Show relevant controls based on state
   - Provide clear feedback for actions
   - Display appropriate error messages

2. Resource Access
   - Direct links to important folders
   - External resource links
   - Documentation access

## Proposed XState Machine Structure

### Download Progress Requirements

1. Progress Information

   - Bytes downloaded
   - Total bytes
   - Percentage complete
   - Current status message

2. Progress States

   - Not started
   - Downloading (with progress)
   - Complete
   - Error

3. UI Components
   - Progress bar showing percentage
   - Status text
   - Cancel button during download
   - Error message display

### States

```
idle
  ├── not_installed
  │   ├── api_key_missing
  │   └── ready_to_install
  ├── installing
  │   ├── downloading
  │   │   ├── in_progress
  │   │   └── error
  │   ├── verifying_attestation
  │   │   ├── in_progress
  │   │   └── error
  │   └── configuring
  ├── installed
  │   ├── up_to_date
  │   └── update_available
  │       ├── api_key_missing
  │       ├── ready_to_update
  │       └── updating
  │           ├── downloading
  │           │   ├── in_progress
  │           │   └── error
  │           ├── verifying_attestation
  │           │   ├── in_progress
  │           │   └── error
  │           └── configuring
  └── uninstalling
```

### Events

- DOWNLOAD_PROGRESS
- DOWNLOAD_COMPLETE
- DOWNLOAD_ERROR
- DOWNLOAD_CANCEL
- CHECK_DEPENDENCIES
- CHECK_API_KEY
- INSTALL
- UNINSTALL
- UPDATE
- INSTALLATION_COMPLETE
- UNINSTALLATION_COMPLETE
- ERROR

### Context

- downloadProgress: {
  bytesReceived: number
  totalBytes: number
  percentage: number
  status: string
  }
- installationStatus
- dependencies
- apiKeyStatus
- errorMessage

### Services

- checkDependencies
- checkApiKey
- installServer
- uninstallServer
- updateServer

## Proposed Component Structure

### Parent Component

- `InstallationManager.svelte`
  - Hosts XState machine
  - Manages global state
  - Coordinates child components

### Child Components

1. `DownloadProgress.svelte`
   - Progress bar UI
   - Status message
   - Cancel functionality
   - Error display
1. `InstallationStatus.svelte`

   - Displays current status
   - Handles install/uninstall/update actions

1. `DependencyList.svelte`

   - Shows dependency status
   - Provides installation links

1. `ResourceLinks.svelte`
   - Contains all external links
   - Handles folder opening
