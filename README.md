# Wedding Tools

Suite of tools for organizing a wedding using Google APIs.

## Features

- **Email Sending**: Send HTML emails via Gmail API
- **Spreadsheet Management**: Read and write data to Google Sheets
- **Unified Authentication**: Shared OAuth2 authentication for all Google services

## Architecture

### Authentication
The project uses a centralized `GoogleAuthManager` that handles OAuth2 authentication for both Gmail and Google Sheets APIs. This provides:

- Single sign-on across all Google services
- Automatic token refresh
- Flexible scope management
- Shared token storage

### Available Modules

1. **GoogleAuthManager** - Centralized authentication
2. **GmailManager** - Email sending functionality  
3. **SpreadsheetManager** - Google Sheets read/write operations

## Setup

1. **Install Bun**: https://bun.sh/
2. **Install dependencies**: `bun install`
3. **Enable Google APIs** in Google Cloud Console:
   - Gmail API
   - Google Sheets API
4. **Create OAuth 2.0 credentials** and download the JSON file
5. **Copy .env.example to .env** and fill in your credentials:
6. **Run any script** for the first time to authorize access

## Usage

### Sending Emails

Edit email templates with a WYSIWYG editor (e.g., https://topol.io/) and save them to the `emails` directory.

```bash
# Send email with default template
bun run sendEmail.ts recipient@example.com

# Send email with custom template
bun run sendEmail.ts recipient@example.com emails/custom_template.eml
```

### Reading from Google Sheets

```bash
bun run readSpreadsheet.ts
```