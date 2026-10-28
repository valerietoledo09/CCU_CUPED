export const MAX_TEAM_PHOTO_BYTES = 2 * 1024 * 1024;
const PHOTO_ALT = 'CCU CUPED team photo';
const MIME_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);
const BASE64 = /^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/;

function hasSignature(bytes, type) {
 if (type === 'image/jpeg') return bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
 if (type === 'image/png') return bytes.length >= 8 && [137,80,78,71,13,10,26,10].every((value, i) => bytes[i] === value);
 if (type === 'image/webp') return bytes.length >= 12 && String.fromCharCode(...bytes.subarray(0,4)) === 'RIFF' && String.fromCharCode(...bytes.subarray(8,12)) === 'WEBP';
 return false;
}

function toBase64(bytes) {
 const parts = [];
 // Limit each call's argument count, including for photos near the size limit.
 for (let i = 0; i < bytes.length; i += 32768) parts.push(String.fromCharCode(...bytes.subarray(i, i + 32768)));
 return btoa(parts.join(''));
}

export function isValidTeamPhoto(photo) {
 if (photo === undefined || photo === null) return true;
 if (typeof photo !== 'object' || Array.isArray(photo) || typeof photo.dataUrl !== 'string' || typeof photo.alt !== 'string' || !photo.alt.trim() || photo.alt.length > 300) return false;
 // Reject remote URLs, SVG, HTML, and oversized input before decoding it.
 if (photo.dataUrl.length > Math.ceil(MAX_TEAM_PHOTO_BYTES / 3) * 4 + 40) return false;
 const match = /^data:(image\/(?:jpeg|png|webp));base64,([A-Za-z0-9+/=]+)$/.exec(photo.dataUrl);
 if (!match || !BASE64.test(match[2])) return false;
 const encoded = match[2], padding = encoded.endsWith('==') ? 2 : encoded.endsWith('=') ? 1 : 0;
 const size = encoded.length / 4 * 3 - padding;
 if (size <= 0 || size > MAX_TEAM_PHOTO_BYTES) return false;
 try {
  const binary = atob(encoded);
  if (btoa(binary) !== encoded) return false;
  return hasSignature(Uint8Array.from(binary.slice(0,12), char => char.charCodeAt(0)), match[1]);
 } catch { return false; }
}

async function verifyBrowserImage(dataUrl) {
 // Node's unit runner has no image decoder; browsers validate before accepting a file.
 if (typeof globalThis.Image !== 'function') return;
 await new Promise((resolve, reject) => {
  const image = new Image();
  image.onload = () => image.naturalWidth > 0 && image.naturalHeight > 0 ? resolve() : reject(new Error('This photo could not be opened. Choose a valid JPG, PNG, or WebP file.'));
  image.onerror = () => reject(new Error('This photo could not be opened. Choose a valid JPG, PNG, or WebP file.'));
  image.src = dataUrl;
 });
}

export async function fileToTeamPhoto(file) {
 if (!file || typeof file.arrayBuffer !== 'function' || !Number.isFinite(file.size) || file.size <= 0) throw new Error('Choose a JPG, PNG, or WebP photo.');
 if (file.size > MAX_TEAM_PHOTO_BYTES) throw new Error('Choose a photo no larger than 2 MB.');
 const type = typeof file.type === 'string' ? file.type.toLowerCase() : '';
 if (!MIME_TYPES.has(type)) throw new Error('Choose a JPG, PNG, or WebP photo.');
 const bytes = new Uint8Array(await file.arrayBuffer());
 if (!bytes.length || bytes.length > MAX_TEAM_PHOTO_BYTES) throw new Error('Choose a photo no larger than 2 MB.');
 if (!hasSignature(bytes, type)) throw new Error('The file does not match its image type. Choose a valid JPG, PNG, or WebP photo.');
 const photo = {dataUrl: 'data:' + type + ';base64,' + toBase64(bytes), alt: PHOTO_ALT};
 if (!isValidTeamPhoto(photo)) throw new Error('This photo could not be saved. Choose a valid JPG, PNG, or WebP file.');
 await verifyBrowserImage(photo.dataUrl);
 return photo;
}
