import {
  AudioMimeType,
  BytesHasPrefix,
  GetArrayBuffer,
  GetCoverFromFile,
  GetMetaFromFile,
  SniffAudioExt,
} from '@/decrypt/utils';
import { parseBlob as metaParseBlob } from 'music-metadata-browser';
import { DecryptResult } from '@/decrypt/entity';
import { DecryptKgmWasm } from '@/decrypt/kgm_wasm';

//prettier-ignore
const VprHeader = [
  0x05, 0x28, 0xBC, 0x96, 0xE9, 0xE4, 0x5A, 0x43,
  0x91, 0xAA, 0xBD, 0xD0, 0x7A, 0xF5, 0x36, 0x31
]
//prettier-ignore
const KgmHeader = [
  0x7C, 0xD5, 0x32, 0xEB, 0x86, 0x02, 0x7F, 0x4B,
  0xA8, 0xAF, 0xA6, 0x8E, 0x0F, 0xFF, 0x99, 0x14
]

export async function Decrypt(file: File, raw_filename: string, raw_ext: string): Promise<DecryptResult> {
  const oriData = await GetArrayBuffer(file);
  if (raw_ext === 'vpr') {
    if (!BytesHasPrefix(new Uint8Array(oriData), VprHeader)) throw Error('Not a valid vpr file!');
  } else {
    if (!BytesHasPrefix(new Uint8Array(oriData), KgmHeader)) throw Error('Not a valid kgm(a) file!');
  }
  let musicDecoded = new Uint8Array();
  if (globalThis.WebAssembly) {
    const kgmDecrypted = await DecryptKgmWasm(oriData, raw_ext);
    if (kgmDecrypted.success) {
      musicDecoded = kgmDecrypted.data;
      console.log('kgm wasm decoder suceeded');
    } else {
      throw new Error(kgmDecrypted.error || '(unknown error)');
    }
  }

  const ext = SniffAudioExt(musicDecoded);
  const mime = AudioMimeType[ext];
  let musicBlob = new Blob([musicDecoded], { type: mime });
  const musicMeta = await metaParseBlob(musicBlob);
  const { title, artist } = GetMetaFromFile(raw_filename, musicMeta.common.title, String(musicMeta.common.artists || musicMeta.common.artist || ""));
  return {
    album: musicMeta.common.album,
    picture: GetCoverFromFile(musicMeta),
    file: URL.createObjectURL(musicBlob),
    blob: musicBlob,
    ext,
    mime,
    title,
    artist,
  };
}
