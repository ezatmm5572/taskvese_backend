import mongoose from "mongoose";
import { GenderEnum, ProviderEnum, RoleEnum } from "../../commn/enums/member.enums.js";


const memberSchema = new mongoose.Schema({
    fname: {
        type: String,
        required: true,
        trim: true,
        minLength: 2,
        maxLength: 50
    },
    lname: {
        type: String,
        required: true,
        trim: true,
        minLength: 2,
        maxLength: 50
    },
    gender: {
        type: String,
        required: true,
        enum: Object.values(GenderEnum),
        default:GenderEnum.MALE
    },
    email: {
        type: String,
        required: true,
        unique: true,
        lowercase: true,
        trim: true,
        match: /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    },
    password: {
        type: String,
        required: function(){
            return this.provider == ProviderEnum.GOOGLE ? false : true
        },
        minLength: 8
    },
    provider: {
        type: String,
        enum: Object.values(ProviderEnum),
        default:ProviderEnum.SYSTEM
    },
    confirmed: {
        type: Boolean,
        default: false
    },
    profilePicture: {
        type: String,
        default: 'default.png'
    },
    role: {
        type: String,
        enum: Object.values(RoleEnum),
        default: RoleEnum.ADMIN
    },
    teams:[
    {
        teamId:{
            type: mongoose.Schema.Types.ObjectId,
            ref: 'team'
        },
        role:{
            type: String,
            enum: ['teamAdmin', 'teamMember'],
            default: 'teamMember'
        }
    }
],
    addedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'member',
        default: null
    },
    changeCredentials:{ 
        type:Date
    }
}, {
    timestamps: true,
    strictQuery: true,
    toJSON: {virtuals: true},
    toObject: {virtuals: true}
})

memberSchema.virtual("fullName")
    .get(function () {
    return this.fname+" "+this.lname
    })
    .set(function (v) {
    const [ fname, lname ] = v.split(" ")
    this.set({fname,lname})    
})

const memberModel =mongoose.models.member|| mongoose.model('member', memberSchema)

export default memberModel