import mongoose from "mongoose";
import { DBURI } from "../../config/config.env.js";

export const connectDB = async () => {
    if (mongoose.connection.readyState >= 1) {
        return;
    }
    if (!DBURI) {
        console.warn("DB_URI environment variable is missing.");
        return;
    }
    try {
        await mongoose.connect(`${DBURI}`, { serverSelectionTimeoutMS: 5000, connectTimeoutMS: 5000 });
        console.log("Database connected");
    } catch (error) {
        console.error("Database connection error:", error.message || error);
        throw error; // lets getApp() retry on the next request instead of caching a broken state
    }
};