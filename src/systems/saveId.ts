/** getRandomValues also works for a phone visiting the LAN HTTP preview. */
export function saveId() {
  return Array.from(crypto.getRandomValues(new Uint32Array(4)), value => value.toString(16).padStart(8, '0')).join('');
}
