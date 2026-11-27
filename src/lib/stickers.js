// A player's own stickers: pictures from their Photos, or stickers pasted in
// (copied from Messages, a Photos "lift subject" cutout, or the keyboard).
// Each one is shrunk to 320px here, then saved in their own folder of the
// public `stickers` bucket so the whole table can see it when it's thrown.
import { supabase, supabaseEnabled } from './supabase'
import { ownStickerUrl, parseOwnSticker } from './stickerUrl'

export const MAX_STICKERS = 40
const MAX_BYTES = 512 * 1024
const SIZE = 320

export class StickerError extends Error {}

export async function listMyStickers(uid) {
  if (!supabaseEnabled || !uid) return []
  const { data, error } = await supabase.storage.from('stickers').list(uid, { limit: 100, sortBy: { column: 'created_at', order: 'desc' } })
  if (error) throw new StickerError('Couldn’t load your stickers.')
  return (data ?? [])
    .map((o) => parseOwnSticker(ownStickerUrl(`${uid}/${o.name}`)))
    .filter(Boolean)
    .map((s) => ({ ...s, url: ownStickerUrl(s.path) }))
}

async function decode(blob) {
  if (typeof createImageBitmap === 'function') {
    try {
      const bmp = await createImageBitmap(blob)
      return { source: bmp, width: bmp.width, height: bmp.height, done: () => bmp.close?.() }
    } catch {
      // fall through to an <img>, which knows a few more formats on iPhone
    }
  }
  const url = URL.createObjectURL(blob)
  try {
    const img = await new Promise((resolve, reject) => {
      const i = new Image()
      i.onload = () => resolve(i)
      i.onerror = () => reject(new StickerError('That picture couldn’t be opened.'))
      i.src = url
    })
    return { source: img, width: img.naturalWidth, height: img.naturalHeight, done: () => URL.revokeObjectURL(url) }
  } catch (e) {
    URL.revokeObjectURL(url)
    throw e
  }
}

const toBlob = (canvas, type, quality) => new Promise((resolve) => canvas.toBlob(resolve, type, quality))

// Picture → { blob, type, ext, w, h }, at most 320px on its longest side.
// A small animated GIF is kept as it is so it still moves.
export async function prepareSticker(blob) {
  if (!blob || (blob.type && !blob.type.startsWith('image/'))) throw new StickerError('That isn’t a picture.')
  const img = await decode(blob)
  try {
    if (!img.width || !img.height) throw new StickerError('That picture couldn’t be opened.')
    const scale = Math.min(1, SIZE / Math.max(img.width, img.height))
    const w = Math.max(16, Math.round(img.width * scale))
    const h = Math.max(16, Math.round(img.height * scale))
    if (blob.type === 'image/gif' && blob.size <= MAX_BYTES) return { blob, type: 'image/gif', ext: 'gif', w, h }
    const canvas = document.createElement('canvas')
    canvas.width = w
    canvas.height = h
    canvas.getContext('2d').drawImage(img.source, 0, 0, w, h)
    // WebP where the browser can make it (keeps see-through edges), else PNG.
    let out = await toBlob(canvas, 'image/webp', 0.86)
    if (!out || out.type !== 'image/webp') out = await toBlob(canvas, 'image/png')
    if (!out || out.size > MAX_BYTES) out = await toBlob(canvas, 'image/jpeg', 0.85)
    if (!out || out.size > MAX_BYTES) throw new StickerError('That picture is too big.')
    const ext = { 'image/webp': 'webp', 'image/png': 'png', 'image/jpeg': 'jpg' }[out.type] ?? 'png'
    return { blob: out, type: out.type, ext, w, h }
  } finally {
    img.done()
  }
}

export async function addSticker(uid, prepared) {
  if (!supabaseEnabled || !uid) throw new StickerError('Sign in to save your own stickers.')
  const id = crypto.randomUUID()
  const path = `${uid}/${id}_${prepared.w}x${prepared.h}.${prepared.ext}`
  const { error } = await supabase.storage.from('stickers').upload(path, prepared.blob, { contentType: prepared.type, cacheControl: '31536000', upsert: false })
  if (error) {
    if (/row-level security|policy/i.test(error.message)) throw new StickerError(`You have ${MAX_STICKERS} stickers. Remove one to add another.`)
    if (/size|large/i.test(error.message)) throw new StickerError('That picture is too big.')
    throw new StickerError('That sticker didn’t save. Try again.')
  }
  return { path, owner: uid, id, w: prepared.w, h: prepared.h, url: ownStickerUrl(path) }
}

export async function removeSticker(path) {
  const { error } = await supabase.storage.from('stickers').remove([path])
  if (error) throw new StickerError('That sticker didn’t delete. Try again.')
}

// The picture in a paste or drop, if there is one.
export function imageFromTransfer(dt) {
  if (!dt) return null
  for (const item of dt.items ?? []) {
    if (item.kind === 'file' && item.type.startsWith('image/')) return item.getAsFile()
  }
  for (const file of dt.files ?? []) if (file.type.startsWith('image/')) return file
  return null
}

// The picture links inside something pasted or dropped into the paste box,
// best first. Safari turns an Apple sticker or Genmoji into a <picture>: a
// HEIC <source> (Apple's sticker format) plus a plain PNG <img>. The PNG
// opens everywhere, so the <img> links go first.
export function pictureLinks(root) {
  const links = []
  for (const img of root.querySelectorAll('img')) links.push(img.getAttribute('src'))
  for (const el of root.querySelectorAll('source[srcset], img[srcset]')) {
    // Links in a srcset are separated by spaces (a data: link has a comma in it).
    for (const word of el.getAttribute('srcset').trim().split(/\s+/)) {
      if (/^(blob:|data:|https?:)/i.test(word)) links.push(word.replace(/,$/, ''))
    }
  }
  for (const img of root.querySelectorAll('img')) links.push(img.currentSrc)
  return [...new Set(links.filter((u) => u && /^(blob:|data:image\/|https?:)/i.test(u)))]
}

// Each of those links as a picture, skipping any that won't load.
export async function picturesFrom(root) {
  const blobs = []
  for (const link of pictureLinks(root)) {
    try {
      const blob = await (await fetch(link)).blob()
      if (blob.size && (!blob.type || blob.type.startsWith('image/'))) blobs.push(blob)
    } catch {
      // a link on another site that won't share its picture: try the next
    }
  }
  return blobs
}

// The first of these copies of one picture that opens here, ready to save.
export async function prepareFirst(blobs) {
  let error = new StickerError('That sticker couldn’t be read here.')
  for (const blob of blobs) {
    try {
      return await prepareSticker(blob)
    } catch (e) {
      error = e
    }
  }
  throw error
}
