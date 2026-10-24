const mongoose = require('mongoose');
const CallNote = require('../models/CallNote');
const Lead = require('../models/Lead');
const ApiError = require('../utils/apiError');
const asyncHandler = require('../utils/asyncHandler');
const { MAX_BYTES, formatFor, saveRecording, transcribeCallNote } = require('../services/callRecordingService');

const MANAGER_ROLES = ['admin', 'sales_manager', 'team_leader'];

/**
 * The call note on this lead, if the signed-in user may see it: its own caller, or a manager.
 * A Sales Executive also needs the lead to be assigned to them (404 otherwise, like addCallNote).
 */
async function loadCallNote(req, { ownerOnly }) {
  const { id: leadId, noteId } = req.params;
  if (!mongoose.isValidObjectId(leadId) || !mongoose.isValidObjectId(noteId)) {
    throw new ApiError(404, 'Call not found');
  }
  const role = req.user?.role;
  const lead = await Lead.findOne({
    _id: leadId,
    ...(req.branchId ? { branchId: req.branchId } : {}),
    isDeleted: { $ne: true },
    ...(role === 'sales_executive' ? { assignedTo: req.user._id } : {}),
  }).select('_id').lean();
  if (!lead) throw new ApiError(404, 'Call not found');

  const callNote = await CallNote.findOne({ _id: noteId, leadId: lead._id }).lean();
  if (!callNote) throw new ApiError(404, 'Call not found');

  const isCaller = String(callNote.userId) === String(req.user._id);
  if (ownerOnly ? !isCaller : !(isCaller || MANAGER_ROLES.includes(role))) {
    throw new ApiError(404, 'Call not found');
  }
  return callNote;
}

function transcriptView(callNote) {
  return {
    callNoteId: callNote._id,
    hasRecording: Boolean(callNote.recording?.uploadedAt),
    recording: callNote.recording?.uploadedAt
      ? {
        fileName: callNote.recording.fileName,
        sizeBytes: callNote.recording.sizeBytes,
        durationMs: callNote.recording.durationMs,
        uploadedAt: callNote.recording.uploadedAt,
      }
      : null,
    transcript: callNote.transcript?.status
      ? {
        status: callNote.transcript.status,
        text: callNote.transcript.text || '',
        model: callNote.transcript.model,
        error: callNote.transcript.error,
        completedAt: callNote.transcript.completedAt,
      }
      : null,
  };
}

/**
 * POST /api/leads/:id/call-notes/:noteId/recording — raw audio body (Content-Type audio/*).
 * Only the executive who logged the call can attach its recording. Transcription runs after
 * the response; poll GET …/transcript for the result.
 */
const uploadCallRecording = asyncHandler(async (req, res) => {
  const callNote = await loadCallNote(req, { ownerOnly: true });
  const mimeType = req.headers['content-type'];
  if (!formatFor(mimeType)) throw new ApiError(415, 'Send the recording as an audio file (m4a, mp3, wav, aac, ogg, amr…).');
  const buffer = req.body;
  if (!Buffer.isBuffer(buffer) || buffer.length === 0) throw new ApiError(400, 'The recording is empty.');
  if (buffer.length > MAX_BYTES) throw new ApiError(413, 'The recording is larger than 25 MB.');

  const saved = await saveRecording(callNote, {
    buffer,
    mimeType,
    fileName: req.headers['x-recording-name'],
    durationMs: req.headers['x-recording-duration-ms'],
  });

  res.status(201).json(transcriptView(saved));

  if (saved.transcript?.status === 'pending') {
    setImmediate(() => {
      transcribeCallNote(saved._id).catch(() => {});
    });
  }
});

/** GET /api/leads/:id/call-notes/:noteId/transcript — recording info and transcript (read-only). */
const getCallTranscript = asyncHandler(async (req, res) => {
  const callNote = await loadCallNote(req, { ownerOnly: false });
  res.json(transcriptView(callNote));
});

module.exports = { uploadCallRecording, getCallTranscript };
