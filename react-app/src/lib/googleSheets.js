// Same JSONP mechanism the vanilla app used (script-tag injection with a
// `?callback=` param) — sidesteps CORS entirely, so the Apps Script endpoint
// needs zero changes for this port. Wrapped in Promises for async/await use
// in React components instead of the original's raw callback style.

function jsonp(url, cbPrefix, timeoutMs) {
  return new Promise((resolve) => {
    const cbName = cbPrefix + '_' + Date.now();
    const script = document.createElement('script');
    const timeout = setTimeout(() => {
      delete window[cbName];
      script.remove();
      resolve({ result: 'error', error: 'Timed out.' });
    }, timeoutMs);

    window[cbName] = (result) => {
      clearTimeout(timeout);
      delete window[cbName];
      script.remove();
      resolve(result);
    };
    script.src = url + (url.includes('?') ? '&' : '?') + 'callback=' + cbName;
    script.onerror = () => {
      clearTimeout(timeout);
      delete window[cbName];
      script.remove();
      resolve({ result: 'error', error: 'Could not reach Apps Script URL.' });
    };
    document.head.appendChild(script);
  });
}

export function exportAllToSheets(history, endpoint) {
  const rows = history.map((r) => {
    if (r.type === 'ah') {
      return {
        sheet: 'ah', rowId: r.rowId, date: r.date, speaker: r.speaker, category: r.cat,
        ah: r.counts['Ah'] || 0, um: r.counts['Um'] || 0, er: r.counts['Er'] || 0,
        well: r.counts['Well'] || 0, so: r.counts['So'] || 0, like: r.counts['Like'] || 0,
        but: r.counts['But'] || 0, repeats: r.counts['Repeats'] || 0, other: r.counts['Other'] || 0,
        total: r.total, update: r.needsUpdate === true,
      };
    }
    return {
      sheet: 'timer', rowId: r.rowId, date: r.date, speaker: r.speaker, category: r.cat,
      green: r.green || 0, yellow: r.yellow || 0, red: r.red || 0,
      elapsed: r.elapsed || 0, within: r.within ? 1 : 0, update: r.needsUpdate === true,
    };
  });
  const url = endpoint + '?data=' + encodeURIComponent(JSON.stringify({ rows }));
  return jsonp(url, 'gsCallback', 12000);
}

export function loadSheet(endpoint, sheetName) {
  const url = endpoint + '?action=read&sheet=' + sheetName;
  return jsonp(url, 'gsLoad_' + sheetName, 8000).then((result) =>
    result.result === 'success' && result.rows ? result.rows : []
  );
}

export async function loadFromSheets(endpoint) {
  const [ah, timer] = await Promise.all([
    loadSheet(endpoint, 'ah'),
    loadSheet(endpoint, 'timer'),
  ]);
  return [...ah, ...timer];
}
