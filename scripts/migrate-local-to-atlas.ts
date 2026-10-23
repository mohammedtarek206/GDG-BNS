import mongoose from "mongoose";

const LOCAL_URI = "mongodb://127.0.0.1:27017/gdg-event";
const ATLAS_URI = "mongodb+srv://mt7592546_db_user:vl9yjqSm1w2sZbmt@gdg.elslrdc.mongodb.net/gdg-event?retryWrites=true&w=majority";

async function main() {
  console.log("Connecting to Local MongoDB...");
  const localConn = await mongoose.createConnection(LOCAL_URI).asPromise();
  console.log("Connected to Local.");

  console.log("Connecting to Atlas MongoDB...");
  const atlasConn = await mongoose.createConnection(ATLAS_URI).asPromise();
  console.log("Connected to Atlas.");

  if (!localConn.db || !atlasConn.db) {
    throw new Error("Database connection not ready");
  }

  const collections = await localConn.db.listCollections().toArray();
  console.log(`Found ${collections.length} collections in local database:`);

  for (const collInfo of collections) {
    const collName = collInfo.name;
    if (collName.startsWith("system.")) continue;

    const localColl = localConn.db.collection(collName);
    const atlasColl = atlasConn.db.collection(collName);

    const docs = await localColl.find({}).toArray();
    console.log(`- Copying collection '${collName}' (${docs.length} documents)...`);

    if (docs.length > 0) {
      for (const doc of docs) {
        await atlasColl.replaceOne({ _id: doc._id }, doc, { upsert: true });
      }
    }
  }

  console.log("\n✅ All data successfully synced to MongoDB Atlas!");

  await localConn.close();
  await atlasConn.close();
}

main().catch((err) => {
  console.error("Migration error:", err);
  process.exit(1);
});
