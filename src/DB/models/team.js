import mongoose from "mongoose";

const teamSchema = new mongoose.Schema(
    {
        name: {
            type: String,
            required: true,
            trim: true,
            minlength: 2,
            maxlength: 50,
        },
        teamAdims: [
            {
                type: mongoose.Schema.Types.ObjectId,
                ref: "member",
            },
        ],
        teamMembers: [
            {
                type: mongoose.Schema.Types.ObjectId,
                ref: "member",
            },
        ],
        addedBy: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "member",
            required: true,
        },
        deletedAt: {
            type: Date,
            default: null,
            index: true,
        },
    },
    {
        timestamps: true,
        strictQuery: true,
        toJSON: { virtuals: true },
        toObject: { virtuals: true },
    }
);

// Virtual field to return teamAdmins mirroring teamAdims
teamSchema.virtual("teamAdmins").get(function () {
    return this.teamAdims;
});

const teamModel = mongoose.models.team || mongoose.model("team", teamSchema);

export default teamModel;
