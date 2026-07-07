export const API_BASE = 'http://localhost:5237';

export function getApiErrorMessage(data, fallback = 'Request failed.') {
  if (!data) return fallback;

  if (data.errors && typeof data.errors === 'object') {
    const validationMessages = Object.entries(data.errors)
      .flatMap(([field, messages]) => {
        if (Array.isArray(messages)) {
          return messages.map((msg) => `${cleanFieldName(field)}: ${msg}`);
        }

        return [`${cleanFieldName(field)}: ${messages}`];
      });

    if (validationMessages.length > 0) {
      return validationMessages.join('\n');
    }
  }

  if (typeof data.message === 'string' && data.message.trim()) {
    return data.message;
  }

  if (typeof data.error === 'string' && data.error.trim()) {
    return data.error;
  }

  if (typeof data.detail === 'string' && data.detail.trim()) {
    return data.detail;
  }

  if (typeof data.title === 'string' && data.title.trim()) {
    return data.title;
  }

  return fallback;
}

export async function parseApiResponse(res, fallback = 'Request failed.') {
  const data = await res.json().catch(() => null);

  if (!res.ok) {
    throw new Error(getApiErrorMessage(data, fallback));
  }

  return data;
}

export function formatFetchError(err) {
  if (err instanceof TypeError) {
    return 'Unable to connect to the server. Please make sure the backend is running.';
  }

  return err?.message || 'Something went wrong. Please try again.';
}

function cleanFieldName(field) {
  if (!field) return 'Field';

  const parts = field.split('.');
  const last = parts[parts.length - 1];

  return last
    .replace(/\[\d+\]/g, '')
    .replace(/([a-z])([A-Z])/g, '$1 $2');
}