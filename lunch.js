// Source: school-provided 2026–2027 Lunch Schedule for A–B Days.
export const firstLunchRooms = new Set('54 55 56 57 58 59 61 62 63 64 65 66 67 68 69 71 82 83 101 102 104 105 106 107 111 112 116 117 119 138 139 201E 211 212 213 214 215 217 218 219 221 222 223 224 225 226 227 228 229 237 238 239 264 265 268 271 272 281 282 283 284 285 291'.split(' '));
export const secondLunchRooms = new Set('36 93 140 141 142 146 147 148 176 178 181 192 241 242 243 244 245 246 247 248 249 254 255 256 257 261 262 263 301 302 305 307 308 309 310 402 403 404 405 406 407 408 409 410 413 415 416 421 422 423 424 425 426 427 428 429 432'.split(' '));
export function roomLunch(room=''){const normalized=room.toUpperCase().replace(/^(ROOM|RM)\.?\s*/,'').replace(/\s*PE$/,'').trim();return firstLunchRooms.has(normalized)?'first':secondLunchRooms.has(normalized)?'second':null;}
export function departmentLunch(department=''){
 if(/Language Arts|Social Studies|World Language|Agriscience|Engineering|AG\/ENG|Fine Arts – Art|FLVS|Drama/i.test(department))return 'first';
 if(/Mathematics|Science|Medical|Business|Legal|Office Aides|Band|Chorus|Orchestra|Dance|Physical Education|^PE$/i.test(department))return 'second';
 return null;
}
