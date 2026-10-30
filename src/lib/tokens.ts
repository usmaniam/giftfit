import { createHmac, randomBytes } from 'node:crypto';

const secret = () => {
  const s = process.env.INVITE_TOKEN_SECRET;
  if (s) return s;
  if (process.env.NODE_ENV === 'production') throw new Error('INVITE_TOKEN_SECRET is required in production');
  return 'dev-only-secret-change-me';
};

export const newId = () => randomBytes(12).toString('base64url');
export const newInviteToken = () => randomBytes(24).toString('base64url');
export const hashToken = (token: string) => createHmac('sha256', secret()).update(token).digest('hex');
