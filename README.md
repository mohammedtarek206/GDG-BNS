# 🎟️ GDG Event Platform

> **منصة إدارة فعاليات مجتمعات مطوري جوجل وإصدار التذاكر الإلكترونية مع التحقق السريع عبر QR Code.**  
> A complete, production-grade event management, QR check-in, and attendee ticket delivery platform for **Google Developer Groups (GDG)**.

---

## 🌟 الميزات الرئيسية (Key Features)

- **⚡ لوحة تحكم حية (Live Admin Dashboard)**: إحصائيات تفاعلية فورية لعدد المسجلين، التذاكر المُصدرة، ومعدل الحضور، مع رسوم بيانية لحركة تسليم البريد وسجل الحضور الأخير.
- **📂 استيراد ذكي من Excel / CSV (Smart Spreadsheet Import)**:
  - كشف تلقائي لأسماء الأعمدة باللغتين العربية والإنجليزية.
  - مطابقة وتعيين الأعمدة مع معاينة حية قبل الاستيراد.
  - فحص البيانات ومنع تكرار الإدخال بأمان.
- **🔐 تذاكر رقمية مشفرة (Cryptographically Secure QR Tickets)**:
  - توليد تذاكر رقمية فريدة لكل مشارك بترميز 32-byte مشفر غير قابل للتخمين.
  - التذكرة لا تحمل بيانات حساسة داخل الـ QR وتعتمد على التحقق من الخادم.
- **📱 ماسح ضوئي ذكي للدخول (Live Mobile Check-in Scanner)**:
  - يدعم الكاميرا الخلفية للهواتف الذكية مع استجابة فورية أقل من ثانية.
  - تنبيهات صوتية ومرئية عند نجاح الدخول أو تكرار المسح أو إلغاء التذكرة.
  - معالجة ذرية (Atomic Updates) تمنع الدخول المزدوج حتى في وجود طلبات متزامنة.
  - خيار إدخال كود التذكرة يدوياً في حال تعذر استخدام الكاميرا.
- **📧 نظام إرسال وإدارة البريد (Resend Email Automation)**:
  - جدولة وإرسال تذاكر الـ QR بضغطة زر واحدة.
  - إرسال على دفعات مع إعادة المحاولة التلقائية (Exponential Backoff).
  - دعم Resend Webhooks لتأكيد وصول الإيميل لصندوق الوارد (Delivered/Bounced).
- **🎫 صفحة تذكرة عامة فاخرة (Public Digital Ticket Pass)**:
  - صفحة تذكرة رقمية متجاوبة مصممة على طراز Google Wallet / Apple Wallet.
  - دعم حفظ وطباعة التذكرة كـ PDF بضغطة زر.
  - إضافة الحدث مباشرة إلى Google Calendar.
- **📊 تحليلات وتقارير متقدمة (Reports & Analytics)**:
  - رسم بياني لحركة الدخول على مدار ساعات الحدث.
  - تصنيف الحضور حسب الجامعات والشركات.
  - تصدير كامل لقوائم الحضور وسجلات الفحص كملفات CSV.
- **🛡️ إدارة فريق التنظيم (Staff Management)**:
  - إضافة حسابات للمتطوعين ومنظمي بوابات الدخول للوصول إلى الماسح الضوئي فقط.
- **⚙️ إعدادات الحدث (Event Settings)**:
  - تعديل اسم الحدث وتفاصيله بالعربية والإنجليزية، وتاريخ ومكان الفعالية، والشعار والروابط.

---

## 🛠️ متطلبات التشغيل (Prerequisites)

- **Node.js** الإصدار 18 أو 20 أو أحدث.
- قاعدة بيانات **MongoDB** (محلياً أو عبر [MongoDB Atlas](https://www.mongodb.com/cloud/atlas) مجاناً).
- حساب مجاني في **Resend** للحصول على مفتاح API لإرسال الإيميلات ([resend.com](https://resend.com)).

---

## 🚀 التثبيت والتشغيل (Quick Start)

### 1. تثبيت الحزم (Install Dependencies)
```bash
npm install
```

### 2. إعداد المتغيرات البيئية (Environment Variables)
انسخ ملف `.env.example` إلى `.env.local` أو عدل ملف `.env.local` المنشأ:
```env
# رابط قاعدة بيانات MongoDB (محلية أو Atlas)
MONGODB_URI=mongodb+srv://<username>:<password>@cluster.mongodb.net/gdg-event?retryWrites=true&w=majority

# مفاتيح التشفير والجلسات (32+ حرف عشوائي)
SESSION_SECRET=c2VjdXJlX3Nlc3Npb25fc2VjcmV0X2dkZ19ldmVudF8xMjM0NQ==
QR_SECRET=c2VjdXJlX3FyX3NlY3JldF9nZGdfZXZlbnRfMTIzNDU2Nzg5MA==

# مفاتيح Resend Email
RESEND_API_KEY=re_xxxxxxxxxxxxxxxxxxxx
RESEND_WEBHOOK_SECRET=whsec_xxxxxxxxxxxxxxxxxxxx
EMAIL_FROM=GDG Event <tickets@yourdomain.com>

# رابط التطبيق
NEXT_PUBLIC_APP_URL=http://localhost:3000

# بيانات حساب الأدمن الافتراضي
SEED_ADMIN_EMAIL=admin@gdg.community
SEED_ADMIN_PASSWORD=Admin123456!
```

### 3. إنشاء حساب الأدمن الافتراضي (Seed Database)
قم بتشغيل السكربت لإنشاء حساب المدير وإعدادات الحدث الأولية:
```bash
npm run seed:admin
```
- **البريد الإلكتروني الافتراضي**: `admin@gdg.community`
- **كلمة المرور الافتراضية**: `Admin123456!`

### 4. تشغيل خادم التطوير (Run Development Server)
```bash
npm run dev
```
افتح المتصفح على:
- 🌐 **الصفحة الرئيسية للحضور**: `http://localhost:3000`
- 🔐 **لوحة الإدارة**: `http://localhost:3000/admin/login`
- 📱 **ماسح التذاكر**: `http://localhost:3000/admin/checkin`

---

## 📂 هيكل المشروع (Project Structure)

```
├── scripts/
│   └── seed-admin.ts          # سكربت تهيئة الأدمن وإعدادات الحدث
├── src/
│   ├── app/
│   │   ├── (public)/
│   │   │   ├── page.tsx       # الصفحة الرئيسية للبحث عن التذاكر
│   │   │   └── ticket/[token] # صفحة عرض التذكرة الرقمية للحاضر
│   │   ├── admin/
│   │   │   ├── login/         # صفحة تسجيل دخول الإدارة وفريق الفحص
│   │   │   └── (panel)/       # لوحة التحكم المحمية
│   │   │       ├── dashboard/ # لوحة المؤشرات والإحصائيات
│   │   │       ├── import/    # استيراد شيتات الحضور
│   │   │       ├── attendees/ # جدول الحضور وإدارتهم
│   │   │       ├── tickets/   # توليد تذاكر QR بالجملة
│   │   │       ├── emails/    # إدارة وجدولة إرسال التذاكر
│   │   │       ├── checkin/   # ماسح الكاميرا والفحص السريع
│   │   │       ├── reports/   # التقارير والرسوم البيانية
│   │   │       ├── staff/     # إدارة منظمي الحدث
│   │   │       └── settings/  # إعدادات الحدث والروابط
│   │   └── api/               # 23 واجهة برمجية (API Routes) متكاملة
│   ├── components/            # المكونات المشتركة والقائمة الجانبية
│   ├── lib/                   # أدوات التشفير، قاعدة البيانات، الإكسل، الإيميل
│   └── models/                # نماذج Mongoose (المشاركين، التذاكر، الوظائف، ...)
```

---

## 🔒 الأمان والحماية (Security)

- **Cryptographic Nonce**: جميع التذاكر مشفرة برمز 32-byte عشوائي؛ قاعدة البيانات تخزن فقط تجزئة `SHA-256`.
- **Atomic Operations**: عمليات الفحص تتم باستخدام تحديثات ذرية مشروطة في MongoDB لمنع هجمات التزامن (Race Conditions).
- **Anti Formula Injection**: تعقيم كافة حقول النصوص عند تصدير شيتات CSV ضد ثغرات حقن المعادلات.
- **Rate Limiting**: حدود طلبات برمجية لمنع هجمات التخمين على تسجيل الدخول والبحث عن التذاكر.
- **Iron Session**: جلسات مشفرة بالكامل تعتمد على ملفات تعريف ارتباط آمنة (`httpOnly`, `sameSite`, `secure`).

---

## 📜 الترخيص (License)
Built for Google Developer Groups communities worldwide.
