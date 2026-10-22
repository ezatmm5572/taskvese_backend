import mongoose from "mongoose";


const taskSchema = new mongoose.Schema({
    title:{
        type: String,
        required: true,
        trim: true,
        min: 3,
        max: 150
    },
    description:{
        type: String,
        required: true,
        trim: true,
        min: 3,
        max: 2000
    },
    startDate:{
        type: Date,
        required: true
    },
    endDate:{
        type: Date,
        required: true
    },
    createdBy:{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'member',
        required: true
    },
    team:{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'team',
        required: false
    }
},{timestamps: true,
    strictQuery: true,
    toJSON: {virtuals: true},
    toObject: {virtuals: true}}
)


const taskModel = mongoose.models.task || mongoose.model('task', taskSchema)

export default taskModel