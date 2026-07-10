// Yüklenen görselleri küçültüp data URL'e çevirir (düşük boyut için).
export async function fileToDataUrl(file: File, max: number): Promise<string> {
  const bitmap = await createImageBitmap(file)
  const scale = Math.min(1, max / Math.max(bitmap.width, bitmap.height))
  const w = Math.round(bitmap.width * scale)
  const h = Math.round(bitmap.height * scale)
  const canvas = document.createElement("canvas")
  canvas.width = w
  canvas.height = h
  const ctx = canvas.getContext("2d")!
  ctx.drawImage(bitmap, 0, 0, w, h)
  return canvas.toDataURL("image/jpeg", 0.8)
}

const COLORS = ["#5865f2", "#23a55a", "#e67e22", "#eb459e", "#3498db", "#f1c40f", "#e74c3c", "#1abc9c"]

export function colorFromName(name: string): string {
  let hash = 0
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash)
  return COLORS[Math.abs(hash) % COLORS.length]
}
