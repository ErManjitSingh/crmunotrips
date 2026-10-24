/**
 * Standalone check of call-recording transcription through OpenRouter — the same request
 * services/callRecordingService.js sends — WITHOUT any database or CRM data.
 *
 *   node src/scripts/tryTranscription.js <audio-file> [model]
 *
 * The key is read from backend/.env.openrouter-test (git-ignored), line OPENROUTER_API_KEY=…,
 * or from the OPENROUTER_API_KEY environment variable. The key is never printed.
 */
const fs = require('fs');
const path = require('path');

function readKey() {
  if (process.env.OPENROUTER_API_KEY) return process.env.OPENROUTER_API_KEY.trim();
  const file = path.join(__dirname, '../../.env.openrouter-test');
  if (!fs.existsSync(file)) return '';
  const line = fs.readFileSync(file, 'utf8').split(/\r?\n/).find((l) => l.startsWith('OPENROUTER_API_KEY='));
  return line ? line.slice('OPENROUTER_API_KEY='.length).trim().replace(/^["']|["']$/g, '') : '';
}

async function main() {
  const [audioPath, modelArg] = process.argv.slice(2);
  if (!audioPath) {
    console.error('Usage: node src/scripts/tryTranscription.js <audio-file> [model]');
    process.exit(2);
  }
  const key = readKey();
  if (!key) {
    console.error('No key: add OPENROUTER_API_KEY=… to backend/.env.openrouter-test');
    process.exit(2);
  }
  const model = modelArg || process.env.TRANSCRIBE_MODEL || 'openai/gpt-4o-transcribe';
  const audio = fs.readFileSync(audioPath);
  const format = path.extname(audioPath).slice(1).toLowerCase();

  const started = Date.now();
  const response = await fetch('https://openrouter.ai/api/v1/audio/transcriptions', {
    method: 'POST',
    headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json', 'X-Title': 'UNO Trips CRM' },
    body: JSON.stringify({ model, input_audio: { data: audio.toString('base64'), format } }),
  });
  const body = await response.json().catch(() => ({}));
  console.log(`model: ${model}`);
  console.log(`file: ${path.basename(audioPath)} (${audio.length} bytes, ${format})`);
  console.log(`HTTP ${response.status} in ${Date.now() - started} ms`);
  if (!response.ok) {
    console.log(`error: ${body?.error?.message || JSON.stringify(body).slice(0, 300)}`);
    process.exit(1);
  }
  console.log(`transcript: ${body.text}`);
  if (body.usage) console.log(`usage: ${JSON.stringify(body.usage)}`);
}

main().catch((err) => {
  console.error(`failed: ${err.message}`);
  process.exit(1);
});
