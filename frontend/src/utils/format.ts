export const formatDuration = (hours: number): string => {
  if (hours <= 0) return '0m';
  if (hours < 1) {
    const minutes = Math.round(hours * 60);
    return `${minutes}m`;
  }
  const days = Math.floor(hours / 24);
  const remainingHours = Math.floor(hours % 24);
  const remainingMinutes = Math.round((hours * 60) % 60);

  const parts = [];
  if (days > 0) parts.push(`${days}d`);
  if (remainingHours > 0) parts.push(`${remainingHours}h`);
  if (remainingMinutes > 0 && days === 0) parts.push(`${remainingMinutes}m`);

  return parts.length > 0 ? parts.join(' ') : '0m';
};
