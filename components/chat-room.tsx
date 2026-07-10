"use client"

import type React from "react"

import { useEffect, useRef, useState } from "react"
import { Hash, ImagePlus, Mic, MicOff, PhoneOff, Phone, Send, Users, Wifi } from "lucide-react"
import type { ChatMessage, Member } from "@/hooks/use-cekirdek-room"
import { fileToDataUrl } from "@/lib/img"

function Avatar({ name, color, avatar, size = 40 }: { name: string; color: string; avatar?: string; size?: number }) {
  return (
    <div
      className="flex shrink-0 items-center justify-center overflow-hidden rounded-full font-semibold text-white"
      style={{ backgroundColor: color, width: size, height: size, fontSize: size * 0.4 }}
    >
      {avatar ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={avatar || "/placeholder.svg"} alt={name} className="size-full object-cover" />
      ) : (
        (name.trim()[0] || "?").toUpperCase()
      )}
    </div>
  )
}

export function ChatRoom({
  room,
  status,
  members,
  messages,
  voiceOn,
  muted,
  onSend,
  onStartVoice,
  onStopVoice,
  onToggleMute,
}: {
  room: string
  status: "idle" | "connecting" | "connected"
  members: Member[]
  messages: ChatMessage[]
  voiceOn: boolean
  muted: boolean
  onSend: (text?: string, image?: string) => void
  onStartVoice: () => void
  onStopVoice: () => void
  onToggleMute: () => void
}) {
  const [text, setText] = useState("")
  const [pendingImage, setPendingImage] = useState<string | undefined>()
  const fileRef = useRef<HTMLInputElement>(null)
  const scrollRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" })
  }, [messages])

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

  return (
    <div className="flex h-dvh bg-dc-bg text-dc-text">
      {/* Ana sohbet */}
      <div className="flex min-w-0 flex-1 flex-col">
        {/* Header */}
        <header className="flex items-center gap-2 border-b border-dc-sidebar-dark px-4 py-3 shadow-sm">
          <Hash className="size-5 text-dc-muted" />
          <span className="font-bold">{room}</span>
          <span className="ml-2 flex items-center gap-1 text-xs text-dc-muted">
            <Wifi className={`size-3.5 ${status === "connected" ? "text-dc-green" : "text-yellow-500"}`} />
            {status === "connected" ? "P2P bağlı" : "bağlanıyor…"}
          </span>
          <div className="ml-auto flex items-center gap-2">
            {!voiceOn ? (
              <button
                onClick={onStartVoice}
                className="flex items-center gap-1.5 rounded bg-dc-green-btn px-3 py-1.5 text-sm font-medium text-white transition hover:bg-dc-green"
              >
                <Phone className="size-4" /> Sese katıl
              </button>
            ) : (
              <>
                <button
                  onClick={onToggleMute}
                  className={`flex items-center gap-1.5 rounded px-3 py-1.5 text-sm font-medium transition ${
                    muted ? "bg-red-500/20 text-red-400" : "bg-dc-hover text-dc-text hover:bg-dc-input"
                  }`}
                >
                  {muted ? <MicOff className="size-4" /> : <Mic className="size-4" />}
                  {muted ? "Sessiz" : "Açık"}
                </button>
                <button
                  onClick={onStopVoice}
                  className="flex items-center gap-1.5 rounded bg-red-500/90 px-3 py-1.5 text-sm font-medium text-white transition hover:bg-red-500"
                >
                  <PhoneOff className="size-4" /> Ayrıl
                </button>
              </>
            )}
          </div>
        </header>

        {/* Mesajlar */}
        <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-4">
          {messages.length === 0 && (
            <div className="mt-10 text-center text-dc-muted">
              <Hash className="mx-auto size-12 opacity-30" />
              <p className="mt-2 font-semibold text-dc-text">#{room} kanalına hoş geldin!</p>
              <p className="text-sm">Bu kanalın başlangıcı. İlk mesajı sen gönder.</p>
            </div>
          )}
          <div className="flex flex-col gap-4">
            {messages.map((m) =>
              m.system ? (
                <div key={m.id} className="text-center text-xs text-dc-muted">
                  {m.text}
                </div>
              ) : (
                <div key={m.id} className="flex gap-3">
                  <Avatar name={m.name} color={m.color} avatar={m.avatar} />
                  <div className="min-w-0">
                    <div className="flex items-baseline gap-2">
                      <span className="font-semibold" style={{ color: m.color }}>
                        {m.name}
                      </span>
                      <span className="text-xs text-dc-muted">
                        {new Date(m.ts).toLocaleTimeString("tr-TR", { hour: "2-digit", minute: "2-digit" })}
                      </span>
                    </div>
                    {m.text && <p className="whitespace-pre-wrap break-words text-dc-text">{m.text}</p>}
                    {m.image && (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={m.image || "/placeholder.svg"}
                        alt="Paylaşılan görsel"
                        className="mt-1 max-h-80 rounded-lg border border-dc-sidebar-dark"
                      />
                    )}
                  </div>
                </div>
              ),
            )}
          </div>
        </div>

        {/* Girdi */}
        <div className="px-4 pb-4">
          {pendingImage && (
            <div className="mb-2 inline-flex items-center gap-2 rounded bg-dc-sidebar-dark p-2">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={pendingImage || "/placeholder.svg"} alt="Önizleme" className="h-16 rounded" />
              <button onClick={() => setPendingImage(undefined)} className="text-xs text-dc-muted hover:text-dc-text">
                kaldır
              </button>
            </div>
          )}
          <div className="flex items-center gap-2 rounded-lg bg-dc-input px-3 py-2.5">
            <button onClick={() => fileRef.current?.click()} aria-label="Görsel ekle" className="text-dc-muted hover:text-dc-text">
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
            <button onClick={submit} aria-label="Gönder" className="text-dc-muted hover:text-dc-text">
              <Send className="size-5" />
            </button>
          </div>
        </div>
      </div>

      {/* Üye listesi */}
      <aside className="hidden w-60 flex-col border-l border-dc-sidebar-dark bg-dc-sidebar md:flex">
        <div className="flex items-center gap-2 px-4 py-3 text-xs font-bold uppercase tracking-wide text-dc-muted">
          <Users className="size-4" /> Üyeler — {members.length}
        </div>
        <div className="flex flex-col gap-1 overflow-y-auto px-2">
          {members.map((m) => (
            <div key={m.peerId} className="flex items-center gap-2 rounded px-2 py-1.5 hover:bg-dc-hover">
              <Avatar name={m.name} color={m.color} avatar={m.avatar} size={32} />
              <span className="truncate text-sm text-dc-text">{m.name}</span>
            </div>
          ))}
        </div>
      </aside>
    </div>
  )
}
