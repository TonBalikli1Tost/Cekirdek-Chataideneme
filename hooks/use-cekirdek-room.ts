"use client"

/**
 * Gerçek P2P hook — Native WebRTC (RTCPeerConnection) + NaCl E2EE
 *
 * Mimari:
 *  - Kendi /api/signal Route Handler üzerinden offer/answer değişimi (HTTP polling)
 *  - trickle ICE: her ICE candidate ayrıca API'ye yazılır, polling ile alınır
 *  - Her text mesajı NaCl box (X25519 + XSalsa20-Poly1305) ile şifrelenir
 *  - Ses WebRTC MediaStream olarak doğrudan akar
 */

import { useCallback, useEffect, useRef, useState } from "react"
import { generateKeyPair, encryptMsg, decryptMsg, type KeyPair } from "@/lib/encryption"

// ── Tipler ──────────────────────────────────────────────────────────────────

export type ChatMessage = {
  id: string
  peerId: string
  name: string
  color: string
  avatar?: string
  text?: string
  image?: string
  ts: number
  system?: boolean
  encrypted?: boolean
}

export type Member = {
  peerId: string
  name: string
  color: string
  avatar?: string
}

export type Profile = {
  name: string
  color: string
  avatar?: string
}

type DataMsg =
  | { t: "hello"; peerId: string; name: string; color: string; avatar?: string; publicKey: string }
  | { t: "roster"; peers: string[] }
  | { t: "chat"; id: string; peerId: string; name: string; color: string; avatar?: string; ts: number; text?: string; image?: string; encrypted?: boolean; nonce?: string; ciphertext?: string }
  | { t: "bye"; peerId: string }

// ── Yardımcılar ─────────────────────────────────────────────────────────────

function slug(s: string) {
  return s.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "") || "genel"
}

const COLORS = ["#5865f2","#57f287","#fee75c","#eb459e","#ed4245","#3ba55c","#faa61a","#00b0f4"]
export function colorFromName(name: string) {
  let h = 0
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) >>> 0
  return COLORS[h % COLORS.length]
}

const MAX_MSGS = 100
const POLL_MS  = 2000

const ICE_SERVERS: RTCIceServer[] = [
  { urls: "stun:stun.l.google.com:19302" },
  { urls: "stun:stun1.l.google.com:19302" },
]

// ── Signal API yardımcıları ──────────────────────────────────────────────────

async function sigPost(body: object) {
  await fetch("/api/signal", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  }).catch(() => {})
}

async function sigGet(room: string, myId: string) {
  try {
    const r = await fetch(`/api/signal?room=${room}&peerId=${myId}`)
    const j = await r.json()
    return j.entries as Array<{
      peerId: string; type: string; sdp?: string; candidate?: string;
      targetId?: string; publicKey: string
    }>
  } catch { return [] }
}

// ── Hook ────────────────────────────────────────────────────────────────────

export function useCekirdekRoom() {
  const [status,   setStatus  ] = useState<"idle"|"connecting"|"connected">("idle")
  const [members,  setMembers ] = useState<Member[]>([])
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [voiceOn,  setVoiceOn ] = useState(false)
  const [muted,    setMuted   ] = useState(false)

  const selfRef   = useRef({ name:"", color:"", avatar:"", peerId:"", publicKey:"", secretKey:"" })
  const roomRef   = useRef("")
  const myKP      = useRef<KeyPair>({ publicKey:"", secretKey:"" })

  // peerId → RTCPeerConnection
  const pcs       = useRef<Map<string, RTCPeerConnection>>(new Map())
  // peerId → RTCDataChannel
  const dcs       = useRef<Map<string, RTCDataChannel>>(new Map())
  // peerId → NaCl public key
  const pubKeys   = useRef<Map<string, string>>(new Map())
  // peerId → profile
  const profs     = useRef<Map<string, { name:string; color:string; avatar?:string }>>(new Map())

  const localStream = useRef<MediaStream | null>(null)
  const audioEls    = useRef<Map<string, HTMLAudioElement>>(new Map())
  const pollTimer   = useRef<ReturnType<typeof setInterval> | null>(null)

  // ── state helpers ─────────────────────────────────────────────────────────

  const rebuildMembers = useCallback(() => {
    const s = selfRef.current
    const list: Member[] = [{ peerId: s.peerId, name: s.name + " (sen)", color: s.color, avatar: s.avatar }]
    profs.current.forEach((p, id) => {
      if (id !== s.peerId) list.push({ peerId: id, ...p })
    })
    setMembers(list)
  }, [])

  const pushMsg = useCallback((msg: ChatMessage) => {
    setMessages(prev => [...prev, msg].slice(-MAX_MSGS))
  }, [])

  // ── data channel: gelen mesajı işle ───────────────────────────────────────

  const handleData = useCallback((fromId: string, raw: string) => {
    try {
      const msg = JSON.parse(raw) as DataMsg
      if (msg.t === "hello") {
        pubKeys.current.set(msg.peerId, msg.publicKey)
        profs.current.set(msg.peerId, { name: msg.name, color: msg.color, avatar: msg.avatar })
        rebuildMembers()
      } else if (msg.t === "roster") {
        msg.peers.forEach(pid => { if (!pcs.current.has(pid)) createOffer(pid) })
      } else if (msg.t === "chat") {
        let text = msg.text
        if (msg.encrypted && msg.nonce && msg.ciphertext) {
          const senderPub = pubKeys.current.get(msg.peerId)
          if (senderPub) {
            text = decryptMsg(
              { nonce: msg.nonce, ciphertext: msg.ciphertext },
              senderPub,
              myKP.current.secretKey,
            ) ?? "[çözülemedi]"
          }
        }
        pushMsg({ id: msg.id, peerId: msg.peerId, name: msg.name, color: msg.color,
                  avatar: msg.avatar, text, image: msg.image, ts: msg.ts,
                  encrypted: msg.encrypted })
      } else if (msg.t === "bye") {
        const p = profs.current.get(msg.peerId)
        profs.current.delete(msg.peerId)
        pubKeys.current.delete(msg.peerId)
        rebuildMembers()
        if (p) pushMsg({ id: crypto.randomUUID(), peerId:"sys", name:"sistem",
          color:"#949ba4", text:`${p.name} ayrıldı`, ts: Date.now(), system: true })
      }
    } catch {}
  }, [pushMsg, rebuildMembers]) // eslint-disable-line react-hooks/exhaustive-deps

  // ── RTCPeerConnection kurulumu ─────────────────────────────────────────────

  function makePc(peerId: string): RTCPeerConnection {
    const pc = new RTCPeerConnection({ iceServers: ICE_SERVERS })
    pcs.current.set(peerId, pc)

    // Ses stream'i ekle
    if (localStream.current) {
      localStream.current.getTracks().forEach(t => pc.addTrack(t, localStream.current!))
    }

    // ICE candidate → signaling API
    pc.onicecandidate = async ({ candidate }) => {
      if (!candidate) return
      await sigPost({
        room: roomRef.current,
        peerId: selfRef.current.peerId,
        type: "candidate",
        candidate: JSON.stringify(candidate),
        targetId: peerId,
        publicKey: selfRef.current.publicKey,
      })
    }

    // Gelen ses stream'i
    pc.ontrack = ({ streams }) => {
      const stream = streams[0]
      if (!stream) return
      let el = audioEls.current.get(peerId)
      if (!el) {
        el = document.createElement("audio")
        el.autoplay = true
        document.body.appendChild(el)
        audioEls.current.set(peerId, el)
      }
      el.srcObject = stream
      el.play().catch(() => {})
    }

    pc.onconnectionstatechange = () => {
      if (pc.connectionState === "failed" || pc.connectionState === "closed") {
        pcs.current.delete(peerId)
        dcs.current.delete(peerId)
      }
    }

    return pc
  }

  // ── Offer oluştur (initiator) ───────────────────────────────────────────

  const createOffer = useCallback(async (peerId: string) => {
    if (pcs.current.has(peerId) || peerId === selfRef.current.peerId) return
    const pc = makePc(peerId)

    const dc = pc.createDataChannel("cekirdek", { ordered: true })
    dcs.current.set(peerId, dc)
    dc.onopen = () => {
      const hello = { t:"hello", peerId: selfRef.current.peerId,
        name: selfRef.current.name, color: selfRef.current.color,
        avatar: selfRef.current.avatar, publicKey: selfRef.current.publicKey }
      dc.send(JSON.stringify(hello))
      setStatus("connected")
      rebuildMembers()

      // Host'sa roster gönder
      const others = Array.from(pcs.current.keys()).filter(id => id !== peerId)
      if (others.length > 0) {
        dc.send(JSON.stringify({ t:"roster", peers: others }))
      }
    }
    dc.onmessage = ({ data }) => handleData(peerId, data)
    dc.onclose = () => {
      dcs.current.delete(peerId)
      const p = profs.current.get(peerId)
      profs.current.delete(peerId)
      pubKeys.current.delete(peerId)
      rebuildMembers()
      if (p) pushMsg({ id: crypto.randomUUID(), peerId:"sys", name:"sistem",
        color:"#949ba4", text:`${p.name} ayrıldı`, ts: Date.now(), system: true })
    }

    const offer = await pc.createOffer()
    await pc.setLocalDescription(offer)

    await sigPost({
      room: roomRef.current,
      peerId: selfRef.current.peerId,
      type: "offer",
      sdp: JSON.stringify(pc.localDescription),
      publicKey: selfRef.current.publicKey,
    })
  }, [handleData, pushMsg, rebuildMembers]) // eslint-disable-line react-hooks/exhaustive-deps

  // ── Answer oluştur (receiver) ─────────────────────────────────────────────

  const createAnswer = useCallback(async (
    offerPeerId: string,
    sdpStr: string,
    offerPubKey: string,
  ) => {
    if (pcs.current.has(offerPeerId)) return
    pubKeys.current.set(offerPeerId, offerPubKey)
    const pc = makePc(offerPeerId)

    pc.ondatachannel = ({ channel: dc }) => {
      dcs.current.set(offerPeerId, dc)
      dc.onopen = () => {
        const hello = { t:"hello", peerId: selfRef.current.peerId,
          name: selfRef.current.name, color: selfRef.current.color,
          avatar: selfRef.current.avatar, publicKey: selfRef.current.publicKey }
        dc.send(JSON.stringify(hello))
        setStatus("connected")
        rebuildMembers()
      }
      dc.onmessage = ({ data }) => handleData(offerPeerId, data)
      dc.onclose = () => {
        dcs.current.delete(offerPeerId)
        const p = profs.current.get(offerPeerId)
        profs.current.delete(offerPeerId)
        pubKeys.current.delete(offerPeerId)
        rebuildMembers()
        if (p) pushMsg({ id: crypto.randomUUID(), peerId:"sys", name:"sistem",
          color:"#949ba4", text:`${p.name} ayrıldı`, ts: Date.now(), system: true })
      }
    }

    const offer = JSON.parse(sdpStr) as RTCSessionDescriptionInit
    await pc.setRemoteDescription(new RTCSessionDescription(offer))
    const answer = await pc.createAnswer()
    await pc.setLocalDescription(answer)

    await sigPost({
      room: roomRef.current,
      peerId: selfRef.current.peerId,
      type: "answer",
      sdp: JSON.stringify(pc.localDescription),
      targetId: offerPeerId,
      publicKey: selfRef.current.publicKey,
    })
  }, [handleData, pushMsg, rebuildMembers]) // eslint-disable-line react-hooks/exhaustive-deps

  // ── Signaling poller ─────────────────────────────────────────────────────

  // Hangi (peerId+type) çiftlerini işlediğimizi takip et (duplikat önleme)
  const seenSignals = useRef<Set<string>>(new Set())

  const startPolling = useCallback(() => {
    if (pollTimer.current) clearInterval(pollTimer.current)
    pollTimer.current = setInterval(async () => {
      const entries = await sigGet(roomRef.current, selfRef.current.peerId)
      for (const e of entries) {
        const key = `${e.peerId}:${e.type}:${e.targetId ?? ""}`

        if (e.type === "presence") {
          // Yeni biri geldi: ona offer gönder (henüz bağlantı yoksa)
          if (!pcs.current.has(e.peerId) && !seenSignals.current.has(key)) {
            seenSignals.current.add(key)
            await createOffer(e.peerId)
          }
        } else if (e.type === "offer") {
          // Offer: işlemedik mi?
          if (!pcs.current.has(e.peerId) && !seenSignals.current.has(key) && e.sdp) {
            seenSignals.current.add(key)
            await createAnswer(e.peerId, e.sdp, e.publicKey)
          }
        } else if (e.type === "answer") {
          // Answer: bize mi?
          if (e.targetId === selfRef.current.peerId && !seenSignals.current.has(key) && e.sdp) {
            seenSignals.current.add(key)
            const pc = pcs.current.get(e.peerId)
            if (pc && pc.signalingState === "have-local-offer") {
              try {
                await pc.setRemoteDescription(new RTCSessionDescription(JSON.parse(e.sdp)))
              } catch {}
            }
          }
        } else if (e.type === "candidate") {
          // ICE candidate: bize mi?
          const candKey = `${e.peerId}:cand:${(e.candidate ?? "").slice(0, 40)}`
          if (e.targetId === selfRef.current.peerId && !seenSignals.current.has(candKey)) {
            seenSignals.current.add(candKey)
            const pc = pcs.current.get(e.peerId)
            if (pc && pc.remoteDescription) {
              try {
                await pc.addIceCandidate(new RTCIceCandidate(JSON.parse(e.candidate!)))
              } catch {}
            }
          }
        }
      }
    }, POLL_MS)
  }, [createAnswer])

  // ── join ─────────────────────────────────────────────────────────────────

  const join = useCallback(async (profile: Profile, room: string) => {
    setStatus("connecting")
    roomRef.current = slug(room)
    seenSignals.current.clear()

    const kp = generateKeyPair()
    myKP.current = kp
    const peerId = crypto.randomUUID().replace(/-/g,"").slice(0,16)
    selfRef.current = { ...profile, peerId, ...kp }
    setMembers([{ peerId, name: profile.name + " (sen)", color: profile.color, avatar: profile.avatar }])

    // Mevcut offer'ları kontrol et
    const entries = await sigGet(roomRef.current, peerId)
    const offers = entries.filter(e => e.type === "offer")

    if (offers.length === 0) {
      // İlk kişi: presence kaydı yaz, direkt connected
      await sigPost({
        room: roomRef.current,
        peerId,
        type: "presence",
        publicKey: selfRef.current.publicKey,
      })
      setStatus("connected")
    } else {
      // Odada peer var: hepsine answer ver (onlar bize offer atıp bağlanacak)
      // Önce kendi presence'ımızı yaz ki yeni gelenler bizi de görsün
      await sigPost({
        room: roomRef.current,
        peerId,
        type: "presence",
        publicKey: selfRef.current.publicKey,
      })
      // Offer sahibi peer'lara answer gönder
      for (const e of offers) {
        if (e.peerId !== peerId && e.sdp) {
          seenSignals.current.add(`${e.peerId}:offer:`)
          await createAnswer(e.peerId, e.sdp, e.publicKey)
        }
      }
    }

    pushMsg({ id: crypto.randomUUID(), peerId:"sys", name:"sistem",
      color:"#949ba4", text:`${profile.name} kanala katıldı`, ts: Date.now(), system: true })

    startPolling()
  }, [createAnswer, createOffer, pushMsg, startPolling])

  // ── sendMessage ──────────────��───────────────────────────────────────────

  const sendMessage = useCallback((text?: string, image?: string) => {
    if (!text?.trim() && !image) return
    const self = selfRef.current
    const id = crypto.randomUUID()
    const ts = Date.now()

    dcs.current.forEach((dc, pid) => {
      if (dc.readyState !== "open") return
      const recipPub = pubKeys.current.get(pid)
      let msg: DataMsg["t"] extends "chat" ? Extract<DataMsg, {t:"chat"}> : never

      if (recipPub && text) {
        const enc = encryptMsg(text.trim(), recipPub, self.secretKey)
        msg = { t:"chat", id, peerId: self.peerId, name: self.name, color: self.color,
                avatar: self.avatar, ts, encrypted: true, nonce: enc.nonce,
                ciphertext: enc.ciphertext, image } as any
      } else {
        msg = { t:"chat", id, peerId: self.peerId, name: self.name, color: self.color,
                avatar: self.avatar, ts, text: text?.trim(), image } as any
      }
      dc.send(JSON.stringify(msg))
    })

    pushMsg({ id, peerId: self.peerId, name: self.name, color: self.color,
              avatar: self.avatar, text: text?.trim(), image, ts,
              encrypted: dcs.current.size > 0 && !!text })
  }, [pushMsg])

  // ── Ses ─────────────────────────────────────────────────────────────────

  const startVoice = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      localStream.current = stream
      setVoiceOn(true)
      pcs.current.forEach(pc => {
        stream.getTracks().forEach(t => pc.addTrack(t, stream))
      })
    } catch {}
  }, [])

  const stopVoice = useCallback(() => {
    localStream.current?.getTracks().forEach(t => t.stop())
    localStream.current = null
    audioEls.current.forEach(el => el.remove())
    audioEls.current.clear()
    setVoiceOn(false)
    setMuted(false)
  }, [])

  const toggleMute = useCallback(() => {
    const stream = localStream.current
    if (!stream) return
    const next = !muted
    stream.getAudioTracks().forEach(t => (t.enabled = !next))
    setMuted(next)
  }, [muted])

  // ── leave ────────────────────────────────────────────────────────────────

  const leave = useCallback(() => {
    if (pollTimer.current) clearInterval(pollTimer.current)
    fetch("/api/signal", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ room: roomRef.current, peerId: selfRef.current.peerId }),
    }).catch(() => {})
    pcs.current.forEach(pc => pc.close())
    pcs.current.clear()
    dcs.current.clear()
    profs.current.clear()
    pubKeys.current.clear()
    seenSignals.current.clear()
    localStream.current?.getTracks().forEach(t => t.stop())
    localStream.current = null
    audioEls.current.forEach(el => el.remove())
    audioEls.current.clear()
    setStatus("idle")
    setMembers([])
    setMessages([])
    setVoiceOn(false)
    setMuted(false)
  }, [])

  useEffect(() => {
    return () => {
      if (pollTimer.current) clearInterval(pollTimer.current)
      pcs.current.forEach(pc => pc.close())
      localStream.current?.getTracks().forEach(t => t.stop())
      audioEls.current.forEach(el => el.remove())
    }
  }, [])

  return { status, members, messages, voiceOn, muted, room: roomRef.current,
           join, leave, sendMessage, startVoice, stopVoice, toggleMute }
}
