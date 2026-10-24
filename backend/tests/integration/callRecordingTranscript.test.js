const os = require('os');
const path = require('path');
const fs = require('fs');
const request = require('supertest');
const mongoose = require('mongoose');
const db = require('../setup/db');

/**
 * Call recordings uploaded by the Sales Tracker app (POST …/call-notes/:noteId/recording) and their
 * OpenRouter transcripts (GET …/transcript). OpenRouter is always mocked: no network, no real key.
 */

const RECORDINGS_DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'call-recordings-'));
process.env.CALL_RECORDINGS_DIR = RECORDINGS_DIR;

let app;
let User;
let Lead;
let CallNote;
let UserSession;
let generateToken;
const realFetch = globalThis.fetch;

beforeAll(async () => {
  await db.connect();
  app = require('../../src/server');
  User = require('../../src/models/User');
  Lead = require('../../src/models/Lead');
  CallNote = require('../../src/models/CallNote');
  UserSession = require('../../src/models/UserSession');
  ({ generateToken } = require('../../src/middleware/auth'));
});

afterEach(async () => {
  await db.clearCollections();
  globalThis.fetch = realFetch;
  delete process.env.OPENROUTER_API_KEY;
});

afterAll(async () => {
  await db.disconnect();
  fs.rmSync(RECORDINGS_DIR, { recursive: true, force: true });
});

let counter = 0;

async function makeExecutive() {
  counter += 1;
  const user = await User.create({
    name: `Rec Exec ${counter}`,
    email: `recexec${counter}@example.com`,
    password: 'password123',
    role: 'sales_executive',
  });
  const session = await UserSession.create({
    userId: user._id,
    sessionId: new mongoose.Types.ObjectId().toString(),
    role: 'sales_executive',
    status: 'active',
    loginAt: new Date(),
    lastActivityAt: new Date(),
  });
  return { user, token: generateToken(user._id, 'sales_executive', session.sessionId) };
}

async function makeCallNote(exec) {
  const lead = await Lead.create({
    name: `Rec Lead ${counter}`,
    phone: `7${String(2000000000 + counter).slice(0, 9)}`,
    destination: 'Goa',
    status: 'contacted',
    createdBy: exec.user._id,
    assignedTo: exec.user._id,
  });
  const note = await CallNote.create({
    leadId: lead._id,
    userId: exec.user._id,
    callerRole: 'sales_executive',
    outcome: 'requested_callback',
    duration: 20,
    startedAt: new Date('2026-10-15T16:32:09Z'),
    endedAt: new Date('2026-10-15T16:32:29Z'),
  });
  return { lead, note };
}

const AUDIO = Buffer.from('RIFF....WAVEfmt fake audio bytes');

function upload(token, leadId, noteId, { type = 'audio/wav', body = AUDIO } = {}) {
  return request(app)
    .post(`/api/leads/${leadId}/call-notes/${noteId}/recording`)
    .set('Authorization', `Bearer ${token}`)
    .set('Content-Type', type)
    .set('X-Recording-Name', 'Call recording Parisa_261015_220209.wav')
    .set('X-Recording-Duration-Ms', '20000')
    .send(body);
}

async function waitForTranscript(noteId, status) {
  for (let i = 0; i < 50; i += 1) {
    const note = await CallNote.findById(noteId).lean();
    if (note.transcript?.status === status) return note;
    await new Promise((r) => setTimeout(r, 20));
  }
  throw new Error(`transcript never reached ${status}`);
}

describe('call recording upload and transcript', () => {
  test('the caller uploads the recording; it is transcribed via OpenRouter and readable', async () => {
    process.env.OPENROUTER_API_KEY = 'test-key';
    const calls = [];
    globalThis.fetch = async (url, init) => {
      calls.push({ url, init });
      return { ok: true, status: 200, json: async () => ({ text: ' Hello, I want to book Goa in December. ' }) };
    };
    const exec = await makeExecutive();
    const { lead, note } = await makeCallNote(exec);

    const res = await upload(exec.token, lead._id, note._id);
    expect(res.status).toBe(201);
    expect(res.body.hasRecording).toBe(true);
    expect(res.body.transcript.status).toBe('pending');

    const done = await waitForTranscript(note._id, 'done');
    expect(done.transcript.text).toBe('Hello, I want to book Goa in December.');
    expect(done.recording.sizeBytes).toBe(AUDIO.length);
    expect(done.recording.durationMs).toBe(20000);

    expect(calls).toHaveLength(1);
    expect(calls[0].url).toBe('https://openrouter.ai/api/v1/audio/transcriptions');
    expect(calls[0].init.headers.Authorization).toBe('Bearer test-key');
    const sent = JSON.parse(calls[0].init.body);
    expect(sent.model).toBe('openai/gpt-4o-transcribe');
    expect(sent.input_audio).toEqual({ data: AUDIO.toString('base64'), format: 'wav' });

    // Stored privately, outside the public uploads folder.
    const stored = path.join(RECORDINGS_DIR, `${note._id}.wav`);
    expect(fs.readFileSync(stored).equals(AUDIO)).toBe(true);
    expect(stored.includes(`${path.sep}uploads${path.sep}`)).toBe(false);

    const read = await request(app)
      .get(`/api/leads/${lead._id}/call-notes/${note._id}/transcript`)
      .set('Authorization', `Bearer ${exec.token}`);
    expect(read.status).toBe(200);
    expect(read.body.transcript.text).toBe('Hello, I want to book Goa in December.');
  });

  test('without an OpenRouter key the recording is kept and nothing is sent anywhere', async () => {
    let fetched = false;
    globalThis.fetch = async () => { fetched = true; return { ok: true, json: async () => ({}) }; };
    const exec = await makeExecutive();
    const { lead, note } = await makeCallNote(exec);

    const res = await upload(exec.token, lead._id, note._id);

    expect(res.status).toBe(201);
    expect(res.body.transcript.status).toBe('not_configured');
    await new Promise((r) => setTimeout(r, 50));
    expect(fetched).toBe(false);
  });

  test('an OpenRouter error is recorded as a failed transcript', async () => {
    process.env.OPENROUTER_API_KEY = 'test-key';
    globalThis.fetch = async () => ({ ok: false, status: 400, json: async () => ({ error: { message: 'unsupported format' } }) });
    const exec = await makeExecutive();
    const { lead, note } = await makeCallNote(exec);

    await upload(exec.token, lead._id, note._id);

    const failed = await waitForTranscript(note._id, 'failed');
    expect(failed.transcript.error).toMatch(/unsupported format/);
  });

  test("another executive can neither upload nor read someone else's call", async () => {
    const owner = await makeExecutive();
    const other = await makeExecutive();
    const { lead, note } = await makeCallNote(owner);

    expect((await upload(other.token, lead._id, note._id)).status).toBe(404);
    const read = await request(app)
      .get(`/api/leads/${lead._id}/call-notes/${note._id}/transcript`)
      .set('Authorization', `Bearer ${other.token}`);
    expect(read.status).toBe(404);
  });

  test('m4a labelled audio/mp4a-latm is accepted and sent as m4a', async () => {
    process.env.OPENROUTER_API_KEY = 'test-key';
    let sentFormat;
    globalThis.fetch = async (_url, init) => {
      sentFormat = JSON.parse(init.body).input_audio.format;
      return { ok: true, status: 200, json: async () => ({ text: 'ok' }) };
    };
    const exec = await makeExecutive();
    const { lead, note } = await makeCallNote(exec);

    expect((await upload(exec.token, lead._id, note._id, { type: 'audio/mp4a-latm' })).status).toBe(201);
    await waitForTranscript(note._id, 'done');
    expect(sentFormat).toBe('m4a');
  });

  test('AMR recordings are kept but marked as not transcribable, without calling OpenRouter', async () => {
    process.env.OPENROUTER_API_KEY = 'test-key';
    let fetched = false;
    globalThis.fetch = async () => { fetched = true; return { ok: true, json: async () => ({ text: '' }) }; };
    const exec = await makeExecutive();
    const { lead, note } = await makeCallNote(exec);

    expect((await upload(exec.token, lead._id, note._id, { type: 'audio/amr' })).status).toBe(201);
    const failed = await waitForTranscript(note._id, 'failed');
    expect(failed.transcript.error).toMatch(/AMR recordings can't be transcribed/);
    expect(fetched).toBe(false);
  });

  test('only audio files are accepted', async () => {
    const exec = await makeExecutive();
    const { lead, note } = await makeCallNote(exec);
    const res = await upload(exec.token, lead._id, note._id, { type: 'application/pdf' });
    expect([400, 415]).toContain(res.status);
  });
});
