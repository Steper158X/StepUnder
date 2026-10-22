<p align="center">
  <img src="src-tauri/icons/128x128.png" width="96" height="96" alt="StepUnder icon" />
</p>

<h1 align="center">StepUnder</h1>

<p align="center">
  Your music, your server.
</p>

<p align="center">
  <strong>English</strong> · <a href="#thai">ไทย</a>
</p>

StepUnder is a desktop music player for Navidrome and other Subsonic-compatible
music servers. Connect it to your own server and listen to your library — no
cloud account, no telemetry, and no uploads.

> **Status:** early development (0.1.x). Features and UI may still change.

## Features

### Your library

- **Your own server** — works with Navidrome and other Subsonic/OpenSubsonic
  music servers.
- **Multiple servers** — save several servers and switch between them whenever
  you want.
- **Home** — newest albums, recently played, random picks, and your favorites.
- **Albums** — browse your collection, sort it, and keep scrolling to load more.
- **Artists** — open an artist to see their albums and most-played songs.
- **Playlists** — browse your server playlists and play them in one click.
- **Favorites** — all your starred songs, albums, and artists in one place.
- **Search** — find songs, albums, and artists as you type.

### Playback

- **Queue** — play now, add to queue, play next, remove tracks, or clear the
  queue.
- **Playback controls** — shuffle, repeat (off / all / one), seek, volume, and
  mute.
- **Resume where you left off** — the queue, current track, and playback
  position are restored per server.
- **Now playing** — a full-screen view with large artwork.
- **Lyrics** — shows lyrics from your server and scrolls along automatically
  when synced lyrics are available.
- **Two playback engines** — use the built-in player, or switch to the optional
  MPV engine for wider format support.
- **Audio output** — choose which speaker or headphone output to use.
- **Streaming quality** — play the original file, or transcode to
  MP3/AAC/Opus/FLAC with an optional bitrate limit.
- **Scrobbling** — send your plays back to your server, or turn it off.
- **Discord Rich Presence** — optionally show what you are listening to on
  Discord.

### Comfort

- **Thai and English UI** — switch languages at any time.
- **Themes** — dark, light, or follow the system.
- **Font choice** — use the system font or the Sarabun font for Thai text.
- **Keyboard shortcuts** — `Space` to play/pause, arrows to seek and change
  volume, `Shift` + arrows to skip tracks, `Esc` to close the full-screen view.
- **Secure sign-in** — passwords are saved in your operating system's
  credential store, not in a plain settings file.
- **Privacy first** — your music and account stay on your server; StepUnder has
  no backend, no analytics, and no telemetry.

---

<a id="thai"></a>

# StepUnder (ภาษาไทย)

<p align="right"><a href="#stepunder">English ↑</a></p>

StepUnder คือโปรแกรมเล่นเพลงสำหรับเดสก์ท็อปที่ใช้กับ Navidrome และเซิร์ฟเวอร์เพลง
ที่รองรับ Subsonic รายอื่น เชื่อมต่อกับเซิร์ฟเวอร์ของคุณเองแล้วฟังเพลงได้ทันที —
ไม่มีบัญชีคลาวด์ ไม่มี telemetry และไม่อัปโหลดข้อมูลใด ๆ

> **สถานะ:** อยู่ระหว่างการพัฒนา (0.1.x) ฟีเจอร์และ UI อาจเปลี่ยนแปลงได้

## ฟีเจอร์

### ไลบรารีเพลงของคุณ

- **ใช้เซิร์ฟเวอร์ของคุณเอง** — ใช้งานได้กับ Navidrome และเซิร์ฟเวอร์เพลงที่รองรับ
  Subsonic/OpenSubsonic
- **หลายเซิร์ฟเวอร์** — บันทึกได้หลายเครื่องและสลับไปมาได้ทุกเมื่อ
- **หน้าแรก** — อัลบั้มใหม่ เพิ่งเล่นล่าสุด สุ่มเพลง และรายการโปรด
- **อัลบั้ม** — เรียกดูทั้งคอลเลกชัน เรียงลำดับ และเลื่อนโหลดเพิ่มได้เรื่อย ๆ
- **ศิลปิน** — เปิดหน้าศิลปินเพื่อดูอัลบั้มและเพลงที่เล่นบ่อยที่สุด
- **เพลย์ลิสต์** — ดูเพลย์ลิสต์บนเซิร์ฟเวอร์และกดเล่นได้ทันที
- **รายการโปรด** — รวมเพลง อัลบั้ม และศิลปินที่กดถูกใจไว้ในที่เดียว
- **ค้นหา** — ค้นหาเพลง อัลบั้ม และศิลปินได้ขณะพิมพ์

### การเล่นเพลง

- **คิวเพลง** — เล่นทันที เพิ่มเข้าคิว เล่นถัดไป ลบเพลง หรือล้างคิวทั้งหมด
- **ปุ่มควบคุม** — shuffle, repeat (ปิด / ทั้งหมด / เพลงเดียว), เลื่อนตำแหน่ง,
  ปรับเสียง และ mute
- **เล่นต่อจากเดิม** — คิว เพลงปัจจุบัน และตำแหน่งเล่นถูกกู้คืนแยกตามเซิร์ฟเวอร์
- **หน้า Now Playing** — หน้าจอเต็มพร้อมปกอัลบั้มขนาดใหญ่
- **เนื้อเพลง** — แสดงเนื้อเพลงจากเซิร์ฟเวอร์ และเลื่อนตามจังหวะอัตโนมัติ
  เมื่อมีเนื้อเพลงแบบ synced
- **สองเอนจินเสียง** — ใช้เครื่องเล่นในตัว หรือสลับไปใช้ MPV เพื่อรองรับ
  ฟอร์แมตกว้างขึ้น
- **อุปกรณ์เสียงออก** — เลือกลำโพงหรือหูฟังที่ต้องการใช้
- **คุณภาพการสตรีม** — เล่นไฟล์ต้นฉบับ หรือแปลงเป็น MP3/AAC/Opus/FLAC
  พร้อมจำกัด bitrate
- **Scrobbling** — ส่งประวัติการเล่นกลับเซิร์ฟเวอร์ หรือปิดก็ได้
- **Discord Rich Presence** — แสดงเพลงที่กำลังฟังบน Discord (เปิดใช้ได้ตามต้องการ)

### ความสะดวกในการใช้งาน

- **UI ไทยและอังกฤษ** — สลับภาษาได้ทุกเมื่อ
- **ธีม** — มืด สว่าง หรือตามระบบ
- **เลือกฟอนต์** — ใช้ฟอนต์ของระบบ หรือฟอนต์ Sarabun สำหรับข้อความไทย
- **คีย์ลัด** — `Space` เล่น/หยุด, ลูกศรเลื่อนตำแหน่งและปรับเสียง,
  `Shift` + ลูกศรเปลี่ยนเพลง, `Esc` ปิดหน้าจอเต็ม
- **เข้าสู่ระบบอย่างปลอดภัย** — รหัสผ่านถูกเก็บใน credential store ของระบบ
  ไม่ได้เก็บในไฟล์ตั้งค่าแบบข้อความธรรมดา
- **ความเป็นส่วนตัวมาก่อน** — เพลงและบัญชีอยู่บนเซิร์ฟเวอร์ของคุณ
  StepUnder ไม่มี backend ไม่มี analytics และไม่มี telemetry

---

**License:** MIT
