# การติดตั้ง Google Apps Script สำหรับ Meetily Thai

## 1. เตรียมปลายทาง

1. สร้าง Google Spreadsheet สำหรับทะเบียนเอกสารการประชุม แล้วคัดลอก `SPREADSHEET_ID` จาก URL
2. สร้างโฟลเดอร์ Google Drive สำหรับเก็บ Google Docs แล้วคัดลอก `DRIVE_FOLDER_ID` (ไม่บังคับ)
3. สร้างโครงการ Google Apps Script และนำ `Code.gs` กับ `appsscript.json` ไปวางทับไฟล์ในโครงการ

## 2. ตั้งค่า Script Properties

เปิด **Project Settings > Script Properties** แล้วเพิ่ม:

- `GAS_SHARED_SECRET` ค่าลับแบบสุ่มอย่างน้อย 32 ตัวอักษร แนะนำ 32 ไบต์ขึ้นไป
- `ALLOWED_CLIENT_ID` รหัสเครื่องหรือหน่วยงาน เช่น `committee-secretariat-01`
- `SPREADSHEET_ID` รหัส Spreadsheet ปลายทาง
- `DRIVE_FOLDER_ID` รหัสโฟลเดอร์สำหรับ Google Docs (ไม่บังคับ)

ตัวอย่างสร้าง Secret:

```bash
openssl rand -hex 32
```

ห้ามเก็บ Secret ใน Git, source code, Google Sheet หรือข้อความแชตสาธารณะ ให้ใช้ค่าเดียวกันใน Script Properties และหน้า **การตั้งค่า > Google Apps Script** ของแอป

## 3. Deploy เป็น Web App

1. เลือก **Deploy > New deployment > Web app**
2. Execute as: **Me**
3. Who has access: **Anyone**
4. คัดลอก URL ที่ลงท้ายด้วย `/exec` ไปตั้งค่าใน Meetily

แม้ Web App ต้องรับคำขอแบบไม่ล็อกอิน แต่ทุกคำขอจากแอปต้องผ่าน HMAC-SHA256, Client ID, timestamp และ nonce ก่อนเข้าถึงข้อมูล

## 4. ทดสอบ

1. กรอก URL, Client ID และ Shared Secret ใน Meetily
2. กด **บันทึกการตั้งค่า**
3. กด **ทดสอบการเชื่อมต่อ**
4. สร้างเอกสารด้วยแม่แบบภาษาไทย แล้วกด **ส่งไป GAS**

ระบบจะสร้างชีต `MEETING_DOCUMENTS` และ Google Docs โดยอัตโนมัติ เนื้อหาเต็มอยู่ใน Google Docs ส่วน Sheets เก็บ excerpt และ SHA-256 hash เพื่อไม่เกินข้อจำกัด 50,000 ตัวอักษรต่อเซลล์

## ความปลอดภัยและข้อมูลส่วนบุคคล

- ไม่ส่งไฟล์เสียงไปยัง GAS
- ไม่ส่งบทถอดเสียงเต็มโดยอัตโนมัติ
- ส่งเฉพาะเอกสารที่ผู้ใช้กดส่ง
- ป้องกัน replay attack ด้วย timestamp/nonce และป้องกันการบันทึกเอกสารซ้ำด้วย content hash
- ป้องกัน spreadsheet formula injection ก่อนเขียนข้อมูลลงเซลล์
- ควรจำกัดสิทธิ์ Spreadsheet, Drive Folder และ Apps Script เฉพาะผู้ดูแลที่จำเป็น
- เปลี่ยน Shared Secret ทันทีเมื่อสงสัยว่ารั่วไหล แล้วตั้งค่าใหม่ทั้งสองฝั่ง

## นโยบายข้อมูล P0

- GAS Bridge ไม่รับไฟล์เสียงหรือบทถอดเสียงดิบ (`transcript_text`)
- ส่งได้เฉพาะเอกสารสรุปการประชุม บันทึกการประชุม หรือข่าวการประชุมที่ผู้ใช้กดส่งเอง
- Secret ต้องมีอย่างน้อย 32 ตัวอักษรและควรสร้างด้วยตัวสุ่มแบบเข้ารหัส
