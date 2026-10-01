import { Router, Request, Response } from 'express';
import prisma from '../db/prisma';

const router = Router();

/**
 * GET /oauth/start
 * Initiates the 1-click marketplace installation authorization flow
 */
router.get('/start', (req: Request, res: Response) => {
  const clientId = process.env.MONDAY_CLIENT_ID;
  if (!clientId) {
    res.status(500).send('MONDAY_CLIENT_ID not configured on server');
    return;
  }

  const redirectUri = `https://auth.monday.com/oauth2/authorize?client_id=${clientId}`;
  console.log('[OAuth] Redirecting user to monday.com authorization screen...');
  res.redirect(redirectUri);
});

/**
 * GET /oauth/callback
 * Handles the OAuth code redirect, exchanges code for access token, and stores customer installation
 */
router.get('/callback', async (req: Request, res: Response): Promise<void> => {
  const code = req.query.code as string;

  if (!code) {
    res.status(400).send('Missing authorization code');
    return;
  }

  const clientId = process.env.MONDAY_CLIENT_ID;
  const clientSecret = process.env.MONDAY_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    res.status(500).send('OAuth credentials not configured on server');
    return;
  }

  try {
    console.log('[OAuth] Exchanging authorization code for permanent access token...');

    const tokenResponse = await fetch('https://auth.monday.com/oauth2/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        code,
        client_id: clientId,
        client_secret: clientSecret,
      }),
    });

    if (!tokenResponse.ok) {
      const errText = await tokenResponse.text();
      throw new Error(`Token exchange failed: ${errText}`);
    }

    const tokenData = (await tokenResponse.json()) as {
      access_token: string;
      token_type?: string;
      account_id?: string | number;
      user_id?: string | number;
    };

    const accountId = String(tokenData.account_id || 'default');
    const accessToken = tokenData.access_token;
    const userId = tokenData.user_id ? String(tokenData.user_id) : null;

    // Save or update customer installation in PostgreSQL
    await prisma.account.upsert({
      where: { accountId },
      update: {
        accessToken,
        userId,
        updatedAt: new Date(),
      },
      create: {
        accountId,
        accessToken,
        userId,
      },
    });

    console.log(`[OAuth] Successfully onboarded customer account: ${accountId}`);

    // Redirect to the live App View
    res.redirect('https://bottleneck.13.140.190.131.sslip.io/?installed=true');
  } catch (error: any) {
    console.error('[OAuth Callback Error]:', error);
    res.status(500).send(`Failed to complete installation: ${error.message}`);
  }
});

export default router;
