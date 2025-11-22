import mongoose from "mongoose";

const connectDB = async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log("Database connection established successfully");
  } catch (error) {
    console.error("Database connection failure:", error);
    process.exit(1);
  }
};

export default connectDB;
