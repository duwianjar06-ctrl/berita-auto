import {INSTAGRAM_NORMAL_PUBLISH_INTERVAL_MS} from './instagram-automation.js';

const PUBLISHER_TRIGGERS = new Set([
  'social-publish-auto-upload',
  'social-publish',
  'manual-publish',
  'prepare-immediate',
  'publish',
  'scheduled',
]);

export const INSTAGRAM_PUBLISH_CADENCE_MS = INSTAGRAM_NORMAL_PUBLISH_INTERVAL_MS;
export const INSTAGRAM_PUBLISH_OVERDUE_GRACE_MS = 90 * 1000;

export function isInstagramPublisherRun(run = {}) {
  const source = String(run?.triggerSource || run?.trigger || run?.triggerType || '').trim().toLowerCase();
  return PUBLISHER_TRIGGERS.has(source) || source.includes('instagram-publish') || source.includes('social-publish');
}

export function normalizePublisherTrigger(run = {}) {
  const source = String(run?.triggerSource || run?.trigger || '').trim();
  if (!isInstagramPublisherRun(run)) return { ...run, triggerSource: source || 'unknown', triggerType: 'other', triggerLabel: source || 'Unknown' };
  return { ...run, triggerSource: source || 'social-publish', triggerType: 'publisher', triggerLabel: source === 'social-publish-auto-upload' ? 'Auto Upload' : source === 'manual-publish' ? 'Manual Publish' : 'Instagram Publisher' };
}

export function expectedNextInvocationAt(lastInvocationAt) {
  const value = Date.parse(lastInvocationAt || '');
  return Number.isFinite(value) ? new Date(value + INSTAGRAM_PUBLISH_CADENCE_MS).toISOString() : null;
}

export function schedulerHealth(lastInvocationAt, now = Date.now()) {
  const last = Date.parse(lastInvocationAt || '');
  if (!Number.isFinite(last)) return { state: 'UNKNOWN', overdue: false, expectedNextInvocationAt: null, overdueMs: 0 };
  const expected = last + INSTAGRAM_PUBLISH_CADENCE_MS;
  const overdue = now > expected + INSTAGRAM_PUBLISH_OVERDUE_GRACE_MS;
  return {
    state: overdue ? 'OVERDUE' : now >= expected ? 'DUE' : 'NORMAL',
    overdue,
    expectedNextInvocationAt: new Date(expected).toISOString(),
    overdueMs: overdue ? Math.max(0, now - expected) : 0,
  };
}

export function humanizeInstagramMetaError({ metaCode, metaSubcode, message, httpStatus } = {}) {
  const code = Number(metaCode) || 0;
  const subcode = Number(metaSubcode) || 0;
  if (code === 9004 && subcode === 2207052) {
    return {
      headline: 'Media carousel tidak diterima Instagram.',
      message: 'Instagram menolak salah satu media karena format yang diterima tidak dikenali sebagai foto/video yang valid.',
      technical: { httpStatus: Number(httpStatus) || 400, metaCode: code, metaSubcode: subcode, rawMessage: String(message || '').slice(0, 300) },
    };
  }
  return {
    headline: 'Publikasi Instagram gagal.',
    message: String(message || 'Instagram mengembalikan kesalahan yang tidak dapat dipulihkan saat ini.').slice(0, 300),
    technical: { httpStatus: Number(httpStatus) || null, metaCode: code || null, metaSubcode: subcode || null, rawMessage: String(message || '').slice(0, 300) },
  };
}

export function latestAttempt(row = {}) {
  if (row?.latestAttempt && typeof row.latestAttempt === 'object') return row.latestAttempt;
  const history = Array.isArray(row?.publishAttemptHistory) ? row.publishAttemptHistory : [];
  return history.length ? history[history.length - 1] : null;
}

export function trimAttemptHistory(history, max = 50) {
  return (Array.isArray(history) ? history : []).slice(-Math.max(1, Math.min(50, Number(max) || 50)));
}
