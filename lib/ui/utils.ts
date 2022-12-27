// returns the cookie with the given name,
// or undefined if not found
export function getErrorCookie() {
  const matches = document.cookie.match(
    new RegExp('(?:^|; )' + 'jackson_error'.replace(/([.$?*|{}()[]\\\/\+^])/g, '\\$1') + '=([^;]*)')
  );
  return matches ? decodeURIComponent(matches[1]) : undefined;
}

export function copyToClipboard(text: string) {
  navigator.clipboard.writeText(text);
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
    const error = new Error(
      (resContent.error.message as string) || 'An error occurred while fetching the data.'
    );

    throw error;
  }

  return resContent;
};
