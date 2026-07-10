/**
 * Session management utilities for FORJA
 *
 * Handles workout session grouping and deduplication logic
 */

import { dataSessao } from './dateUtils.js';

/**
 * Retrieves all workout records belonging to a specific session
 *
 * A session is defined by:
 * - Same day (dia field, case-insensitive)
 * - Same workout date (from dataSessao, which prioritizes data_treino)
 *
 * Used for:
 * - Deduplication (prevent saving same workout twice)
 * - Session aggregation (group exercises into single session)
 * - Overwrite detection (show previous session exercises)
 */
export function registrosDaSessao(dia, dataIso, registros = []) {
  if (!registros || !Array.isArray(registros)) return [];

  const D = String(dia).toUpperCase();
  return registros.filter(r => {
    const rDia = String(r.dia || '').toUpperCase();
    const rData = dataSessao(r);
    return rDia === D && rData === dataIso;
  });
}

/**
 * Checks if a workout is a duplicate of any existing session
 *
 * Returns true if:
 * - Same day
 * - Same date
 * - Any exercises already recorded in that session
 *
 * Note: Does NOT compare individual exercise details (load, reps, etc)
 * Only checks if session already has ANY exercises
 */
export function isDuplicateSession(dia, dataIso, registros = []) {
  const existing = registrosDaSessao(dia, dataIso, registros);
  return existing.length > 0;
}

/**
 * Removes all records from a specific session
 * Used for "overwrite" functionality
 */
export function removeSession(dia, dataIso, registros = []) {
  if (!registros || !Array.isArray(registros)) return [];

  const D = String(dia).toUpperCase();
  return registros.filter(r => {
    const rDia = String(r.dia || '').toUpperCase();
    const rData = dataSessao(r);
    return !(rDia === D && rData === dataIso);
  });
}

/**
 * Calculates session duration from multiple workout records
 *
 * Logic:
 * - Groups records by (date + day)
 * - For each group, calculates span from first to last save
 * - Filters by plausible duration (3min to 5h)
 * - Excludes sessions with only 1 record (not a real session)
 * - Excludes LANCAR SESSAO saves (~0 span)
 *
 * Returns array of durations in minutes
 */
export function duracaoSessoes(regs) {
  const g = {};
  (regs || []).forEach(r => {
    const k = dataSessao(r) + '__' + String(r.dia || '').toUpperCase();
    const t = new Date(r.timestamp).getTime();
    if (!isNaN(t)) {
      if (!g[k]) g[k] = [];
      g[k].push(t);
    }
  });

  const durs = [];
  Object.values(g).forEach(ts => {
    if (ts.length < 2) return; // Only real sessions (2+ records)
    const span = (Math.max.apply(null, ts) - Math.min.apply(null, ts)) / 60000;
    if (span >= 3 && span <= 300) durs.push(span); // 3min to 5h
  });

  return durs;
}

/**
 * Gets the most recent workout timestamp for a given student
 */
export function ultimoTreinoTimestamp(registros = []) {
  if (!registros || registros.length === 0) return null;

  let maxTime = null;
  let maxReg = null;

  registros.forEach(r => {
    const t = new Date(r.timestamp).getTime();
    if (!isNaN(t) && (maxTime === null || t > maxTime)) {
      maxTime = t;
      maxReg = r;
    }
  });

  return maxReg;
}
