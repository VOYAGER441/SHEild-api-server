import env from "@/environment";
import utils from "@/utils";
import { Log } from "@/utils/logger";
import mongoose from "mongoose";


// console.log(MONGODB_URI);

/* "mongodb+srv://mainak407:BlogDb%40345@cluster0.vxmxn.mongodb.net/Blog" */
export default class DATABASE {
  connection: mongoose.Connection | undefined;

  constructor() { }

  async init() {
    if (mongoose.connection.readyState != 1) {
      if (env.NODE_ENV == utils.appConstant.NODE_ENVS.DEV)
        Log.info("😎 connecting to the DATABASE... 🤘");
      if (!env.MONGODB_URI) {
        throw new Error("MONGODB_URI is not configured");
      }
      await mongoose.connect(env.MONGODB_URI).catch((err) => {
        Log.error("MongoDB connection error:", err);
        throw err;
      });
    }
    this.connection = mongoose.connection;
  }

  getConnection() {
    return this.connection;
  }
  close() {
    this.connection?.close();
  }
}
