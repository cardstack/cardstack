export async function fetchJSON<JSONAPIDocument>(
  url: string,
  options: any = {}
): Promise<JSONAPIDocument> {
  let fullOptions = Object.assign(
    {
      headers: {
        Accept: 'application/vnd.api+json',
        'Content-Type': 'application/vnd.api+json',
      },
    },
    options
  );
  let response = await fetch(url, fullOptions);

  if (!response.ok) {
    throw new Error(`unable to fetch card ${url}: status ${response.status}`);
  }

  return await response.json();
}
