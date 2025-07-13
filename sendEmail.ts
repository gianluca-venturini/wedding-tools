#!/usr/bin/env bun
/**
 * Gmail API Email Sender
 *
 * This script sends emails using the Gmail API by reading from an email template file.
 *
 * Setup Instructions:
 * 1. Install Bun: https://bun.sh/
 * 2. Install dependencies: bun install
 * 3. Enable Gmail API in Google Cloud Console
 * 4. Create OAuth 2.0 credentials and add them to your .env file
 * 5. Copy .env.example to .env and fill in your credentials
 * 6. Run the script for the first time to authorize access
 *
 * Usage:
 *     bun run sendEmail.ts
 */

import { config } from 'dotenv';
import { google } from 'googleapis';
import { OAuth2Client } from 'google-auth-library';
import { readFileSync, writeFileSync, existsSync } from 'fs';
import { createInterface } from 'readline';

// Load environment variables
config();

// Gmail API scope
const SCOPES = ['https://www.googleapis.com/auth/gmail.send'];
const TOKEN_PATH = 'token.json';

interface EmailHeaders {
    From?: string;
    To?: string;
    Subject?: string;
    [key: string]: string | undefined;
}

interface ParsedEmail {
    headers: EmailHeaders;
    body: string;
}

class GmailSender {
    private gmail: any = null;
    private oAuth2Client: OAuth2Client | null = null;

    /**
     * Authenticate with Gmail API
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
                const token = JSON.parse(readFileSync(TOKEN_PATH, 'utf8'));
                this.oAuth2Client.setCredentials(token);
            } else {
                await this.getAccessToken();
            }

            // Check if token is expired and refresh if needed
            const tokenInfo = await this.oAuth2Client.getTokenInfo(
                this.oAuth2Client.credentials.access_token!
            );
            if (tokenInfo.expiry_date && tokenInfo.expiry_date < Date.now()) {
                await this.oAuth2Client.refreshAccessToken();
                this.saveToken();
            }

            this.gmail = google.gmail({ version: 'v1', auth: this.oAuth2Client });
        } catch (error) {
            console.error('Authentication error:', error);
        }
    }

    /**
     * Get access token from user
     */
    private async getAccessToken(): Promise<void> {
        if (!this.oAuth2Client) return;

        const authUrl = this.oAuth2Client.generateAuthUrl({
            access_type: 'offline',
            scope: SCOPES,
        });

        console.log('Authorize this app by visiting this URL:', authUrl);

        // In a real application, you'd want to implement a proper OAuth flow
        // For now, we'll prompt the user to enter the code manually
        const rl = createInterface({
            input: process.stdin,
            output: process.stdout,
        });

        return new Promise((resolve, reject) => {
            rl.question('Enter the code from that page here: ', async (code: string) => {
                rl.close();
                try {
                    const { tokens } = await this.oAuth2Client!.getToken(code);
                    this.oAuth2Client!.setCredentials(tokens);
                    this.saveToken();
                    resolve();
                } catch (error) {
                    console.error('Error retrieving access token:', error);
                    reject(error);
                }
            });
        });
    }

    /**
     * Save token to file
     */
    private saveToken(): void {
        if (!this.oAuth2Client) return;
        writeFileSync(TOKEN_PATH, JSON.stringify(this.oAuth2Client.credentials));
    }

    /**
     * Parse email template file and extract headers and body
     */
    private parseEmailTemplate(templateFile: string): ParsedEmail | null {
        if (!existsSync(templateFile)) {
            console.error(`Error: Template file '${templateFile}' not found!`);
            return null;
        }

        const content = readFileSync(templateFile, 'utf8');
        const lines = content.split('\n');

        // Find the first empty line that separates headers from body
        let headerEndIndex = -1;
        for (let i = 0; i < lines.length; i++) {
            if (lines[i].trim() === '') {
                headerEndIndex = i;
                break;
            }
        }

        if (headerEndIndex === -1) {
            console.error('Error: No empty line found to separate headers from body!');
            return null;
        }

        // Extract headers and body
        const headerLines = lines.slice(0, headerEndIndex);
        const bodyLines = lines.slice(headerEndIndex + 1);

        // Parse headers
        const headers: EmailHeaders = {};
        headerLines.forEach((line: string) => {
            if (line.includes(':')) {
                const [key, ...valueParts] = line.split(':');
                headers[key.trim()] = valueParts.join(':').trim();
            }
        });

        const MANDATORY_FIELDS = ['From', 'To', 'Subject'];
        const missingFields = MANDATORY_FIELDS.filter(field => !headers[field]);
        if (missingFields.length > 0) {
            console.error(
                `Error: ${missingFields.join(', ')} field is required in email template!`
            );
            return null;
        }

        const body = bodyLines.join('\n');
        return { headers, body };
    }

    /**
     * Create email message
     */
    private createMessage(headers: EmailHeaders, body: string): string {
        const messageParts = [];

        // Add any additional headers (like Content-Type for HTML emails)
        Object.keys(headers).forEach(key => {
            messageParts.push(`${key}: ${headers[key] || ''}`);
        });

        messageParts.push('');
        messageParts.push(body);

        const message = messageParts.join('\n');
        return Buffer.from(message)
            .toString('base64')
            .replace(/\+/g, '-')
            .replace(/\//g, '_')
            .replace(/=+$/, '');
    }

    /**
     * Send email using Gmail API
     */
    public async sendEmail(templateFile: string = 'email.html.eml'): Promise<boolean> {
        await this.ensureAuthentication();

        if (!this.gmail) {
            console.error('Error: Gmail service not authenticated!');
            return false;
        }

        // Parse email template
        const parsed = this.parseEmailTemplate(templateFile);
        if (!parsed) {
            console.error('Error: Failed to parse email template!');
            return false;
        }

        const { headers, body } = parsed;

        // Debug: Log headers to see what we're sending
        console.log('Parsed headers:', headers);
        console.log('Content-Type header:', headers['Content-Type']);

        // Validate required fields
        if (!headers.To) {
            console.error('Error: "To" field is required in email template!');
            return false;
        }

        try {
            // Create message
            const raw = this.createMessage(headers, body);

            // Debug: Log the raw message before base64 encoding
            const decodedMessage = Buffer.from(
                raw.replace(/-/g, '+').replace(/_/g, '/'),
                'base64'
            ).toString('utf8');
            console.log('Raw email message:');
            console.log(decodedMessage);

            // Send email
            const response = await this.gmail.users.messages.send({
                userId: 'me',
                requestBody: {
                    raw: raw,
                },
            });

            console.log('Email sent successfully!');
            console.log(`Message ID: ${response.data.id}`);
            console.log(`To: ${headers.To}`);
            console.log(`Subject: ${headers.Subject}`);

            return true;
        } catch (error) {
            console.error('An error occurred:', error);
            return false;
        }
    }
}

/**
 * Main function
 */
async function main(): Promise<void> {
    console.log('Gmail API Email Sender');
    console.log('='.repeat(50));

    // Initialize Gmail sender
    const sender = new GmailSender();
    // Send email
    const success = await sender.sendEmail();

    if (success) {
        console.log('\nEmail sent successfully!');
    } else {
        console.log('\nFailed to send email!');
    }
}

// Run main function
main().catch(console.error);
