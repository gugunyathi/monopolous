interface BuilderCodeResponse {
  builderCode: string;
  walletAddress: string;
}

export async function registerBuilderCode(walletAddress: string): Promise<BuilderCodeResponse> {
  const response = await fetch('https://api.base.dev/v1/agents/builder-codes', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ walletAddress }),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Builder code registration failed (${response.status}): ${text}`);
  }

  return response.json() as Promise<BuilderCodeResponse>;
}
