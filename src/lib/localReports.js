function getKey(userId) {
  return `lab_assistant_local_reports:${userId || "anonymous"}`;
}

function read(userId) {
  try {
    const raw = localStorage.getItem(getKey(userId));
    if (!raw) return [];
    const data = JSON.parse(raw);
    return Array.isArray(data) ? data : [];
  } catch {
    return [];
  }
}

function write(rows, userId) {
  localStorage.setItem(getKey(userId), JSON.stringify(rows));
}

export function getLocalReports(userId) {
  return read(userId).sort((a, b) => +new Date(b.created_at) - +new Date(a.created_at));
}

export function getLocalReportById(id, userId) {
  return read(userId).find((r) => r.id === id) ?? null;
}

export function createLocalReport(input, userId) {
  const report = {
    ...input,
    id: `local_${crypto.randomUUID()}`,
    created_at: new Date().toISOString(),
    local_only: true,
  };
  const rows = read(userId);
  rows.unshift(report);
  write(rows.slice(0, 50), userId);
  return report;
}

export function deleteLocalReport(id, userId) {
  const rows = read(userId);
  const nextRows = rows.filter((r) => r.id !== id);
  write(nextRows, userId);
  return nextRows.length !== rows.length;
}
