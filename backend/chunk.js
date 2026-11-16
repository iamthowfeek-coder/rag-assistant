// Splits a document into passages of roughly MAX characters.
// Paragraphs are kept together when they fit; long ones are split at sentence ends.
const MAX = 800;

function splitLong(text) {
  const out = [];
  let current = '';
  for (const s of text.split(/(?<=[.!?])\s+/)) {
    if ((current + ' ' + s).trim().length > MAX && current) {
      out.push(current.trim());
      current = '';
    }
    current += ' ' + s;
    while (current.trim().length > MAX) { // one huge sentence: cut it
      out.push(current.trim().slice(0, MAX));
      current = current.trim().slice(MAX);
    }
  }
  if (current.trim()) out.push(current.trim());
  return out;
}

exports.chunkText = (raw) => {
  const text = String(raw).replace(/\0/g, '').replace(/\r\n?/g, '\n');
  const paragraphs = text.split(/\n\s*\n/).map((p) => p.replace(/\s+/g, ' ').trim()).filter(Boolean);
  const passages = [];
  let current = '';
  for (const p of paragraphs) {
    const pieces = p.length > MAX ? splitLong(p) : [p];
    for (const piece of pieces) {
      if (current && (current + '\n\n' + piece).length > MAX) {
        passages.push(current);
        current = '';
      }
      current = current ? current + '\n\n' + piece : piece;
    }
  }
  if (current) passages.push(current);
  return passages;
};
