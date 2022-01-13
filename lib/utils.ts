import { NextApiRequest } from 'next';
import env from '@lib/env';

export const validateApiKey = (token) => {
  return env.apiKeys.includes(token);
};

export const extractAuthToken = (req: NextApiRequest) => {
  const authHeader = req.headers['authorization'];
  const parts = (authHeader || '').split(' ');
  if (parts.length > 1) {
    return parts[1];
  }

  return null;
};

export interface APIError extends Error {
  info?: string;
  status: number;
}

export const fetcher = async (url: string) => {
  const res = await fetch(url, {
    headers: new Headers({
      Authorization: 'Api-Key secret',
    }),
  });
  let resContent;
  try {
    resContent = await res.clone().json();
  } catch (e) {
    resContent = await res.clone().text();
  }
  if (!res.ok) {
    const error = new Error('An error occurred while fetching the data.') as APIError;
    // Attach extra info to the error object.
    error.info = resContent;
    error.status = res.status;
    throw error;
  }

  return resContent;
};
