/**
 * Minimal in-memory WebRTC signaling endpoint.
 *
 * Akış:
 *  1. Peer A (initiator) → POST /api/signal  { room, peerId, type:"offer",  sdp, publicKey }
 *  2. Peer B (receiver)  → GET  /api/signal?room=X    → offer + mevcut peers listesi
 *  3. Peer B             → POST /api/signal  { room, peerId, type:"answer", sdp, targetId, publicKey }
 *  4. Peer A             → GET  /api/signal?room=X&peerId=A → answer'ı çek
 *
 * Vercel serverless ortamında process.env içinde global bir Map paylaşılır
 * (tek instance warm kalırsa çalışır). Production için Redis/Upstash önerilir.
 */

import { NextRequest, NextResponse } from "next/server"

// ---- Global in-process store (warm lambda paylaşımı) ----
type SignalEntry = {
  peerId: string
  type: "offer" | "answer" | "candidate" | "presence"
  sdp?: string
  candidate?: string
  targetId?: string   // answer / candidate için kimin için
  publicKey: string   // NaCl X25519 public key (base64)
  ts: number
}

declare global {
  // eslint-disable-next-line no-var
  var __signalStore: Map<string, SignalEntry[]> | undefined
}

const store: Map<string, SignalEntry[]> =
  global.__signalStore ?? (global.__signalStore = new Map())

const TTL_MS = 2 * 60 * 1000 // 2 dakika

function gc() {
  const now = Date.now()
  store.forEach((entries, room) => {
    const fresh = entries.filter((e) => now - e.ts < TTL_MS)
    if (fresh.length === 0) store.delete(room)
    else store.set(room, fresh)
  })
}

// ---- POST: sinyal yayınla ----
export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { room, peerId, type, sdp, candidate, targetId, publicKey } =
      body as SignalEntry & { room: string }

    if (!room || !peerId || !type || !publicKey) {
      return NextResponse.json({ error: "Eksik alan" }, { status: 400 })
    }

    gc()
    const entries = store.get(room) ?? []

    if (type === "candidate") {
      // ICE candidate'ları biriktir (duplikat ekleme)
      const dup = entries.some(
        (e) => e.type === "candidate" && e.candidate === candidate && e.targetId === targetId,
      )
      if (!dup) entries.push({ peerId, type, candidate, targetId, publicKey, ts: Date.now() })
    } else {
      // offer / answer / presence: aynı peerId + type varsa güncelle
      const idx = entries.findIndex((e) => e.peerId === peerId && e.type === type)
      const entry: SignalEntry = { peerId, type, sdp, candidate, targetId, publicKey, ts: Date.now() }
      if (idx >= 0) entries[idx] = entry
      else entries.push(entry)
    }

    store.set(room, entries)
    return NextResponse.json({ ok: true })
  } catch {
    return NextResponse.json({ error: "İstek işlenemedi" }, { status: 500 })
  }
}

// ---- GET: oda sinyallerini çek ----
export async function GET(req: NextRequest) {
  gc()
  const { searchParams } = req.nextUrl
  const room = searchParams.get("room") ?? ""
  const myId = searchParams.get("peerId") ?? ""

  if (!room) return NextResponse.json({ entries: [] })

  const entries = (store.get(room) ?? []).filter((e) => e.peerId !== myId)
  return NextResponse.json({ entries })
}

// ---- DELETE: odadan ayrıl ----
export async function DELETE(req: NextRequest) {
  const { room, peerId } = await req.json()
  if (room && peerId) {
    const entries = (store.get(room) ?? []).filter((e) => e.peerId !== peerId)
    if (entries.length === 0) store.delete(room)
    else store.set(room, entries)
  }
  return NextResponse.json({ ok: true })
}
