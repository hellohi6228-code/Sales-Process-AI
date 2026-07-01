import { ensureValidGoogleToken, GoogleDriveError } from './googleDrive';

async function checkGmailResponse(res: Response, context: string) {
  if (res.ok) return res;
  let message = res.statusText;
  try {
    const body = await res.json();
    message = body?.error?.message || message;
  } catch {}
  if (res.status === 401) {
    throw new GoogleDriveError(`Your Google session has expired. Please reconnect. (${context})`, 'GOOGLE_TOKEN_EXPIRED', res.status);
  }
  throw new GoogleDriveError(`Gmail error during ${context}: ${res.status} ${message}`, 'GOOGLE_API_ERROR', res.status);
}

function base64UrlEncode(str: string) {
  // UTF-8 safe base64url encoding
  const utf8 = unescape(encodeURIComponent(str));
  return btoa(utf8).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function base64UrlDecode(str: string) {
  const padded = str.replace(/-/g, '+').replace(/_/g, '/');
  const decoded = atob(padded);
  try {
    return decodeURIComponent(escape(decoded));
  } catch {
    return decoded;
  }
}

export type ProposalThread = {
  threadId: string;
  leadName: string;
  to: string;
  subject: string;
  sentAt: string;
};

/**
 * Sends an email via the Gmail API. Tags the message with an X-SalesProcessAI-Lead
 * header so we can identify our own proposal threads later, and (optionally)
 * threads onto an existing Gmail thread for follow-ups.
 */
export async function sendProposalEmail(opts: {
  to: string;
  subject: string;
  bodyHtml: string;
  leadName: string;
  threadId?: string;
}): Promise<{ id: string; threadId: string }> {
  const token = await ensureValidGoogleToken();

  const headers = [
    `To: ${opts.to}`,
    `Subject: ${opts.subject}`,
    `Content-Type: text/html; charset=UTF-8`,
    `MIME-Version: 1.0`,
    `X-SalesProcessAI-Lead: ${encodeURIComponent(opts.leadName)}`,
  ];
  const raw = base64UrlEncode(`${headers.join('\r\n')}\r\n\r\n${opts.bodyHtml}`);

  const res = await fetch('https://www.googleapis.com/gmail/v1/users/me/messages/send', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      raw,
      ...(opts.threadId ? { threadId: opts.threadId } : {}),
    }),
  });
  await checkGmailResponse(res, 'sending proposal email');
  return res.json();
}

/** Fetches all messages in a Gmail thread (used to show the reply trail for a proposal). */
export async function getThreadMessages(threadId: string) {
  const token = await ensureValidGoogleToken();
  const res = await fetch(`https://www.googleapis.com/gmail/v1/users/me/threads/${threadId}?format=full`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  await checkGmailResponse(res, 'fetching thread');
  const data = await res.json();

  return (data.messages || []).map((msg: any) => {
    const headers = msg.payload?.headers || [];
    const getHeader = (name: string) => headers.find((h: any) => h.name.toLowerCase() === name.toLowerCase())?.value || '';

    let body = '';
    const findBody = (part: any): string | null => {
      if (!part) return null;
      if (part.mimeType === 'text/html' && part.body?.data) return base64UrlDecode(part.body.data);
      if (part.mimeType === 'text/plain' && part.body?.data) return base64UrlDecode(part.body.data);
      if (part.parts) {
        for (const p of part.parts) {
          const found = findBody(p);
          if (found) return found;
        }
      }
      return null;
    };
    body = findBody(msg.payload) || '';

    return {
      id: msg.id,
      threadId: msg.threadId,
      from: getHeader('From'),
      to: getHeader('To'),
      subject: getHeader('Subject'),
      date: getHeader('Date'),
      snippet: msg.snippet,
      body,
      isUnread: (msg.labelIds || []).includes('UNREAD'),
      isFromMe: (msg.labelIds || []).includes('SENT'),
    };
  });
}

/** Polls Gmail for any new replies across all tracked proposal threads. */
export async function checkForNewReplies(threads: ProposalThread[]) {
  const results: Record<string, Awaited<ReturnType<typeof getThreadMessages>>> = {};
  for (const t of threads) {
    try {
      results[t.threadId] = await getThreadMessages(t.threadId);
    } catch (e) {
      console.error(`Failed to check replies for thread ${t.threadId}`, e);
    }
  }
  return results;
}

/** Sends an automated email invitation to a teammate via Gmail API. */
export async function sendInviteEmail(opts: {
  to: string;
  inviteName: string;
  inviterEmail: string;
}) {
  const token = await ensureValidGoogleToken();

  const subject = `Collaborate with me on Sales & Process AI`;
  const bodyHtml = `
    <div style="font-family: sans-serif; padding: 20px; max-width: 600px; margin: 0 auto; border: 1px solid #eee; border-radius: 12px; background-color: #fff;">
      <h2 style="color: #111; margin-top: 0;">You're Invited!</h2>
      <p style="font-size: 16px; color: #444; line-height: 1.6;">
        <strong>${opts.inviterEmail}</strong> has invited you to collaborate on the <strong>Sales & Process AI</strong> application.
      </p>
      <p style="font-size: 16px; color: #444; line-height: 1.6;">
        Even if you do not have a paid subscription, you will be able to collaborate on folders and view processes and leads shared with you.
      </p>
      <div style="margin: 30px 0; text-align: center;">
        <a href="${window.location.origin}/signup" style="background-color: #000; color: #fff; padding: 12px 24px; border-radius: 8px; text-decoration: none; font-weight: bold; display: inline-block;">
          Sign Up Now
        </a>
      </div>
      <hr style="border: none; border-top: 1px solid #eee; margin: 20px 0;" />
      <p style="font-size: 11px; color: #888; text-align: center; margin-bottom: 0;">
        This email was sent via the Sales & Process AI Gmail integration.
      </p>
    </div>
  `;

  const headers = [
    `To: ${opts.to}`,
    `Subject: ${subject}`,
    `Content-Type: text/html; charset=UTF-8`,
    `MIME-Version: 1.0`,
  ];
  const raw = base64UrlEncode(`${headers.join('\r\n')}\r\n\r\n${bodyHtml}`);

  const res = await fetch('https://www.googleapis.com/gmail/v1/users/me/messages/send', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ raw }),
  });
  await checkGmailResponse(res, 'sending invite email');
  return res.json();
}

/** Sends an onboarding email containing Drive link and generated insight cards to an invitee. */
export async function sendOnboardingEmail(opts: {
  to: string;
  folderName: string;
  folderLink: string;
  onboardingCards: Array<{ title: string; text: string }>;
  inviterEmail: string;
}) {
  const token = await ensureValidGoogleToken();

  const cardsHtml = opts.onboardingCards.map((c, i) => `
    <div style="margin-bottom: 16px; padding: 16px; border: 1px solid #e2e8f0; border-radius: 12px; background-color: #ffffff; border-left: 4px solid #0ea5e9;">
      <h3 style="margin: 0 0 6px 0; font-size: 14px; color: #0f172a; font-weight: bold;">
        ${c.title}
      </h3>
      <p style="margin: 0; font-size: 13px; color: #475569; line-height: 1.5;">
        ${c.text}
      </p>
    </div>
  `).join('');

  const subject = `Onboarding & Drive Folder Access for "${opts.folderName}"`;
  const bodyHtml = `
    <div style="font-family: sans-serif; padding: 20px; max-width: 600px; margin: 0 auto; border: 1px solid #e2e8f0; border-radius: 16px; background-color: #ffffff; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05);">
      <h2 style="color: #0f172a; margin-top: 0; border-bottom: 2px solid #e2e8f0; padding-bottom: 10px;">Project Onboarding</h2>
      <p style="font-size: 15px; color: #334155; line-height: 1.6;">
        <strong>${opts.inviterEmail}</strong> has invited you to collaborate on the folder <strong>"${opts.folderName}"</strong> on Google Drive.
      </p>
      
      <div style="margin: 24px 0; text-align: center;">
        <a href="${opts.folderLink}" style="background-color: #0ea5e9; color: #ffffff; padding: 12px 28px; border-radius: 8px; text-decoration: none; font-weight: bold; font-size: 14px; display: inline-block;">
          Access Drive Folder
        </a>
      </div>

      <hr style="border: none; border-top: 1px solid #f1f5f9; margin: 24px 0;" />
      
      ${cardsHtml}

      <hr style="border: none; border-top: 1px solid #f1f5f9; margin: 24px 0;" />
      <p style="font-size: 11px; color: #94a3b8; text-align: center; margin-bottom: 0; line-height: 1.5;">
        You can log in to the <strong>Sales & Process AI</strong> application to view and swipe these onboarding cards interactively in the workspace dashboard.
      </p>
    </div>
  `;

  const headers = [
    `To: ${opts.to}`,
    `Subject: ${subject}`,
    `Content-Type: text/html; charset=UTF-8`,
    `MIME-Version: 1.0`,
  ];
  const raw = base64UrlEncode(`${headers.join('\r\n')}\r\n\r\n${bodyHtml}`);

  const res = await fetch('https://www.googleapis.com/gmail/v1/users/me/messages/send', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ raw }),
  });
  await checkGmailResponse(res, 'sending onboarding email');
  return res.json();
}
