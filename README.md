# Push Notification Server

This is a Node.js server for handling push notifications using Firebase Admin SDK.

## Setup

1. Install dependencies:
   ```bash
   npm install
   ```

2. Copy `.env.example` to `.env` and fill in your Firebase service account key:
   ```bash
   cp .env.example .env
   ```
   Edit `.env` and set `FIREBASE_SERVICE_ACCOUNT_KEY` to the JSON content of your Firebase service account key file.

3. Run the server:
   ```bash
   npm start
   ```

## Deployment

For deployment, set the environment variable `FIREBASE_SERVICE_ACCOUNT_KEY` in your hosting platform (e.g., Heroku, Vercel, etc.).

## Security

- Never commit `ServiceAccount.json` or `.env` files to version control.
- The `.gitignore` file excludes sensitive files.