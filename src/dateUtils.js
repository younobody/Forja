/**
 * Date/Time utilities for FORJA
 * Handles multiple date formats with timezone awareness
 *
 * Known issues fixed:
 * - v22: new Date("2026-06-22") UTC → local timezone conversion
 * - v28.4: calendar day comparison (not absolute hours)
 * - v28.4: partial date validation ("04/07" without year)
 */

/**
 * Extracts YYYY-MM-DD from data_treino field, tolerating multiple formats
 *
 * Handles:
 * - "2026-05-28" (string ISO)
 * - "2026-05-28T00:00:00.000Z" (Sheets Date object → ISO with time)
 * - "28/05/2026" (pt-BR format)
 * - "28/05/26" (pt-BR short year)
 *
 * Returns '' if no valid date found or only partial date ("04/07" without year)
 */
export function dataTreinoLimpa(v) {
  const s = String(v == null ? '' : v).trim();
  if (!s) return '';

  // "2026-05-28" or "2026-05-28T00:00:00.000Z" → "2026-05-28"
  let m = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (m) return `${m[1]}-${m[2]}-${m[3]}`;

  // Formatos pt-BR que o Sheets as vezes guarda ("28/05/2026" ou "28/05/26")
  m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})$/);
  if (m) {
    let dd = m[1], mm = m[2], yy = m[3];
    if (yy.length === 2) yy = '20' + yy;
    return `${yy}-${mm.padStart(2, '0')}-${dd.padStart(2, '0')}`;
  }

  return '';
}

/**
 * Returns YYYY-MM-DD of the local timezone date from any timestamp
 *
 * Robust to:
 * - ISO UTC ("2026-05-27T01:00:00.000Z" in Brazil = 22h of day 26)
 * - ISO with timezone ("2026-05-26T22:00:00-03:00")
 * - Date object from Google Sheets
 * - Plain date strings ("2026-05-28")
 *
 * Works because new Date() understands all formats and getFullYear/Month/Date
 * return values in local browser timezone.
 */
export function dataLocalIso(ts) {
  try {
    const s = String(ts == null ? '' : ts).trim();

    // v22: timestamp SO com a data ("2026-06-22", sem hora) → usa direto
    const bare = s.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (bare) return `${bare[1]}-${bare[2]}-${bare[3]}`;

    // v28.4: "dd/mm" digitado a mao sem ano (ex: "04/07") - rejeita explicitamente
    if (/^\d{1,2}\/\d{1,2}$/.test(s)) return '';

    const d = new Date(s);
    if (isNaN(d.getTime())) {
      const m = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
      return m ? `${m[1]}-${m[2]}-${m[3]}` : s.slice(0, 10);
    }

    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  } catch {
    return String(ts || '').slice(0, 10);
  }
}

/**
 * Returns YYYY-MM-DD of today in local timezone
 */
export function hojeIso() {
  const h = new Date();
  return `${h.getFullYear()}-${String(h.getMonth() + 1).padStart(2, '0')}-${String(h.getDate()).padStart(2, '0')}`;
}

/**
 * Data da sessao para agrupar/plotar: prioriza o data_treino confirmado pelo
 * aluno; so cai no timestamp local se nao houver data_treino valido.
 */
export function dataSessao(r) {
  return dataTreinoLimpa(r.data_treino) || dataLocalIso(r.timestamp);
}

/**
 * Formats YYYY-MM-DD ISO date to pt-BR format (DD/MM/YY)
 *
 * Handles:
 * - ISO date string ("2026-05-28")
 * - ISO with time ("2026-05-28T15:30:00Z")
 * - Date object
 *
 * v22 fix: new Date("2026-05-28") was interpreted as UTC midnight,
 * which in Brazil (-3) became 21h of previous day. Now we build Date
 * in local timezone for plain date strings.
 */
export function fmtDate(iso) {
  try {
    const s = String(iso || '');
    if (!s) return '—';
    const m = s.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    const d = m
      ? new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]))
      : new Date(iso);
    const result = d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: '2-digit' });
    return result === 'Invalid Date' ? '—' : result;
  } catch {
    return '—';
  }
}

/**
 * Formats timestamp to pt-BR datetime (DD/MM HH:MM)
 */
export function fmtDateTime(iso) {
  try {
    const d = new Date(iso);
    const result = d.toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
    return result === 'Invalid Date' || !iso ? '—' : result;
  } catch {
    return '—';
  }
}

/**
 * Aceita timestamp ISO completo OU 'YYYY-MM-DD' (ex: saida de dataSessao()).
 * Compara DIA DE CALENDARIO, nao horas absolutas
 *
 * v28.4 fix: antes, um treino feito as 23h "virava" 2d atras so 25h depois
 * (as 0h do dia seguinte), porque o calculo era so (agora - entao)/24h.
 * Agora "ontem" sempre quer dizer o dia de calendario anterior.
 */
export function daysAgo(input) {
  try {
    const s = String(input == null ? '' : input).trim();
    const m = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
    const d = m ? new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3])) : new Date(s);

    if (isNaN(d.getTime())) return '—';

    const hoje = new Date();
    const dCal = new Date(d.getFullYear(), d.getMonth(), d.getDate());
    const hojeCal = new Date(hoje.getFullYear(), hoje.getMonth(), hoje.getDate());
    const diffDias = Math.round((hojeCal - dCal) / (1000 * 60 * 60 * 24));

    if (diffDias <= 0) return 'hoje';
    if (diffDias === 1) return 'ontem';
    return `${diffDias}d atras`;
  } catch {
    return '—';
  }
}
