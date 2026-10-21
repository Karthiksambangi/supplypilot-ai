export async function readApiResponse(response) {
  const raw = await response.text();
  let data = null;
  if (raw.trim()) {
    try {
      data = JSON.parse(raw);
    } catch {
      if (response.ok) throw new Error('The local backend returned an unreadable response. Restart the app with `npm start`.');
    }
  }
  if (!response.ok) {
    if (data?.error) throw new Error(data.error);
    throw new Error('The local backend is unavailable. Start both app services with `npm start`, then retry.');
  }
  if (!data || typeof data !== 'object') throw new Error('The local backend returned an empty response. Restart the app with `npm start`.');
  return data;
}
