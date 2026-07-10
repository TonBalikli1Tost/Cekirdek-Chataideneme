import nacl from "tweetnacl"
import { encodeBase64, decodeBase64, encodeUTF8, decodeUTF8 } from "tweetnacl-util"

export type KeyPair = {
  publicKey: string
  secretKey: string
}

export type EncryptedPayload = {
  nonce: string
  ciphertext: string
}

/** Her oturum için bir kez çağrılır; NaCl X25519 anahtar çifti üretir */
export function generateKeyPair(): KeyPair {
  const kp = nacl.box.keyPair()
  return {
    publicKey: encodeBase64(kp.publicKey),
    secretKey: encodeBase64(kp.secretKey),
  }
}

/** Alıcının public key'i + göndericinin secret key'i ile şifrele */
export function encryptMsg(
  plaintext: string,
  recipientPublicKey: string,
  senderSecretKey: string,
): EncryptedPayload {
  const nonce = nacl.randomBytes(nacl.box.nonceLength)
  const msg = encodeUTF8(plaintext)
  const ciphertext = nacl.box(
    msg,
    nonce,
    decodeBase64(recipientPublicKey),
    decodeBase64(senderSecretKey),
  )
  return {
    nonce: encodeBase64(nonce),
    ciphertext: encodeBase64(ciphertext),
  }
}

/** Göndericinin public key'i + alıcının secret key'i ile çöz */
export function decryptMsg(
  payload: EncryptedPayload,
  senderPublicKey: string,
  recipientSecretKey: string,
): string | null {
  try {
    const decrypted = nacl.box.open(
      decodeBase64(payload.ciphertext),
      decodeBase64(payload.nonce),
      decodeBase64(senderPublicKey),
      decodeBase64(recipientSecretKey),
    )
    if (!decrypted) return null
    return decodeUTF8(decrypted)
  } catch {
    return null
  }
}

/** Gönderim imzası (mesaj bütünlüğü için opsiyonel) */
export function signMsg(plaintext: string, secretKey: string): string {
  const kp = nacl.sign.keyPair.fromSecretKey(decodeBase64(secretKey))
  const sig = nacl.sign.detached(encodeUTF8(plaintext), kp.secretKey)
  return encodeBase64(sig)
}

export function verifyMsg(
  plaintext: string,
  signature: string,
  publicKey: string,
): boolean {
  try {
    return nacl.sign.detached.verify(
      encodeUTF8(plaintext),
      decodeBase64(signature),
      decodeBase64(publicKey),
    )
  } catch {
    return false
  }
}
