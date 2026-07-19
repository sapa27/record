# รายงานการปิดช่องโหว่ P0 — Meetily Thai + Google Apps Script

วันที่: 19 กรกฎาคม 2026  
โครงการ: Meeting Transcription & Recorder (Meetily Thai)  
ขอบเขต: Local API, Whisper HTTP Server, Tauri/Rust, WebView, Secret Storage, Cloud/Custom LLM, Analytics และ Google Apps Script

## 1. สถานะโดยสรุป

ช่องโหว่ระดับ P0 ที่ระบุจาก Security Audit ก่อนหน้าได้รับการแก้ไขใน Source Code แล้ว ได้แก่ การเปิดบริการบน LAN โดยไม่ยืนยันตัวตน การคืน API key ผ่าน API การใช้ audio buffer ร่วมกัน การเปิด dynamic model loader การเรียก Windows shell ด้วย `cmd /C` การเก็บ secret แบบ plaintext และการส่งข้อมูลไป Cloud/Custom endpoint โดยไม่มีนโยบายส่วนกลาง

**สถานะปัจจุบัน: P0 Source Hardening Complete**

อย่างไรก็ตาม เอกสารนี้ไม่ใช่ใบรับรอง Production Security ขั้นสุดท้าย เนื่องจากสภาพแวดล้อมตรวจสอบไม่มี Rust/Cargo toolchain และ dependency tree ของ whisper.cpp ที่สมบูรณ์ จึงยังต้องทำ full build, runtime test ทุกระบบปฏิบัติการ, live GAS test, packet capture และ penetration test ก่อนใช้งานกับข้อมูลลับจริง

## 2. รายการ P0 ที่แก้ไข

### P0-01 — Local API เปิดรับจากเครือข่ายโดยไม่มี Authentication

แก้ไขแล้ว:

- การรัน Python backend โดยตรง bind ที่ `127.0.0.1:5167`
- Docker publish port ทุกบริการผ่าน `127.0.0.1` เท่านั้น
- business/data endpoint ทุกเส้นทางต้องมี `Authorization: Bearer <token>`
- Token ต้องยาวอย่างน้อย 32 ตัวอักษร
- ใช้ constant-time comparison
- หากไม่ตั้ง Token ระบบ fail closed: health check ยังทำงาน แต่ business endpoint ตอบ `503`
- จำกัด request body และตรวจ `Content-Length`
- CORS ใช้ explicit localhost allowlist และปิด credentialed wildcard
- `/healthz` เป็น public endpoint เพียงรายการเดียวและไม่คืนข้อมูลการประชุม

หมายเหตุ: service ภายใน Docker bind `0.0.0.0` เพื่อให้ Docker port forwarding ทำงาน แต่ host publish ถูกจำกัดที่ `127.0.0.1` จึงไม่เปิดให้ LAN โดยค่าเริ่มต้น

### P0-02 — API คืนค่า API key และเก็บ credential แบบ plaintext

แก้ไขแล้ว:

- ลบ HTTP route ที่อ่านหรือคืน API key
- Python backend ปฏิเสธการบันทึก cloud/transcription API key
- ล้างค่า credential เก่าจาก SQLite ของ legacy backend
- Tauri ย้าย API key และ GAS shared secret ไป OS Credential Store ผ่าน `keyring`
- รองรับ migration แบบครั้งเดียวจากฐานข้อมูล/ไฟล์ตั้งค่ารุ่นเก่า แล้วล้าง plaintext ทันที
- ข้อมูล config ที่คืนให้ WebView ระบุเพียงสถานะ `configured` และไม่คืนค่า secret
- React state และ config event ถูก redact หลังบันทึก
- การนำเข้าฐานข้อมูลเก่าจะ migrate secret ก่อนนำฐานข้อมูลเข้าสู่ application state

Credential Store ที่ใช้ตามระบบปฏิบัติการ:

- Windows: Windows Credential Manager
- macOS: Keychain
- Linux: Secret Service/Keyring backend ที่รองรับ

หาก Credential Store ใช้งานไม่ได้ การบันทึก secret จะล้มเหลวแทนการ fallback ไปเก็บ plaintext

### P0-03 — Whisper Server ไม่มี Authentication และ audio buffer ปะปนข้ามผู้ใช้

แก้ไขแล้ว:

- ต้องตั้ง `MEETILY_WHISPER_TOKEN` อย่างน้อย 32 ตัวอักษร
- ทุก endpoint ยกเว้น `/healthz` ต้องใช้ Bearer Token
- Streaming ต้องส่ง `X-Meetily-Session`
- แยก audio buffer ด้วย session ID
- จำกัดพร้อมกันไม่เกิน 32 sessions
- จำกัดเสียงต่อ request/session ไม่เกินประมาณ 60 วินาที
- จำกัด payload size
- เพิ่ม `/stream/reset` และ `X-Meetily-Stream-End` เพื่อล้าง session
- serialize inference ด้วย mutex เพื่อป้องกัน race condition ของ model/context
- ลบ `/load` ออกจาก Production server
- ลบ embedded Whisper Web UI
- ค่าเริ่มต้น bind `127.0.0.1`
- CORS ไม่ใช้ wildcard

### P0-04 — Windows command injection ผ่าน `open_external_url`

แก้ไขแล้ว:

- ยกเลิก `cmd.exe /C start`
- ตรวจ URL ด้วย parser ก่อนเปิด
- อนุญาตเฉพาะ HTTPS port 443
- ใช้ exact hostname allowlist
- ปฏิเสธ embedded credentials, query/fragment ตามนโยบายที่กำหนด และ scheme อันตราย เช่น `file:`, `javascript:`, `data:`
- Windows ใช้ `rundll32.exe url.dll,FileProtocolHandler` โดยไม่ผ่าน shell command parser

Hostname ที่อนุญาตใน source ปัจจุบัน:

- `docs.google.com`
- `drive.google.com`
- `github.com`
- `ollama.com`
- `meetily.zackriya.com`

### P0-05 — Cloud AI, Custom LLM และ Remote Ollama ไม่มีนโยบายรวม

แก้ไขแล้ว:

- `MEETILY_CONFIDENTIAL_MODE` เปิดเป็นค่าเริ่มต้น
- ใน Confidential Mode อนุญาตการถอดเสียงด้วย `localWhisper` เท่านั้น
- Cloud provider ถูกบล็อกที่ Rust service ก่อนสร้าง network request
- Analytics ถูกบล็อกและ client ถูกล้างใน Confidential Mode
- Custom LLM ใช้ได้เฉพาะ localhost และพอร์ตที่ allowlist ใน Confidential Mode
- Remote Custom LLM ต้องปิด Confidential Mode, เปิด flag, ใช้ HTTPS และอยู่ใน exact hostname allowlist
- Remote Ollama ใช้นโยบายแบบเดียวกัน
- ปฏิเสธ private/link-local IP เมื่อตั้งเป็น external endpoint
- ปิด HTTP redirects สำหรับ provider client เพื่อป้องกัน API key ถูกส่งต่อไป host อื่น
- WebView CSP เปลี่ยน `connect-src` เป็น `'self'` เพื่อไม่ให้ JavaScript ใน WebView ส่งข้อมูลออกโดยตรง

Environment variables ที่ใช้ควบคุม:

- `MEETILY_CONFIDENTIAL_MODE=1`
- `MEETILY_ALLOW_EXTERNAL_CUSTOM_LLM=0`
- `MEETILY_EXTERNAL_LLM_ALLOWLIST=`
- `MEETILY_ALLOW_REMOTE_OLLAMA=0`
- `MEETILY_REMOTE_OLLAMA_ALLOWLIST=`
- `MEETILY_OLLAMA_LOCAL_PORTS=11434`
- `MEETILY_CUSTOM_LLM_LOCAL_PORTS=`

### P0-06 — Google Apps Script transport และการส่ง raw transcript

แก้ไขแล้ว:

- endpoint ต้องเป็น `https://script.google.com/macros/s/.../exec`
- redirect ติดตามได้เฉพาะ HTTPS บน Google-controlled hosts
- ใช้ HMAC-SHA256
- canonical request ประกอบด้วย Client ID, timestamp, nonce, action และ payload
- timestamp มีอายุ 300 วินาที
- nonce cache + lock ป้องกัน replay
- Client ID ต้องตรง allowlist
- shared secret ต้องยาวอย่างน้อย 32 ตัวอักษร
- ป้องกัน duplicate document ด้วย content hash
- ป้องกัน Spreadsheet Formula Injection
- desktop และ GAS ปฏิเสธ `transcript_text` ทั้งสองชั้น
- ไม่ส่งไฟล์เสียงไป GAS
- outward error เป็นข้อความทั่วไป ไม่เปิดเผย stack/internal detail
- GAS secret ถูกเก็บใน OS Credential Store ไม่อยู่ใน JSON metadata

## 3. การส่งข้อมูลออกจากเครื่องหลัง Hardening

### ค่าเริ่มต้นเมื่อ Confidential Mode เปิด

ไม่ส่งข้อมูลการประชุมไปยัง:

- OpenAI
- Anthropic
- Groq
- OpenRouter
- External Custom LLM
- Remote Ollama
- PostHog Analytics

การถอดเสียงและสรุปต้องใช้ Local Whisper และ local model/Ollama ที่ผ่าน endpoint policy

### ช่องทางที่ยังอาจมี outbound traffic

1. **Google Apps Script** — ส่งเฉพาะเอกสารภาษาไทยที่สร้างเสร็จ เมื่อผู้ใช้กดส่งเอง ไม่ส่งเสียงและไม่ส่ง raw transcript
2. **Model download** — ส่ง IP, user-agent และชื่อไฟล์โมเดลไปยัง model host แต่ไม่ส่งเนื้อหาการประชุม
3. **Application updater** — ติดต่อ release host เพื่อตรวจอัปเดต แต่ไม่ส่ง transcript
4. **Cloud provider** — ใช้ได้เฉพาะเมื่อผู้ดูแลปิด Confidential Mode และตั้ง policy/credential โดยเจตนา

ดังนั้นระบบไม่สามารถรับรองว่าไม่มี outbound traffic ทุกชนิด แต่ในค่าเริ่มต้นหลัง hardening ไม่มีเส้นทางอัตโนมัติที่ส่งเสียงหรือ transcript ไป Cloud AI/Analytics

## 4. ไฟล์สำคัญที่แก้ไข

### Backend / Docker

- `backend/app/main.py`
- `backend/app/db.py`
- `backend/app/transcript_processor.py`
- `backend/docker-compose.yml`
- `backend/generate_security_env.py`
- `backend/clean_start_backend.sh`
- `backend/clean_start_backend.cmd`
- `backend/start_with_output.ps1`
- `backend/start_whisper_server.cmd`
- `backend/docker/entrypoint.sh`

### Whisper Server

- `backend/whisper-custom/server/server.cpp`
- `backend/whisper-custom/server/README.md`

### Tauri / Rust

- `frontend/src-tauri/src/security.rs`
- `frontend/src-tauri/src/api/api.rs`
- `frontend/src-tauri/src/gas_integration.rs`
- `frontend/src-tauri/src/database/repositories/setting.rs`
- `frontend/src-tauri/src/database/setup.rs`
- `frontend/src-tauri/src/database/commands.rs`
- `frontend/src-tauri/src/summary/service.rs`
- `frontend/src-tauri/src/summary/llm_client.rs`
- `frontend/src-tauri/src/ollama/ollama.rs`
- `frontend/src-tauri/src/analytics/commands.rs`
- `frontend/src-tauri/src/analytics/analytics.rs`
- `frontend/src-tauri/tauri.conf.json`
- `frontend/src-tauri/Cargo.toml`

### Frontend / GAS

- `frontend/src/components/ModelSettingsModal.tsx`
- `frontend/src/contexts/ConfigContext.tsx`
- `frontend/src/components/MeetingDetails/SummaryPanel.tsx`
- `gas/Code.gs`
- `gas/README_TH.md`

## 5. วิธีสร้าง Token และเปิดระบบอย่างปลอดภัย

### Linux/macOS

```bash
cd backend
python3 generate_security_env.py --output .env
set -a
source .env
set +a
docker compose --env-file .env up --build
```

ไฟล์ `.env` ถูกตั้ง permission `0600` และถูกระบุใน `.gitignore` ห้าม commit หรือส่งให้ผู้อื่น

### Windows

ใช้ launcher ที่ปรับปรุงแล้ว:

- `backend\clean_start_backend.cmd`
- `backend\start_with_output.ps1`
- `backend\start_whisper_server.cmd`

ต้องกำหนด `MEETILY_BACKEND_TOKEN` และ `MEETILY_WHISPER_TOKEN` ให้ process ของ Tauri/backend/Whisper ใช้ค่าเดียวกันตามบริการที่เรียก

## 6. การตั้งค่า GAS

Script Properties ที่จำเป็น:

- `GAS_SHARED_SECRET` — อย่างน้อย 32 ตัวอักษร
- `ALLOWED_CLIENT_ID`
- `SPREADSHEET_ID`
- `DRIVE_FOLDER_ID` — ไม่บังคับ

Secret ใน Desktop ต้องตรงกับ `GAS_SHARED_SECRET` และถูกเก็บใน OS Credential Store

## 7. ผลการตรวจสอบ

ผ่าน 59/59 checks ได้แก่:

- Python syntax
- JSON/TOML/YAML parsing
- Bash syntax
- GAS JavaScript syntax
- TypeScript/TSX parser 172 ไฟล์
- Rust/C++ lexical structure สำหรับไฟล์ที่แก้ไข 18 ไฟล์
- Security environment generator
- HMAC cross-runtime vector
- Security invariants
- Live Local API authentication test
- Live fail-closed test เมื่อไม่มี Token
- Live CORS allowlist test

ผล runtime ของ Local API:

| กรณี | ผล |
|---|---:|
| `/healthz` | 200 |
| Business API ไม่มี Token | 401 |
| Business API Token ผิด | 401 |
| Business API Token ถูกต้อง | 200 |
| ไม่ได้ตั้ง Token | Business API 503 |
| CORS origin localhost ที่อนุญาต | มี `Access-Control-Allow-Origin` |
| CORS origin ภายนอก | ไม่มี `Access-Control-Allow-Origin` |

## 8. สิ่งที่ยังต้องตรวจต่อก่อน Production

- Full `next build`
- `cargo check`, `cargo test` และ Tauri production build
- Full Whisper C++ build/link บน dependency tree จริง
- Runtime test ของ OS Keychain บน Windows/macOS/Linux
- PowerShell runtime test
- Live GAS deployment test กับ Workspace เป้าหมาย
- Dynamic packet capture เพื่อยืนยัน data egress
- LAN/local-service penetration test
- Dependency upgrade/SCA ที่เหลือจาก P1
- Model/FFmpeg checksum pinning และ signed manifest จาก P1
- Code signing และ SBOM

## 9. ข้อสรุป

P0 ที่พบจากการตรวจครั้งก่อนได้รับการปิดใน Source Code แล้ว โดยระบบเปลี่ยนจาก “เปิดกว้างและเชื่อ frontend/network” เป็น “localhost + strong authentication + fail closed + OS keychain + Confidential Mode + explicit allowlist”

อนุญาตให้เริ่มขั้นตอน build และทดสอบในสภาพแวดล้อม staging ที่ไม่มีข้อมูลลับได้ แต่ยังไม่ควรประกาศ Production Security Sign-off จนกว่าจะผ่าน full build, live integration, packet capture และ penetration test ตามหัวข้อที่ 8
