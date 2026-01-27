import mongoose from "mongoose";

const drawSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: true,
      trim: true,
      maxlength: 200,
    },

    theme: {
      type: String,
      required: true,
      trim: true,
    },

    hashtags: [
      {
        type: String,
        trim: true,
        lowercase: true,
      },
    ],

    startDate: {
      type: Date,
      required: true,
    },

    endDate: {
      type: Date,
      required: true,
      validate: {
        validator: function (value) {
          return this.startDate < value;
        },
        message: "End date must be after start date",
      },
    },

    prizePool: {
      type: Number,
      required: true,
      min: 0,
    },

    status: {
      type: String,
      enum: ["upcoming", "active", "closed"],
      default: "upcoming",
    },
  },
  { timestamps: true }
);


// Indexes
drawSchema.index({ status: 1 });
drawSchema.index({ startDate: 1 });
drawSchema.index({ endDate: 1 });

export default mongoose.model("Draw", drawSchema);
