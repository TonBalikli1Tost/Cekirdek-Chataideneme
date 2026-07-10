"use client"

import type React from "react"

import { useRef, useState } from "react"
import { Hash, ImagePlus, Plus, X } from "lucide-react"
import { colorFromName, fileToDataUrl } from "@/lib/img"

const PRESET_CHANNELS = ["genel", "oyun", "müzik", "yazılım", "sohbet"]

export function JoinScreen({
  onJoin,
}: {
  onJoin: (profile: { name: string; color: string; avatar?: string }, room: string) => void
}) {
  const [name, setName] = useState("")
  const [avatar, setAvatar] = useState<string | undefined>()
  const [room, setRoom] = useState("genel")
  const [customChannels, setCustomChannels] = useState<string[]>([])
  const [newChannel, setNewChannel] = useState("")
  const fileRef = useRef<HTMLInputElement>(null)

  const channels = [...PRESET_CHANNELS, ...customChannels]

  async function handleAvatar(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setAvatar(await fileToDataUrl(file, 96))
  }

  function addChannel() {
    const c = newChannel.trim().toLowerCase()
    if (!c || channels.includes(c)) {
      setNewChannel("")
      return
    }
    setCustomChannels((p) => [...p, c])
    setRoom(c)
    setNewChannel("")
  }

  const canJoin = name.trim().length > 0
  const color = colorFromName(name || "?")

  return (
    <div className="flex min-h-dvh items-center justify-center bg-dc-bg-dark p-4">
      <div className="w-full max-w-md rounded-lg bg-dc-bg p-6 shadow-2xl">
        <h1 className="text-center text-2xl font-bold text-dc-text text-balance">Çekirdek&apos;e Katıl</h1>
        <p className="mt-1 text-center text-sm text-dc-muted text-pretty">
          Takma adını gir, bir kanal seç ve gerçek P2P sohbete başla.
        </p>

        {/* Avatar */}
        <div className="mt-6 flex flex-col items-center gap-2">
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            className="relative flex size-20 items-center justify-center overflow-hidden rounded-full text-2xl font-semibold text-white transition hover:opacity-90"
            style={{ backgroundColor: color }}
            aria-label="Profil fotoğrafı yükle"
          >
            {avatar ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={avatar || "/placeholder.svg"} alt="Profil" className="size-full object-cover" />
            ) : (
              (name.trim()[0] || "?").toUpperCase()
            )}
            <span className="absolute bottom-0 flex w-full items-center justify-center bg-black/50 py-0.5">
              <ImagePlus className="size-3.5 text-white" />
            </span>
          </button>
          {avatar && (
            <button
              type="button"
              onClick={() => setAvatar(undefined)}
              className="flex items-center gap-1 text-xs text-dc-muted hover:text-dc-text"
            >
              <X className="size-3" /> Fotoğrafı kaldır
            </button>
          )}
          <input ref={fileRef} type="file" accept="image/*" onChange={handleAvatar} className="hidden" />
        </div>

        {/* İsim */}
        <label className="mt-6 block text-xs font-bold uppercase tracking-wide text-dc-muted">Takma ad</label>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="ör. çekirdekçi_42"
          maxLength={24}
          className="mt-1 w-full rounded bg-dc-sidebar-dark px-3 py-2.5 text-dc-text outline-none ring-dc-brand focus:ring-2"
        />

        {/* Kanallar */}
        <label className="mt-5 block text-xs font-bold uppercase tracking-wide text-dc-muted">Kanal seç</label>
        <div className="mt-2 flex flex-wrap gap-2">
          {channels.map((c) => (
            <button
              key={c}
              type="button"
              onClick={() => setRoom(c)}
              className={`flex items-center gap-1 rounded-full px-3 py-1.5 text-sm transition ${
                room === c
                  ? "bg-dc-brand text-white"
                  : "bg-dc-sidebar-dark text-dc-muted hover:bg-dc-hover hover:text-dc-text"
              }`}
            >
              <Hash className="size-3.5" />
              {c}
            </button>
          ))}
        </div>

        {/* Yeni kanal oluştur */}
        <div className="mt-3 flex gap-2">
          <input
            value={newChannel}
            onChange={(e) => setNewChannel(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.nativeEvent.isComposing) {
                e.preventDefault()
                addChannel()
              }
            }}
            placeholder="Yeni kanal oluştur"
            maxLength={20}
            className="flex-1 rounded bg-dc-sidebar-dark px-3 py-2 text-sm text-dc-text outline-none ring-dc-brand focus:ring-2"
          />
          <button
            type="button"
            onClick={addChannel}
            className="flex items-center gap-1 rounded bg-dc-hover px-3 py-2 text-sm text-dc-text transition hover:bg-dc-input"
          >
            <Plus className="size-4" /> Ekle
          </button>
        </div>

        <button
          type="button"
          disabled={!canJoin}
          onClick={() => onJoin({ name: name.trim(), color, avatar }, room)}
          className="mt-6 w-full rounded bg-dc-green-btn py-3 font-semibold text-white transition hover:bg-dc-green disabled:cursor-not-allowed disabled:opacity-50"
        >
          #{room} kanalına katıl
        </button>
      </div>
    </div>
  )
}
