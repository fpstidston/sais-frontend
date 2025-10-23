export function base64ToUint8Array(b64) {
  return Uint8Array.from(atob(b64), c => c.charCodeAt(0));
}

export function bufferToBase64(buffer) {
  return btoa(String.fromCharCode(...new Uint8Array(buffer)));
}
