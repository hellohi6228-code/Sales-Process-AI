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
