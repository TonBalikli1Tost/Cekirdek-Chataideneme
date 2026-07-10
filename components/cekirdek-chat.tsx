"use client"

import type React from "react"
import { useState, useRef, useEffect } from "react"
import {
  Phone,
  PhoneOff,
  ImageIcon,
  Send,
  Mic,
  MicOff,
  Hash,
  Users,
} from "lucide-react"

interface Message {
  id: number
  content: string
  sender: string
  timestamp: string
}

const AVATAR_COLORS = [
  "#5865f2",
  "#23a55a",
  "#eb459e",
  "#f0b232",
  "#ed4245",
  "#3ba55c",
]

function colorFor(name: string) {
  let sum = 0
  for (let i = 0; i < name.length; i++) sum += name.charCodeAt(i)
  return AVATAR_COLORS[sum % AVATAR_COLORS.length]
}

export function CekirdekChat({ nickname }: { nickname: string }) {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: 1,
      content: "Çekirdek P2P hibrit ağ mimarisine hoş geldiniz!",
      sender: "Kaptan_Cekirdek",
      timestamp: "23:40",
    },
    {
      id: 2,
      content: "Herkes bu kanaldan sorunsuz katılabilir, hoş geldin!",
      sender: "Yazilimci_Dost",
      timestamp: "23:42",
    },
  ])
  const [inputText, setInputText] = useState("")
  const [isMuted, setIsMuted] = useState(false)
  const [connectionStatus, setConnectionStatus] = useState<
    "Boşta" | "Eş Aranıyor..." | "Bağlandı"
  >("Boşta")

  const scrollRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight })
  }, [messages])

  const handleNewMessage = (content: string, sender: string) => {
    const msg: Message = {
      id: Date.now(),
      content,
      sender,
      timestamp: new Date().toLocaleTimeString([], {
        hour: "2-digit",
        minute: "2-digit",
      }),
    }
    // 50 mesaj sınırı: aşınca son 10'u taze tut
    setMessages((prev) => {
      const updated = [...prev, msg]
      return updated.length > 50 ? updated.slice(-10) : updated
    })
  }

  const toggleP2PCall = () => {
    if (connectionStatus === "Boşta") {
      setConnectionStatus("Eş Aranıyor...")
      setTimeout(() => setConnectionStatus("Bağlandı"), 2000)
    } else {
      setConnectionStatus("Boşta")
    }
  }

  const handleSend = () => {
    if (!inputText.trim()) return
    handleNewMessage(inputText, nickname)
    setInputText("")
  }

  return (
    <div className="flex h-dvh w-full flex-col overflow-hidden bg-dc-bg font-sans text-dc-text select-none">
      {/* HEADER */}
      <header className="flex h-12 shrink-0 items-center justify-between border-b border-dc-bg-dark bg-dc-bg px-4 shadow-sm">
        <div className="flex items-center gap-2">
          <Hash size={22} className="text-dc-muted" />
          <span className="text-base font-bold text-white">cekirdek-ekibi</span>
          <span
            className={`ml-3 rounded-full px-2 py-0.5 text-xs font-semibold transition-all ${
              connectionStatus === "Bağlandı"
                ? "bg-dc-green-btn/20 text-dc-green"
                : connectionStatus === "Eş Aranıyor..."
                  ? "animate-pulse bg-yellow-500/20 text-yellow-500"
                  : "bg-dc-sidebar text-dc-text"
            }`}
          >
            {connectionStatus}
          </span>
        </div>

        <div className="flex items-center gap-2">
          <span className="mr-1 hidden items-center gap-1 text-xs text-dc-muted sm:flex">
            <Users size={16} /> {nickname}
          </span>
          <button
            onClick={() => setIsMuted(!isMuted)}
            className={`rounded p-2 transition-colors hover:bg-dc-hover ${
              isMuted ? "text-red-500" : "text-dc-text"
            }`}
            title="Mikrofonu Sustur"
          >
            {isMuted ? <MicOff size={20} /> : <Mic size={20} />}
          </button>
          <button
            onClick={toggleP2PCall}
            className={`rounded p-2 transition-colors ${
              connectionStatus === "Bağlandı"
                ? "bg-red-500/20 text-red-500 hover:bg-red-500/30"
                : "bg-dc-green-btn text-white hover:bg-dc-green-btn/80"
            }`}
            title="P2P Sesli Sohbet"
          >
            {connectionStatus === "Bağlandı" ? (
              <PhoneOff size={20} />
            ) : (
              <Phone size={20} />
            )}
          </button>
        </div>
      </header>

      {/* MESSAGES */}
      <div
        ref={scrollRef}
        className="flex-1 space-y-4 overflow-y-auto bg-dc-bg px-4 py-4"
      >
        {messages.map((msg) => (
          <div
            key={msg.id}
            className="group -mx-4 flex gap-3 rounded px-4 py-1 transition-colors hover:bg-dc-hover/50"
          >
            <div
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-sm font-bold text-white"
              style={{ backgroundColor: colorFor(msg.sender) }}
            >
              {msg.sender[0].toUpperCase()}
            </div>
            <div className="flex min-w-0 flex-col">
              <div className="flex items-baseline gap-2">
                <span className="cursor-pointer text-sm font-semibold text-white hover:underline">
                  {msg.sender}
                </span>
                <span className="text-[10px] font-medium text-dc-muted">
                  {msg.timestamp}
                </span>
              </div>
              <p className="mt-0.5 break-words text-sm text-dc-text">
                {msg.content}
              </p>
            </div>
          </div>
        ))}
      </div>

      {/* INPUT */}
      <div className="shrink-0 bg-dc-bg p-4 pt-0">
        <div className="flex items-center rounded-lg bg-dc-input px-3 py-2.5 shadow-inner">
          <button
            className="mr-3 text-dc-text transition-colors hover:text-white"
            title="Dosya/Resim Ekle"
          >
            <ImageIcon size={22} />
          </button>
          <input
            type="text"
            placeholder="Mesaj gönder #cekirdek"
            className="flex-1 bg-transparent text-sm text-dc-text placeholder-dc-muted focus:outline-none"
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            onKeyDown={(e: React.KeyboardEvent<HTMLInputElement>) => {
              if (
                e.key === "Enter" &&
                !e.nativeEvent.isComposing &&
                e.keyCode !== 229
              ) {
                handleSend()
              }
            }}
          />
          <button
            onClick={handleSend}
            disabled={!inputText.trim()}
            className={`ml-3 transition-colors ${
              inputText.trim()
                ? "text-white"
                : "cursor-default text-dc-muted/50"
            }`}
            aria-label="Gönder"
          >
            <Send size={22} />
          </button>
        </div>
      </div>
    </div>
  )
}
