export function truncateVerifiId(id) {
  if (!id) { return 'N/A'; }
  return `${id.slice(0, 6)}...${id.slice(-4)}`;
}
