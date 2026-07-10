"use client"

import type React from "react"
import { useEffect, useRef, useState } from "react"
import {
  Hash,
  ImagePlus,
  Lock,
  Mic,
  MicOff,
  PhoneOff,
  Phone,
  Send,
  Shield,
  Users,
  Wifi,
  WifiOff,
  Plus,
  X,
  LogOut,
} from "lucide-react"
import type { ChatMessage, Member } from "@/hooks/use-cekirdek-room"
import { fileToDataUrl } from "@/lib/img"

const PRESET_CHANNELS = ["genel", "oyun", "müzik", "yazılım", "sohbet"]

function Avatar({
  name,
  color,
  avatar,
  size = 40,
  online = true,
}: {
  name: string
  color: string
  avatar?: string
  size?: number
  online?: boolean
}) {
  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      <div
        className="flex size-full items-center justify-center overflow-hidden rounded-full font-semibold text-white"
        style={{ backgroundColor: color, fontSize: size * 0.4 }}
      >
        {avatar ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={avatar} alt={name} className="size-full object-cover" />
        ) : (
          (name.trim()[0] || "?").toUpperCase()
        )}
      </div>
      {size >= 32 && (
        <span
          className={`absolute bottom-0 right-0 size-3 rounded-full ring-2 ring-dc-bg ${online ? "bg-dc-green" : "bg-dc-muted"}`}
        />
      )}
    </div>
  )
}

export function ChatRoom({
  room,
  allChannels,
  status,
  members,
  messages,
  voiceOn,
  muted,
  selfProfile,
  onSend,
  onStartVoice,
  onStopVoice,
  onToggleMute,
  onSwitchChannel,
  onLeave,
}: {
  room: string
  allChannels: string[]
  status: "idle" | "connecting" | "connected"
  members: Member[]
  messages: ChatMessage[]
  voiceOn: boolean
  muted: boolean
  selfProfile: { name: string; color: string; avatar?: string }
  onSend: (text?: string, image?: string) => void
  onStartVoice: () => void
  onStopVoice: () => void
  onToggleMute: () => void
  onSwitchChannel: (channel: string) => void
  onLeave: () => void
}) {
  const [text, setText] = useState("")
  const [pendingImage, setPendingImage] = useState<string | undefined>()
  const [newChannel, setNewChannel] = useState("")
  const [showAddChannel, setShowAddChannel] = useState(false)
  const [extraChannels, setExtraChannels] = useState<string[]>([])
  const fileRef = useRef<HTMLInputElement>(null)
  const scrollRef = useRef<HTMLDivElement>(null)
  const addInputRef = useRef<HTMLInputElement>(null)

  const channels = [...allChannels, ...extraChannels.filter((c) => !allChannels.includes(c))]

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" })
  }, [messages])

  useEffect(() => {
    if (showAddChannel) addInputRef.current?.focus()
  }, [showAddChannel])

  function submit() {
    if (!text.trim() && !pendingImage) return
    onSend(text, pendingImage)
    setText("")
    setPendingImage(undefined)
  }

  async function handleImage(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setPendingImage(await fileToDataUrl(file, 800))
    e.target.value = ""
  }

  function addChannel() {
    const c = newChannel.trim().toLowerCase().replace(/\s+/g, "-")
    if (!c) return
    setExtraChannels((p) => (p.includes(c) ? p : [...p, c]))
    setNewChannel("")
    setShowAddChannel(false)
    onSwitchChannel(c)
  }

  return (
    <div className="flex h-dvh bg-dc-bg text-dc-text">
      {/* ── Sol sidebar ── */}
      <aside className="flex w-60 shrink-0 flex-col bg-dc-sidebar">
        {/* Sunucu başlığı */}
        <div className="flex h-12 items-center border-b border-dc-sidebar-dark px-4 font-bold shadow-sm">
          Çekirdek Chat
        </div>

        {/* Kanal listesi */}
        <nav className="flex-1 overflow-y-auto py-3">
          <div className="mb-1 flex items-center justify-between px-4 text-xs font-bold uppercase tracking-wide text-dc-muted">
            <span>Kanallar</span>
            <button
              onClick={() => setShowAddChannel((v) => !v)}
              aria-label="Kanal oluştur"
              className="rounded p-0.5 hover:bg-dc-hover hover:text-dc-text"
            >
              <Plus className="size-3.5" />
            </button>
          </div>

          {showAddChannel && (
            <div className="mx-2 mb-2 flex gap-1">
              <input
                ref={addInputRef}
                value={newChannel}
                onChange={(e) => setNewChannel(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.nativeEvent.isComposing) addChannel()
                  if (e.key === "Escape") setShowAddChannel(false)
                }}
                placeholder="kanal-adı"
                maxLength={20}
                className="flex-1 rounded bg-dc-sidebar-dark px-2 py-1 text-sm text-dc-text outline-none ring-dc-brand focus:ring-1"
              />
              <button
                onClick={addChannel}
                className="rounded bg-dc-brand px-2 py-1 text-xs text-white hover:opacity-90"
              >
                Ekle
              </button>
              <button
                onClick={() => setShowAddChannel(false)}
                className="rounded p-1 text-dc-muted hover:text-dc-text"
              >
                <X className="size-3.5" />
              </button>
            </div>
          )}

          {channels.map((c) => (
            <button
              key={c}
              onClick={() => onSwitchChannel(c)}
              className={`flex w-full items-center gap-1.5 rounded px-2 py-1.5 mx-2 text-sm transition ${
                room === c
                  ? "bg-dc-hover font-medium text-dc-text"
                  : "text-dc-muted hover:bg-dc-hover/60 hover:text-dc-text/80"
              }`}
              style={{ width: "calc(100% - 1rem)" }}
            >
              <Hash className="size-3.5 shrink-0" />
              <span className="truncate">{c}</span>
            </button>
          ))}
        </nav>

        {/* Kendi profil alanı */}
        <div className="flex items-center gap-2 border-t border-dc-sidebar-dark bg-dc-sidebar-dark px-2 py-2">
          <Avatar name={selfProfile.name} color={selfProfile.color} avatar={selfProfile.avatar} size={32} />
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold text-dc-text">{selfProfile.name}</p>
            <p className="text-xs text-dc-muted">{voiceOn ? (muted ? "sessiz" : "seste") : "çevrimiçi"}</p>
          </div>
          <button
            onClick={onLeave}
            aria-label="Ayrıl"
            className="rounded p-1 text-dc-muted transition hover:bg-dc-hover hover:text-red-400"
          >
            <LogOut className="size-4" />
          </button>
        </div>
      </aside>

      {/* ── Ana sohbet alanı ── */}
      <div className="flex min-w-0 flex-1 flex-col">
        {/* Header */}
        <header className="flex h-12 items-center gap-2 border-b border-dc-sidebar-dark px-4 shadow-sm">
          <Hash className="size-4 text-dc-muted" />
          <span className="font-bold">{room}</span>
          <span className="ml-2 flex items-center gap-1 text-xs text-dc-muted">
            {status === "connected" ? (
              <Wifi className="size-3.5 text-dc-green" />
            ) : (
              <WifiOff className="size-3.5 text-yellow-500 animate-pulse" />
            )}
            {status === "connected" ? "P2P bağlı" : "bağlanıyor…"}
          </span>
          {/* E2EE badge */}
          {status === "connected" && members.length > 1 && (
            <span className="ml-1 flex items-center gap-1 rounded-full bg-dc-green/10 px-2 py-0.5 text-xs font-medium text-dc-green border border-dc-green/20">
              <Shield className="size-3" />
              E2EE
            </span>
          )}

          <div className="ml-auto flex items-center gap-2">
            {!voiceOn ? (
              <button
                onClick={onStartVoice}
                className="flex items-center gap-1.5 rounded bg-dc-green-btn px-3 py-1.5 text-sm font-medium text-white transition hover:bg-dc-green"
              >
                <Phone className="size-4" />
                <span className="hidden sm:inline">Sese katıl</span>
              </button>
            ) : (
              <>
                <button
                  onClick={onToggleMute}
                  className={`flex items-center gap-1.5 rounded px-3 py-1.5 text-sm font-medium transition ${
                    muted
                      ? "bg-red-500/20 text-red-400 hover:bg-red-500/30"
                      : "bg-dc-hover text-dc-text hover:bg-dc-input"
                  }`}
                >
                  {muted ? <MicOff className="size-4" /> : <Mic className="size-4" />}
                  <span className="hidden sm:inline">{muted ? "Sessiz" : "Açık"}</span>
                </button>
                <button
                  onClick={onStopVoice}
                  className="flex items-center gap-1.5 rounded bg-red-500/90 px-3 py-1.5 text-sm font-medium text-white transition hover:bg-red-600"
                >
                  <PhoneOff className="size-4" />
                  <span className="hidden sm:inline">Ayrıl</span>
                </button>
              </>
            )}
          </div>
        </header>

        {/* Mesajlar */}
        <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-4">
          {messages.length === 0 ? (
            <div className="mt-16 text-center text-dc-muted">
              <Hash className="mx-auto size-16 opacity-20" />
              <p className="mt-3 text-xl font-bold text-dc-text">#{room} kanalına hoş geldin!</p>
              <p className="mt-1 text-sm">Bu kanalın başlangıcı. İlk mesajı sen gönder.</p>
            </div>
          ) : (
            <div className="flex flex-col gap-4">
              {messages.map((m) =>
                m.system ? (
                  <div key={m.id} className="text-center text-xs text-dc-muted">
                    <span className="rounded-full bg-dc-sidebar-dark px-3 py-1">{m.text}</span>
                  </div>
                ) : (
                  <div key={m.id} className="group flex gap-3 rounded px-2 py-1 hover:bg-dc-hover/30">
                    <Avatar name={m.name} color={m.color} avatar={m.avatar} online />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-baseline gap-2">
                        <span className="font-semibold" style={{ color: m.color }}>
                          {m.name}
                        </span>
                        <span className="text-xs text-dc-muted">
                          {new Date(m.ts).toLocaleTimeString("tr-TR", { hour: "2-digit", minute: "2-digit" })}
                        </span>
                        {m.encrypted && (
                          <span title="Uçtan uca şifreli">
                            <Lock className="size-3 text-dc-green opacity-70" />
                          </span>
                        )}
                      </div>
                      {m.text && <p className="whitespace-pre-wrap break-words text-dc-text">{m.text}</p>}
                      {m.image && (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={m.image}
                          alt="Paylaşılan görsel"
                          className="mt-1 max-h-80 rounded-lg border border-dc-sidebar-dark"
                        />
                      )}
                    </div>
                  </div>
                ),
              )}
            </div>
          )}
        </div>

        {/* Mesaj girdi alanı */}
        <div className="px-4 pb-4">
          {pendingImage && (
            <div className="mb-2 inline-flex items-center gap-2 rounded-lg bg-dc-sidebar-dark p-2">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={pendingImage} alt="Önizleme" className="h-16 rounded" />
              <button
                onClick={() => setPendingImage(undefined)}
                className="text-xs text-dc-muted hover:text-dc-text"
              >
                <X className="size-4" />
              </button>
            </div>
          )}
          <div className="flex items-center gap-2 rounded-lg bg-dc-input px-3 py-2.5">
            <button
              onClick={() => fileRef.current?.click()}
              aria-label="Görsel ekle"
              className="text-dc-muted transition hover:text-dc-text"
            >
              <ImagePlus className="size-5" />
            </button>
            <input ref={fileRef} type="file" accept="image/*" onChange={handleImage} className="hidden" />
            <input
              value={text}
              onChange={(e) => setText(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing && e.keyCode !== 229) {
                  e.preventDefault()
                  submit()
                }
              }}
              placeholder={`#${room} kanalına mesaj gönder`}
              className="flex-1 bg-transparent text-dc-text placeholder:text-dc-muted outline-none"
            />
            <button
              onClick={submit}
              aria-label="Gönder"
              className="text-dc-muted transition hover:text-dc-text disabled:opacity-40"
              disabled={!text.trim() && !pendingImage}
            >
              <Send className="size-5" />
            </button>
          </div>
        </div>
      </div>

      {/* ── Sağ üye listesi ── */}
      <aside className="hidden w-60 shrink-0 flex-col border-l border-dc-sidebar-dark bg-dc-sidebar lg:flex">
        <div className="flex items-center gap-2 px-4 py-3 text-xs font-bold uppercase tracking-wide text-dc-muted">
          <Users className="size-4" />
          Üyeler — {members.length}
        </div>
        <div className="flex flex-col gap-0.5 overflow-y-auto px-2 pb-4">
          {members.map((m) => (
            <div
              key={m.peerId}
              className="flex items-center gap-2 rounded px-2 py-1.5 hover:bg-dc-hover"
            >
              <Avatar name={m.name} color={m.color} avatar={m.avatar} size={32} />
              <span className="truncate text-sm text-dc-text">{m.name}</span>
            </div>
          ))}
        </div>
      </aside>
    </div>
  )
}
