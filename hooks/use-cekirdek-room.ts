"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import type Peer from "peerjs"
import type { DataConnection, MediaConnection } from "peerjs"

// Sabit host kimliği: aynı oda adına giren herkes ilk olarak buraya bağlanır.
// Broker olarak PeerJS'in ücretsiz bulut sunucusu kullanılır (kendi sunucumuz yok).
const HOST_PREFIX = "cekirdek-v0-room-"

function slug(room: string) {
  return room
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
}

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
}

export type Member = {
  peerId: string
  name: string
  color: string
  avatar?: string
  speaking?: boolean
}

export type Profile = {
  name: string
  color: string
  avatar?: string
}

type Wire =
  | { t: "hello"; profile: Profile }
  | { t: "roster"; peers: string[] }
  | { t: "chat"; msg: ChatMessage }

const MAX_MESSAGES = 100

export function useCekirdekRoom() {
  const [status, setStatus] = useState<"idle" | "connecting" | "connected">("idle")
  const [members, setMembers] = useState<Member[]>([])
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [voiceOn, setVoiceOn] = useState(false)
  const [muted, setMuted] = useState(false)

  const peerRef = useRef<Peer | null>(null)
  const selfRef = useRef<Profile & { peerId: string }>({ name: "", color: "", peerId: "" })
  const dataConns = useRef<Map<string, DataConnection>>(new Map())
  const mediaConns = useRef<Map<string, MediaConnection>>(new Map())
  const profiles = useRef<Map<string, Profile>>(new Map())
  const localStream = useRef<MediaStream | null>(null)
  const audioEls = useRef<Map<string, HTMLAudioElement>>(new Map())
  const roomRef = useRef("")

  const rebuildMembers = useCallback(() => {
    const list: Member[] = []
    const self = selfRef.current
    list.push({ peerId: self.peerId, name: self.name + " (sen)", color: self.color, avatar: self.avatar })
    profiles.current.forEach((p, id) => {
      if (id === self.peerId) return
      list.push({ peerId: id, name: p.name, color: p.color, avatar: p.avatar })
    })
    setMembers(list)
  }, [])

  const pushMessage = useCallback((msg: ChatMessage) => {
    setMessages((prev) => [...prev, msg].slice(-MAX_MESSAGES))
  }, [])

  const broadcast = useCallback((data: Wire) => {
    dataConns.current.forEach((c) => {
      if (c.open) c.send(data)
    })
  }, [])

  // Bir data bağlantısını dinle/kur
  const wireData = useCallback(
    (conn: DataConnection) => {
      conn.on("open", () => {
        dataConns.current.set(conn.peer, conn)
        conn.send({ t: "hello", profile: selfRef.current } satisfies Wire)
      })
      conn.on("data", (raw) => {
        const data = raw as Wire
        if (data.t === "hello") {
          profiles.current.set(conn.peer, data.profile)
          rebuildMembers()
        } else if (data.t === "roster") {
          // host'tan gelen üye listesi: herkese doğrudan bağlan (mesh)
          data.peers.forEach((pid) => connectToPeer(pid))
        } else if (data.t === "chat") {
          pushMessage(data.msg)
        }
      })
      conn.on("close", () => {
        dataConns.current.delete(conn.peer)
        const p = profiles.current.get(conn.peer)
        profiles.current.delete(conn.peer)
        rebuildMembers()
        if (p) {
          pushMessage({
            id: crypto.randomUUID(),
            peerId: "sys",
            name: "sistem",
            color: "#949ba4",
            text: `${p.name} ayrıldı`,
            ts: Date.now(),
            system: true,
          })
        }
      })
      conn.on("error", () => {})
    },
    [pushMessage, rebuildMembers],
  )

  const connectToPeer = useCallback(
    (pid: string) => {
      const peer = peerRef.current
      if (!peer || pid === selfRef.current.peerId) return
      if (dataConns.current.has(pid)) return
      const conn = peer.connect(pid, { reliable: true })
      wireData(conn)
      // Ses açıksa yeni eşi ara
      if (localStream.current && !mediaConns.current.has(pid)) {
        const call = peer.call(pid, localStream.current)
        setupCall(pid, call)
      }
    },
    [wireData],
  )

  const setupCall = useCallback((pid: string, call: MediaConnection) => {
    mediaConns.current.set(pid, call)
    call.on("stream", (remote) => {
      let el = audioEls.current.get(pid)
      if (!el) {
        el = document.createElement("audio")
        el.autoplay = true
        audioEls.current.set(pid, el)
      }
      el.srcObject = remote
      el.play().catch(() => {})
    })
    call.on("close", () => {
      audioEls.current.get(pid)?.remove()
      audioEls.current.delete(pid)
      mediaConns.current.delete(pid)
    })
    call.on("error", () => {})
  }, [])

  const join = useCallback(
    async (profile: Profile, room: string) => {
      setStatus("connecting")
      roomRef.current = slug(room) || "genel"
      const { default: PeerCtor } = await import("peerjs")
      const hostId = HOST_PREFIX + roomRef.current

      const startAsMember = () => {
        const peer = new PeerCtor()
        peerRef.current = peer
        peer.on("open", (id) => {
          selfRef.current = { ...profile, peerId: id }
          setStatus("connected")
          rebuildMembers()
          // host'a bağlan
          const conn = peer.connect(hostId, { reliable: true })
          wireData(conn)
        })
        peer.on("connection", (c) => wireData(c))
        peer.on("call", (call) => {
          if (localStream.current) call.answer(localStream.current)
          else call.answer()
          setupCall(call.peer, call)
        })
      }

      // Önce host olmayı dene
      const host = new PeerCtor(hostId)
      peerRef.current = host
      let becameHost = false
      host.on("open", (id) => {
        becameHost = true
        selfRef.current = { ...profile, peerId: id }
        setStatus("connected")
        rebuildMembers()
        host.on("connection", (conn) => {
          wireData(conn)
          // yeni üyeye mevcut roster'ı gönder ki herkese bağlansın
          conn.on("open", () => {
            const peers = [selfRef.current.peerId, ...Array.from(dataConns.current.keys())].filter(
              (p) => p !== conn.peer,
            )
            conn.send({ t: "roster", peers } satisfies Wire)
          })
        })
        host.on("call", (call) => {
          if (localStream.current) call.answer(localStream.current)
          else call.answer()
          setupCall(call.peer, call)
        })
      })
      host.on("error", (err) => {
        // Kimlik dolu => host var, üye olarak katıl
        if (!becameHost && (err.type === "unavailable-id" || String(err).includes("unavailable"))) {
          try {
            host.destroy()
          } catch {}
          startAsMember()
        }
      })
    },
    [rebuildMembers, setupCall, wireData],
  )

  const sendMessage = useCallback(
    (text?: string, image?: string) => {
      if (!text?.trim() && !image) return
      const self = selfRef.current
      const msg: ChatMessage = {
        id: crypto.randomUUID(),
        peerId: self.peerId,
        name: self.name,
        color: self.color,
        avatar: self.avatar,
        text: text?.trim() || undefined,
        image,
        ts: Date.now(),
      }
      pushMessage(msg)
      broadcast({ t: "chat", msg })
    },
    [broadcast, pushMessage],
  )

  const startVoice = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      localStream.current = stream
      setVoiceOn(true)
      const peer = peerRef.current
      if (!peer) return
      // Tüm bilinen eşleri ara
      profiles.current.forEach((_p, pid) => {
        if (pid === selfRef.current.peerId || mediaConns.current.has(pid)) return
        const call = peer.call(pid, stream)
        setupCall(pid, call)
      })
    } catch {
      // mikrofon reddedildi
    }
  }, [setupCall])

  const stopVoice = useCallback(() => {
    localStream.current?.getTracks().forEach((t) => t.stop())
    localStream.current = null
    mediaConns.current.forEach((c) => c.close())
    mediaConns.current.clear()
    audioEls.current.forEach((el) => el.remove())
    audioEls.current.clear()
    setVoiceOn(false)
    setMuted(false)
  }, [])

  const toggleMute = useCallback(() => {
    const stream = localStream.current
    if (!stream) return
    const next = !muted
    stream.getAudioTracks().forEach((t) => (t.enabled = !next))
    setMuted(next)
  }, [muted])

  useEffect(() => {
    return () => {
      try {
        peerRef.current?.destroy()
      } catch {}
      localStream.current?.getTracks().forEach((t) => t.stop())
      audioEls.current.forEach((el) => el.remove())
    }
  }, [])

  return {
    status,
    members,
    messages,
    voiceOn,
    muted,
    room: roomRef.current,
    join,
    sendMessage,
    startVoice,
    stopVoice,
    toggleMute,
  }
}
