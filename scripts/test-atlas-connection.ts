import mongoose from "mongoose";

const uri = "mongodb+srv://mt7592546_db_user:vl9yjqSm1w2sZbmt@gdg.elslrdc.mongodb.net/gdg-event?retryWrites=true&w=majority";

async function main() {
  console.log("Testing connection to MongoDB Atlas...");
  try {
    await mongoose.connect(uri, { serverSelectionTimeoutMS: 10000 });
    console.log("✅ Successfully connected to MongoDB Atlas!");
    console.log("Database:", mongoose.connection.name);
    console.log("Host:", mongoose.connection.host);
    await mongoose.disconnect();
    console.log("Disconnected cleanly.");
  } catch (err: any) {
    console.error("❌ Failed to connect to MongoDB Atlas:", err.message);
    process.exit(1);
  }
}

main();
