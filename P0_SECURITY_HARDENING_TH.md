# Meetily P0 Security Hardening

## ค่าเริ่มต้นหลังการแก้ไข

- Python backend และ Whisper HTTP server เปิดเฉพาะ `127.0.0.1`
- ทุก data endpoint ต้องใช้ Bearer token อย่างน้อย 32 ตัวอักษร
- `/healthz` เป็น endpoint เดียวที่ไม่ต้องยืนยันตัวตนและไม่คืนข้อมูลการประชุม
- Whisper streaming แยก buffer ด้วย `X-Meetily-Session` และล้างด้วย `/stream/reset` หรือ `X-Meetily-Stream-End: 1`
- endpoint `/load` ถูกปิด
- API key และ GAS shared secret จัดเก็บใน OS Keychain/Credential Store
- WebView ไม่สามารถอ่าน secret กลับมาได้
- Confidential Mode เปิดเป็นค่าเริ่มต้นและปิด Cloud AI/Analytics/endpoint ภายนอก
- URL ที่เปิดจากแอปจำกัดเฉพาะ HTTPS และโดเมน allowlist

## สร้าง Token

```bash
cd backend
python3 generate_security_env.py
```

คำสั่งจะสร้าง `backend/.env` ซึ่ง Docker Compose โหลดโดยอัตโนมัติ:

```bash
docker compose up --build
```

หากต้องการชื่อไฟล์อื่นให้ใช้ `--output` และส่ง `--env-file` ให้ Docker Compose อย่างชัดเจน ไฟล์จริงทุกชื่อห้าม commit หรือส่งให้ผู้อื่น

## ใช้ Legacy Backend จาก Desktop App

ตัวแอปและ backend ต้องได้รับ `MEETILY_BACKEND_TOKEN` ค่าเดียวกันใน environment ของ process หากไม่ได้ใช้งาน legacy HTTP backend ไม่ต้องเปิด service port `5167`

## การเปิด Cloud แบบเจาะจง

ค่าเริ่มต้นห้ามส่ง transcript ออกนอกเครื่อง การเปิด endpoint ภายนอกต้องดำเนินการพร้อมกันทั้งสองเงื่อนไข:

1. ตั้ง `MEETILY_CONFIDENTIAL_MODE=0`
2. เปิด flag และกำหนด hostname แบบ exact allowlist

ตัวอย่าง Custom LLM:

```dotenv
MEETILY_ALLOW_EXTERNAL_CUSTOM_LLM=1
MEETILY_EXTERNAL_LLM_ALLOWLIST=llm.example.go.th
```

ตัวอย่าง Remote Ollama:

```dotenv
MEETILY_ALLOW_REMOTE_OLLAMA=1
MEETILY_REMOTE_OLLAMA_ALLOWLIST=ollama.example.go.th
```

ปลายทางภายนอกต้องใช้ HTTPS เท่านั้น ส่วน Custom LLM บน localhost ต้องระบุพอร์ตใน `MEETILY_CUSTOM_LLM_LOCAL_PORTS` ก่อนใช้งาน

## Analytics

Analytics ถูกปิดใน Confidential Mode และไม่มี key ฝังใน source code การเปิดต้องปิด Confidential Mode พร้อมกำหนด `MEETILY_POSTHOG_KEY` ด้วยตนเอง
