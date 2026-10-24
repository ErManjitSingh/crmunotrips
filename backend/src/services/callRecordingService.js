const fs = require('fs/promises');
const path = require('path');
const CallNote = require('../models/CallNote');

/**
 * Call recordings uploaded by the UNO Sales Tracker app, and their transcripts.
 *
 * Files live in a PRIVATE folder (default backend/storage/call-recordings), never under the public
 * /uploads static route: a recording is personal data and is only reachable through the API.
 * Transcription uses OpenRouter's speech-to-text endpoint; it is off until OPENROUTER_API_KEY is set.
 */

const RECORDINGS_DIR = process.env.CALL_RECORDINGS_DIR
  || path.join(__dirname, '../../storage/call-recordings');
const OPENROUTER_URL = process.env.OPENROUTER_BASE_URL || 'https://openrouter.ai/api/v1';
const TRANSCRIBE_MODEL = process.env.TRANSCRIBE_MODEL || 'openai/gpt-4o-transcribe';
const MAX_BYTES = 25 * 1024 * 1024; // OpenRouter inline audio limit
/** Formats OpenRouter speech-to-text accepts; others (amr, 3gp) are stored but can't be transcribed. */
const TRANSCRIBABLE = new Set(['wav', 'mp3', 'flac', 'm4a', 'ogg', 'webm', 'aac']);

/** Accepted upload types → file extension / OpenRouter audio format. */
const AUDIO_TYPES = {
  'audio/mp4': 'm4a',
  'audio/m4a': 'm4a',
  'audio/x-m4a': 'm4a',
  'audio/mp4a-latm': 'm4a',
  'audio/aac': 'aac',
  'audio/mpeg': 'mp3',
  'audio/mp3': 'mp3',
  'audio/wav': 'wav',
  'audio/x-wav': 'wav',
  'audio/ogg': 'ogg',
  'audio/webm': 'webm',
  'audio/flac': 'flac',
  'audio/amr': 'amr',
  'audio/3gpp': '3gp',
};

function formatFor(mimeType) {
  return AUDIO_TYPES[String(mimeType || '').toLowerCase().split(';')[0].trim()] || null;
}

function filePathFor(callNote) {
  return path.join(RECORDINGS_DIR, `${callNote._id}.${formatFor(callNote.recording?.mimeType) || 'bin'}`);
}

function isConfigured() {
  return Boolean(process.env.OPENROUTER_API_KEY);
}

/** Saves (or replaces) the recording of a call note and marks its transcript as pending. */
async function saveRecording(callNote, { buffer, mimeType, fileName, durationMs }) {
  await fs.mkdir(RECORDINGS_DIR, { recursive: true });
  const recording = {
    fileName: String(fileName || '').slice(0, 200),
    mimeType: String(mimeType).toLowerCase().split(';')[0].trim(),
    sizeBytes: buffer.length,
    durationMs: Number.isFinite(Number(durationMs)) ? Math.max(0, Number(durationMs)) : undefined,
    uploadedAt: new Date(),
  };
  await fs.writeFile(filePathFor({ _id: callNote._id, recording }), buffer);

  const keepTranscript = callNote.transcript?.status === 'done';
  await CallNote.updateOne(
    { _id: callNote._id },
    {
      $set: {
        recording,
        ...(keepTranscript ? {} : {
          transcript: { status: isConfigured() ? 'pending' : 'not_configured' },
        }),
      },
    }
  );
  return CallNote.findById(callNote._id).lean();
}

/**
 * Transcribes a call note's recording with OpenRouter and stores the text. Never throws: a failure
 * is recorded on the call note so the app can show it.
 */
async function transcribeCallNote(callNoteId, { fetchImpl = globalThis.fetch } = {}) {
  const callNote = await CallNote.findById(callNoteId).lean();
  if (!callNote?.recording?.uploadedAt) return null;
  if (!isConfigured()) {
    await CallNote.updateOne({ _id: callNoteId }, { $set: { 'transcript.status': 'not_configured' } });
    return 'not_configured';
  }
  const format = formatFor(callNote.recording.mimeType);
  if (!TRANSCRIBABLE.has(format)) {
    await CallNote.updateOne(
      { _id: callNoteId },
      { $set: { transcript: { status: 'failed', model: TRANSCRIBE_MODEL, error: `${String(format).toUpperCase()} recordings can't be transcribed. Set the phone's call recorder to M4A/AAC.` } } }
    );
    return 'failed';
  }
  try {
    const audio = await fs.readFile(filePathFor(callNote));
    const response = await fetchImpl(`${OPENROUTER_URL}/audio/transcriptions`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${process.env.OPENROUTER_API_KEY}`,
        'Content-Type': 'application/json',
        'X-Title': 'UNO Trips CRM',
      },
      body: JSON.stringify({
        model: TRANSCRIBE_MODEL,
        input_audio: { data: audio.toString('base64'), format },
      }),
    });
    const body = await response.json().catch(() => ({}));
    if (!response.ok || typeof body.text !== 'string') {
      const reason = body?.error?.message || body?.message || `HTTP ${response.status}`;
      throw new Error(`Transcription failed: ${reason}`);
    }
    await CallNote.updateOne(
      { _id: callNoteId },
      { $set: { transcript: { status: 'done', text: body.text.trim(), model: TRANSCRIBE_MODEL, completedAt: new Date() } } }
    );
    return 'done';
  } catch (err) {
    await CallNote.updateOne(
      { _id: callNoteId },
      { $set: { transcript: { status: 'failed', model: TRANSCRIBE_MODEL, error: String(err.message).slice(0, 300) } } }
    );
    return 'failed';
  }
}

module.exports = {
  MAX_BYTES,
  formatFor,
  isConfigured,
  saveRecording,
  transcribeCallNote,
};
