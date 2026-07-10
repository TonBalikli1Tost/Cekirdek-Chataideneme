"use client"

import type React from "react"
import { useState } from "react"
import { CekirdekChat } from "@/components/cekirdek-chat"

export default function Page() {
  const [nickname, setNickname] = useState("")
  const [joined, setJoined] = useState(false)
  const [draft, setDraft] = useState("")

  const join = () => {
    const name = draft.trim()
    if (!name) return
    setNickname(name)
    setJoined(true)
  }

  if (joined) {
    return <CekirdekChat nickname={nickname} />
  }

  return (
    <main className="flex h-dvh w-full items-center justify-center bg-dc-sidebar-dark px-4 font-sans">
      <div className="w-full max-w-sm rounded-lg bg-dc-bg p-8 shadow-xl">
        <div className="mb-6 flex flex-col items-center text-center">
          <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-dc-brand text-2xl font-bold text-white">
            Ç
          </div>
          <h1 className="text-xl font-bold text-white">Çekirdek</h1>
          <p className="mt-1 text-pretty text-sm text-dc-muted">
            Herkesin sorunsuz katılabildiği P2P sohbet kanalı
          </p>
        </div>

        <label className="mb-2 block text-xs font-bold uppercase tracking-wide text-dc-muted">
          Takma adın
        </label>
        <input
          type="text"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e: React.KeyboardEvent<HTMLInputElement>) => {
            if (
              e.key === "Enter" &&
              !e.nativeEvent.isComposing &&
              e.keyCode !== 229
            ) {
              join()
            }
          }}
          placeholder="örn. Kaptan_Cekirdek"
          className="mb-4 w-full rounded-md bg-dc-input px-3 py-2.5 text-sm text-dc-text placeholder-dc-muted focus:outline-none focus:ring-2 focus:ring-dc-brand"
          autoFocus
        />

        <button
          onClick={join}
          disabled={!draft.trim()}
          className="w-full rounded-md bg-dc-brand py-2.5 text-sm font-semibold text-white transition-colors hover:bg-dc-brand/85 disabled:cursor-not-allowed disabled:opacity-50"
        >
          Kanala Katıl
        </button>
      </div>
    </main>
  )
}
