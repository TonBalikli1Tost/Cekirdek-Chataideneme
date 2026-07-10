"use client"

import { useCekirdekRoom } from "@/hooks/use-cekirdek-room"
import { JoinScreen } from "@/components/join-screen"
import { ChatRoom } from "@/components/chat-room"

export function CekirdekApp() {
  const room = useCekirdekRoom()

  if (room.status === "idle") {
    return <JoinScreen onJoin={(profile, r) => room.join(profile, r)} />
  }

  return (
    <ChatRoom
      room={room.room}
      status={room.status}
      members={room.members}
      messages={room.messages}
      voiceOn={room.voiceOn}
      muted={room.muted}
      onSend={room.sendMessage}
      onStartVoice={room.startVoice}
      onStopVoice={room.stopVoice}
      onToggleMute={room.toggleMute}
    />
  )
}
