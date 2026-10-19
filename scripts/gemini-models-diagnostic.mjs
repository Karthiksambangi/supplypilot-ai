import { readFileSync } from 'node:fs';

const envText = readFileSync(new URL('../.env', import.meta.url), 'utf8');
const keyLine = envText.split(/\r?\n/).find((line) => /^GEMINI_API_KEY\s*=/.test(line));
const apiKey = keyLine?.slice(keyLine.indexOf('=') + 1).trim().replace(/^(['"])(.*)\1$/, '$2');

if (!apiKey) {
  console.log('GEMINI_API_KEY is missing or empty.');
  process.exitCode = 1;
} else {
  try {
    const response = await fetch('https://generativelanguage.googleapis.com/v1beta/models', {
      headers: { 'x-goog-api-key': apiKey },
      signal: AbortSignal.timeout(15000),
    });

    if (!response.ok) {
      console.log(`Models request failed: HTTP ${response.status}.`);
      process.exitCode = 1;
    } else {
      const data = await response.json();
      const models = (data.models ?? [])
        .filter((model) => model.supportedGenerationMethods?.includes('generateContent'))
        .map((model) => model.name?.replace(/^models\//, ''))
        .filter(Boolean);

      if (models.length) {
        for (const model of models) console.log(model);
      } else {
        console.log('No models supporting generateContent were returned.');
      }
    }
  } catch (error) {
    const causeCode = error?.cause?.code;
    if (causeCode === 'ENOTFOUND' || causeCode === 'EAI_AGAIN') {
      console.log('Models request failed: DNS lookup failed.');
    } else if (causeCode?.startsWith('ERR_TLS') || causeCode?.startsWith('CERT_') || causeCode === 'UNABLE_TO_VERIFY_LEAF_SIGNATURE') {
      console.log('Models request failed: TLS validation failed.');
    } else if (causeCode === 'ETIMEDOUT' || error?.name === 'TimeoutError') {
      console.log('Models request failed: connection timed out.');
    } else if (['ECONNREFUSED', 'ECONNRESET', 'EHOSTUNREACH', 'ENETUNREACH'].includes(causeCode)) {
      console.log(`Models request failed: connection error (${causeCode}).`);
    } else {
      console.log(`Models request failed: ${error?.name === 'TypeError' ? 'network or runtime error' : 'unexpected error'}.`);
    }
    process.exitCode = 1;
  }
}
