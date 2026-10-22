import mongoose from "mongoose";

const teamSchema = new mongoose.Schema({
    name: {
        type: String,
        required: true,
        trim: true,
        min: 2,
        max: 50
    },
    teamAdims:[{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'member'
    }],
    teamMembers: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'member'
    }],
    addedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'member',
        required: true
    }
},{
    timestamps: true,
    strictQuery: true,
    toJSON: {virtuals: true},
    toObject: {virtuals: true}
})

const teamModel = mongoose.models.team || mongoose.model('team', teamSchema)

export default teamModel

