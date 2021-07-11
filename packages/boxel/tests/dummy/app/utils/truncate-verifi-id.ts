export function truncateVerifiId(id: string): string {
  if (!id) {
    return 'N/A';
  }
  return `${id.slice(0, 6)}...${id.slice(-4)}`;
}
