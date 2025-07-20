import { config } from 'dotenv';
import { google } from 'googleapis';
import { OAuth2Client } from 'google-auth-library';
import { readFileSync, writeFileSync, existsSync } from 'fs';
import { createInterface } from 'readline';

// Load environment variables
config();

// Define all available scopes
export const GMAIL_SCOPES = ['https://www.googleapis.com/auth/gmail.send'];
export const SHEETS_SCOPES = [
    'https://www.googleapis.com/auth/spreadsheets',
    'https://www.googleapis.com/auth/spreadsheets.readonly',
];

// Combined scopes for applications that need both
export const ALL_SCOPES = [...GMAIL_SCOPES, ...SHEETS_SCOPES];

const TOKEN_PATH = 'token.json';

interface GoogleServices {
    gmail?: any;
    sheets?: any;
}

export class GoogleAuthManager {
    private oAuth2Client: OAuth2Client | null = null;
    private services: GoogleServices = {};
    private scopes: string[];

    constructor(scopes: string[] = ALL_SCOPES) {
        this.scopes = scopes;
    }

    /**
     * Get authenticated OAuth2 client
     */
    public async getAuth(): Promise<OAuth2Client | null> {
        await this.ensureAuthentication();
        return this.oAuth2Client;
    }

    /**
     * Get Gmail service instance
     */
    public async getGmail(): Promise<any> {
        await this.ensureAuthentication();
        if (!this.oAuth2Client) {
            throw new Error('Authentication failed - OAuth2Client is null');
        }
        if (!this.services.gmail) {
            this.services.gmail = google.gmail({ version: 'v1', auth: this.oAuth2Client });
        }
        return this.services.gmail;
    }

    /**
     * Get Google Sheets service instance
     */
    public async getSheets(): Promise<any> {
        await this.ensureAuthentication();
        if (!this.oAuth2Client) {
            throw new Error('Authentication failed - OAuth2Client is null');
        }
        if (!this.services.sheets) {
            this.services.sheets = google.sheets({ version: 'v4', auth: this.oAuth2Client });
        }
        return this.services.sheets;
    }

    /**
     * Check if authentication is valid
     */
    public async isAuthenticated(): Promise<boolean> {
        try {
            await this.ensureAuthentication();
            return this.oAuth2Client !== null && !!this.oAuth2Client.credentials.access_token;
        } catch {
            return false;
        }
    }

    /**
     * Clear stored authentication (logout)
     */
    public clearAuth(): void {
        this.oAuth2Client = null;
        this.services = {};
        if (existsSync(TOKEN_PATH)) {
            writeFileSync(TOKEN_PATH, '{}');
        }
    }

    /**
     * Authenticate with Google APIs
     */
    private async ensureAuthentication(): Promise<void> {
        if (this.oAuth2Client) {
            // Return if already authenticated
            return;
        }

        try {
            // Load client secrets from environment variables
            const clientId = process.env.GOOGLE_CLIENT_ID;
            const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
            const redirectUri = process.env.GOOGLE_REDIRECT_URI;

            if (!clientId || !clientSecret || !redirectUri) {
                console.error('Error: Missing required environment variables!');
                console.error(
                    'Please ensure GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, and GOOGLE_REDIRECT_URI are set in your .env file'
                );
                console.error(
                    'Copy .env.example to .env and fill in your credentials from Google Cloud Console'
                );
                return;
            }

            this.oAuth2Client = new google.auth.OAuth2(clientId, clientSecret, redirectUri);

            // Check if we have previously stored a token
            if (existsSync(TOKEN_PATH)) {
                try {
                    const tokenData = readFileSync(TOKEN_PATH, 'utf8');
                    const token = JSON.parse(tokenData);

                    // Only set credentials if token is not empty
                    if (token && Object.keys(token).length > 0) {
                        this.oAuth2Client.setCredentials(token);
                    } else {
                        await this.getAccessToken();
                    }
                } catch (error) {
                    console.log('Invalid token file, requesting new authorization...');
                    await this.getAccessToken();
                }
            } else {
                await this.getAccessToken();
            }

            // Check if token is expired and refresh if needed
            if (this.oAuth2Client.credentials.access_token) {
                try {
                    const tokenInfo = await this.oAuth2Client.getTokenInfo(
                        this.oAuth2Client.credentials.access_token
                    );
                    if (tokenInfo.expiry_date && tokenInfo.expiry_date < Date.now()) {
                        console.log('Token expired, refreshing...');
                        await this.oAuth2Client.refreshAccessToken();
                        this.saveToken();
                    }
                } catch (error) {
                    console.log('Error checking token, requesting new authorization...');
                    await this.getAccessToken();
                }
            }
        } catch (error) {
            console.error('Authentication error:', error);
            throw error;
        }
    }

    /**
     * Get access token from user
     */
    private async getAccessToken(): Promise<void> {
        if (!this.oAuth2Client) return;

        const authUrl = this.oAuth2Client.generateAuthUrl({
            access_type: 'offline',
            scope: this.scopes,
        });

        console.log('\n🔐 Google API Authorization Required');
        console.log('='.repeat(50));
        console.log('Please authorize this app by visiting this URL:');
        console.log('\n' + authUrl + '\n');

        // In a real application, you'd want to implement a proper OAuth flow
        // For now, we'll prompt the user to enter the code manually
        const rl = createInterface({
            input: process.stdin,
            output: process.stdout,
        });

        return new Promise((resolve, reject) => {
            rl.question(
                'Enter the authorization code from that page here: ',
                async (code: string) => {
                    rl.close();
                    try {
                        const { tokens } = await this.oAuth2Client!.getToken(code);
                        this.oAuth2Client!.setCredentials(tokens);
                        this.saveToken();
                        console.log('✅ Authentication successful!\n');
                        resolve();
                    } catch (error) {
                        console.error('❌ Error retrieving access token:', error);
                        reject(error);
                    }
                }
            );
        });
    }

    /**
     * Save token to file
     */
    private saveToken(): void {
        if (!this.oAuth2Client) return;
        writeFileSync(TOKEN_PATH, JSON.stringify(this.oAuth2Client.credentials, null, 2));
    }

    /**
     * Get the current scopes
     */
    public getScopes(): string[] {
        return [...this.scopes];
    }

    /**
     * Check if specific scopes are included
     */
    public hasScopes(requiredScopes: string[]): boolean {
        return requiredScopes.every(scope => this.scopes.includes(scope));
    }
}

/**
 * Create a pre-configured auth manager for Gmail only
 */
export function createGmailAuth(): GoogleAuthManager {
    return new GoogleAuthManager(GMAIL_SCOPES);
}

/**
 * Create a pre-configured auth manager for Sheets only
 */
export function createSheetsAuth(): GoogleAuthManager {
    return new GoogleAuthManager(SHEETS_SCOPES);
}

/**
 * Create a pre-configured auth manager for both Gmail and Sheets
 */
export function createFullAuth(): GoogleAuthManager {
    return new GoogleAuthManager(ALL_SCOPES);
}
