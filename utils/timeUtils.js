export const formatDuration = (ms) => {
  if (ms < 1000) {
    return "Less than a second";
  }

  let totalSeconds = Math.floor(ms / 1000);
  let hours = Math.floor(totalSeconds / 3600);
  totalSeconds %= 3600;
  let minutes = Math.floor(totalSeconds / 60);
  let seconds = totalSeconds % 60;

  const parts = [];
  if (hours > 0) {
    parts.push(`${hours}h`);
  }
  if (minutes > 0) {
    parts.push(`${minutes}m`);
  }
  if (seconds > 0 || parts.length === 0) { // show seconds if it's the only unit
    parts.push(`${seconds}s`);
  }

  return parts.join(' ');
};

export const formatCountdown = (ms) => {
  if (ms <= 0) {
    return "00:00:00";
  }

  let totalSeconds = Math.floor(ms / 1000);
  let hours = Math.floor(totalSeconds / 3600);
  totalSeconds %= 3600;
  let minutes = Math.floor(totalSeconds / 60);
  let seconds = totalSeconds % 60;

  const pad = (num) => num.toString().padStart(2, '0');

  return `${pad(hours)}:${pad(minutes)}:${pad(seconds)}`;
};

export const getISODateString = (date) => {
    return date.toISOString().split('T')[0];
};

export const getStartOfWeekISOString = (date) => {
    const d = new Date(date);
    const day = d.getDay(); // Sunday - 0, Monday - 1, ...
    const diff = d.getDate() - day + (day === 0 ? -6 : 1); // adjust when day is sunday
    const monday = new Date(d.setDate(diff));
    return getISODateString(monday);
};
