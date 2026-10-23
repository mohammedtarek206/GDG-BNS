import mongoose from "mongoose";
import bcrypt from "bcryptjs";
import * as fs from "fs";
import * as path from "path";

// Simple .env / .env.local loader
function loadEnv() {
  const root = path.resolve(process.cwd());
  for (const file of [".env.local", ".env"]) {
    const fullPath = path.join(root, file);
    if (fs.existsSync(fullPath)) {
      const content = fs.readFileSync(fullPath, "utf-8");
      content.split("\n").forEach((line) => {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith("#")) return;
        const [k, ...v] = trimmed.split("=");
        if (k && v.length > 0 && !process.env[k.trim()]) {
          process.env[k.trim()] = v.join("=").trim().replace(/^["']|["']$/g, "");
        }
      });
    }
  }
}

loadEnv();

const MONGODB_URI = process.env.MONGODB_URI || "mongodb://127.0.0.1:27017/gdg-event";
const ADMIN_EMAIL = (process.env.SEED_ADMIN_EMAIL || "admin@gdg.community").toLowerCase();
const ADMIN_PASSWORD = process.env.SEED_ADMIN_PASSWORD || "Admin123456!";
const ADMIN_NAME = "GDG Lead Organizer";

// AdminUser Schema
const AdminUserSchema = new mongoose.Schema(
  {
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    passwordHash: { type: String, required: true },
    name: { type: String, required: true, trim: true },
    role: { type: String, default: "admin", enum: ["admin"] },
    isActive: { type: Boolean, default: true },
    lastLogin: { type: Date },
    loginAttempts: { type: Number, default: 0 },
    lockUntil: { type: Date },
  },
  { timestamps: true }
);

const AdminUser =
  mongoose.models.AdminUser || mongoose.model("AdminUser", AdminUserSchema);

// EventSettings Schema
const EventSettingsSchema = new mongoose.Schema(
  {
    eventName: { type: String, default: "GDG DevFest 2024" },
    eventNameAr: { type: String, default: "ديف فيست مجتمع مطوري جوجل 2024" },
    description: { type: String, default: "Annual premier developer conference by Google Developer Groups" },
    descriptionAr: { type: String, default: "المؤتمر السنوي الأكبر لمجتمعات مطوري جوجل لتطوير البرمجيات" },
    date: { type: Date, default: () => new Date(Date.now() + 14 * 24 * 60 * 60 * 1000) },
    venue: { type: String, default: "Grand Convention Center, Hall A" },
    venueAr: { type: String, default: "مركز المؤتمرات الدولي - القاعة الكبرى" },
    supportEmail: { type: String, default: "support@gdg.community" },
    timezone: { type: String, default: "Africa/Cairo" },
    language: { type: String, default: "both" },
  },
  { timestamps: true }
);

const EventSettings =
  mongoose.models.EventSettings || mongoose.model("EventSettings", EventSettingsSchema);

async function seed() {
  console.log("⚡ Starting database seeding...");
  console.log(`📡 Connecting to MongoDB at: ${MONGODB_URI.split("@").pop()?.split("?")[0] || MONGODB_URI}`);

  try {
    await mongoose.connect(MONGODB_URI);
    console.log(" Connected to MongoDB successfully.");

    // Seed Admin User
    const existingAdmin = await AdminUser.findOne({ email: ADMIN_EMAIL });
    const passwordHash = await bcrypt.hash(ADMIN_PASSWORD, 10);

    if (existingAdmin) {
      existingAdmin.passwordHash = passwordHash;
      existingAdmin.name = ADMIN_NAME;
      existingAdmin.isActive = true;
      existingAdmin.loginAttempts = 0;
      existingAdmin.lockUntil = undefined;
      await existingAdmin.save();
      console.log(` Updated existing admin: ${ADMIN_EMAIL}`);
    } else {
      await AdminUser.create({
        email: ADMIN_EMAIL,
        passwordHash,
        name: ADMIN_NAME,
        role: "admin",
        isActive: true,
      });
      console.log(` Created new admin user: ${ADMIN_EMAIL}`);
    }

    // Seed Event Settings
    const existingSettings = await EventSettings.findOne();
    if (!existingSettings) {
      await EventSettings.create({});
      console.log(" Created default Event Settings.");
    } else {
      existingSettings.eventName = "GDG DevFest 2024";
      existingSettings.eventNameAr = "ديف فيست مجتمع مطوري جوجل 2024";
      await existingSettings.save();
      console.log(" Updated Event Settings to GDG DevFest 2024.");
    }

    console.log("\n=======================================================");
    console.log("🎉 Seeding Completed Successfully!");
    console.log("-------------------------------------------------------");
    console.log(`📧 Admin Email:    ${ADMIN_EMAIL}`);
    console.log(`🔑 Admin Password: ${ADMIN_PASSWORD}`);
    console.log(`🌐 Login URL:      http://localhost:3000/admin/login`);
    console.log("=======================================================\n");

    await mongoose.disconnect();
    process.exit(0);
  } catch (err) {
    console.error("❌ Seeding failed:", err);
    process.exit(1);
  }
}

seed();
