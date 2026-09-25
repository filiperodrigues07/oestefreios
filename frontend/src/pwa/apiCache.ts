/** Remove o cache de API criado por versões anteriores da PWA. */
export async function clearLegacyApiCache(): Promise<void> {
  if (typeof caches === 'undefined') return;
  await caches.delete('api-data');
}
