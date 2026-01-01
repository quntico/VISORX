
# VISOR-X v1.1 - Google OAuth Setup

VISOR-X uses Supabase for Authentication (Google OAuth), Database, and Storage.

## 1. Environment Setup (Pre-requisite)

Ensure you have your `SUPABASE_URL` and `SUPABASE_ANON_KEY` configured in the Horizons environment variables.

## 2. Enable Google Auth in Supabase

1.  **Google Cloud Console**:
    *   Go to [console.cloud.google.com](https://console.cloud.google.com/).
    *   Create a new project or select an existing one.
    *   Navigate to **APIs & Services > OAuth consent screen**.
    *   Configure the screen (External), fill in app details.
    *   Navigate to **Credentials**.
    *   Click **Create Credentials > OAuth client ID**.
    *   Application type: **Web application**.
    *   Authorized JavaScript origins: `https://<your-supabase-project>.supabase.co` (Found in Supabase Auth settings).
    *   Authorized redirect URIs: `https://<your-supabase-project>.supabase.co/auth/v1/callback`.
    *   Copy the **Client ID** and **Client Secret**.

2.  **Supabase Dashboard**:
    *   Go to **Authentication > Providers**.
    *   Select **Google**.
    *   Enable **Google**.
    *   Paste the **Client ID** and **Client Secret**.
    *   Click **Save**.
    *   **Important**: Ensure `Redirect URL` in Supabase matches what you put in Google Console.

## 3. Database Migration

The necessary tables for User Profiles and Role-Based Access Control have been generated automatically.

*   **Profiles Table**: Stores user roles (`admin` or `user`).
*   **Trigger**: Automatically assigns `admin` role to `delavega3540@gmail.com`.

## 4. Verification

1.  Go to the login page (`/login`).
2.  Click "Sign in with Google".
3.  If you sign in with `delavega3540@gmail.com`, you should see the **ADMIN** badge in the dashboard header.
4.  Try accessing `/setup`. Only admins can view this page.

## Troubleshooting

*   **Redirect Mismatch**: If you get a `redirect_uri_mismatch` error, double-check that the URL in Google Console exactly matches the callback URL provided in Supabase Dashboard.
*   **Role not assigned**: If you logged in *before* the migration ran, your profile might not exist. The application is designed to auto-create it on next login, but you can also manually insert a row in the `profiles` table in Supabase if needed.
