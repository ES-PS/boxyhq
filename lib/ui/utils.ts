// returns the cookie with the given name,
// or undefined if not found
export function getErrorCookie() {
  const matches = document.cookie.match(
    new RegExp('(?:^|; )' + 'jackson_error'.replace(/([.$?*|{}()[]\\\/\+^])/g, '\\$1') + '=([^;]*)')
  );
  return matches ? decodeURIComponent(matches[1]) : undefined;
}

export interface APIError extends Error {
  info?: string;
  status: number;
}

export const fetcher = async (url: string, queryParams = '') => {
  const res = await fetch(`${url}${queryParams}`);
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
