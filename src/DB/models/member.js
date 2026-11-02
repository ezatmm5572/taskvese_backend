import mongoose from "mongoose";
import { GenderEnum, ProviderEnum, RoleEnum } from "../../commn/enums/member.enums.js";

const memberSchema = new mongoose.Schema(
    {
        fname: {
            type: String,
            required: true,
            trim: true,
            minLength: 2,
            maxLength: 50,
        },
        lname: {
            type: String,
            required: true,
            trim: true,
            minLength: 2,
            maxLength: 50,
        },
        gender: {
            type: String,
            required: true,
            enum: Object.values(GenderEnum),
            default: GenderEnum.MALE,
        },
        email: {
            type: String,
            required: true,
            unique: true,
            lowercase: true,
            trim: true,
            match: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
        },
        password: {
            type: String,
            required: function () {
                return this.provider == ProviderEnum.GOOGLE ? false : true;
            },
            minLength: 8,
        },
        provider: {
            type: String,
            enum: Object.values(ProviderEnum),
            default: ProviderEnum.SYSTEM,
        },
        confirmed: {
            type: Boolean,
            default: false,
        },
        active: {
            type: Boolean,
            default: true,
            index: true,
        },
        profilePicture: {
            type: String,
            default: "default.png",
        },
        role: {
            type: String,
            enum: Object.values(RoleEnum),
            default: RoleEnum.ADMIN,
        },
        timezone: {
            type: String,
            default: "UTC",
        },
        preferences: {
            emailAssigned: { type: Boolean, default: true },
            emailMention: { type: Boolean, default: true },
            emailDue: { type: Boolean, default: true },
            emailDigest: { type: Boolean, default: true },
            push: { type: mongoose.Schema.Types.Mixed, default: {} },
            quietHours: { type: mongoose.Schema.Types.Mixed, default: {} },
        },
        pushSubscriptions: [
            {
                endpoint: { type: String, required: true },
                keys: {
                    p256dh: { type: String },
                    auth: { type: String },
                },
            },
        ],
        teams: [
            {
                teamId: {
                    type: mongoose.Schema.Types.ObjectId,
                    ref: "team",
                },
                role: {
                    type: String,
                    enum: [
                        "admin",
                        "editor",
                        "viewer",
                        "teamAdmin",
                        "teamMember",
                        "teamViewer",
                    ],
                    default: "editor",
                },
            },
        ],
        addedBy: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "member",
            default: null,
        },
        changeCredentials: {
            type: Date,
        },
    },
    {
        timestamps: true,
        strictQuery: true,
        toJSON: {
            virtuals: true,
            transform: (doc, ret) => {
                delete ret.password;
                return ret;
            },
        },
        toObject: {
            virtuals: true,
            transform: (doc, ret) => {
                delete ret.password;
                return ret;
            },
        },
    }
);

memberSchema
    .virtual("fullName")
    .get(function () {
        return this.fname + " " + this.lname;
    })
    .set(function (v) {
        const [fname, lname] = v.split(" ");
        this.set({ fname, lname });
    });

const memberModel =
    mongoose.models.member || mongoose.model("member", memberSchema);

export default memberModel;