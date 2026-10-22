import mongoose from "mongoose";
import { TaskStatusEnum } from "../../commn/enums/task.enums.js";

const taskAssignmentSchema = new mongoose.Schema(
  {
    task: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "task",
      required: true,
    },

    member: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "member",
      required: true,
    },

    assignedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "member",
      required: true,
    },

    status: {
      type: String,
      enum: Object.values(TaskStatusEnum),
      default: TaskStatusEnum.IN_PROGRESS,
    },

    assignedAt: {
      type: Date,
      default: Date.now,
    },

    completedAt: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true,
    strictQuery: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

taskAssignmentSchema.index(
  { task: 1, member: 1 },
  { unique: true }
);

const taskAssignmentModel =
  mongoose.models.taskAssignment ||
  mongoose.model("taskAssignment", taskAssignmentSchema);

export default taskAssignmentModel;