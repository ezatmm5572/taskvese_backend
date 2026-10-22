import { successResponse } from "../../commn/utils/successResponse.js";
import * as DB_services from "../../DB/DB.service.js"
import memberModel from "../../DB/models/member.js";
import teamModel from "../../DB/models/team.js";
import taskModel from "../../DB/models/task.js";
import { isTeamManager } from "../../commn/utils/permissions.js";


export const createTeam = async(req,res,next)=>{
    const {name} = req.body

    const team = await DB_services.createDocument({
        model:teamModel,
        doc:{
            name,
            addedBy:req.member._id,
            teamAdims:[req.member._id],
            teamMembers:[req.member._id]
        }
    })

    await DB_services.updateDocument({
        model:memberModel,
        filter:{_id:req.member._id},
        update:{$push:{teams:{teamId:team._id,role:"teamAdmin"}}}
    })
    
    successResponse({
        res,
        status:201,
        message:"Team created successfully",
        data: team
    })
}

export const getAllTeams = async(req,res,next)=>{
    const filter = req.member.role === 'admin'
        ? {}
        : { $or: [{ teamMembers: req.member._id }, { addedBy: req.member._id }, { teamAdims: req.member._id }] }
    const teams = await teamModel.find(filter)
        .populate("teamMembers", "fname lname email")
        .populate("addedBy", "fname lname email")
        .sort({ createdAt: -1 })
    successResponse({
        res,
        status:200,
        message:"All teams",
        data: teams || []
    })
}

export const addMemberToTeam = async(req,res,next)=>{
    const {teamId,memberId,member_email,role} = req.body
    
    const team = await DB_services.findOne({model:teamModel,filter:{_id:teamId}})
    if(!team){
        throw new Error("Team not found")
    }
    const filter = memberId ? { _id: memberId } : { email: member_email }
    const member = await DB_services.findOne({model:memberModel,filter})
    if(!member){
        throw new Error("Member not found")
    }
    const isMember = await DB_services.findOne({model:teamModel,filter:{_id:teamId,teamMembers:member._id}})
    if(isMember){
        throw new Error("Member already in team")
    }
    const isTeamAdmin = isTeamManager(team, req.member);
    if(!isTeamAdmin){
        throw new Error("You are not the team admin")
    }
    const asAdmin = role === "admin"
    await DB_services.updateDocument({
        model:teamModel,
        filter:{_id:teamId},
        update:{$addToSet: asAdmin ? {teamMembers:member._id, teamAdims:member._id} : {teamMembers:member._id}}
    })
    await DB_services.updateDocument({
        model:memberModel,
        filter:{_id:member._id},
        update:{$push:{teams:{teamId:team._id,role: asAdmin ? "teamAdmin" : "teamMember"}}}
    })
    successResponse({
        res,
        status:200,
        message:"Member added to team successfully"
    })
}

export const removeMemberFromTeam = async(req,res,next)=>{
    const {teamId,memberId} = req.body
    const team = await DB_services.findOne({model:teamModel,filter:{_id:teamId}})
    if(!team){
        throw new Error("Team not found")
    }
    const member = await DB_services.findOne({model:memberModel,filter:{_id:memberId}})
    if(!member){
        throw new Error("Member not found")
    }
    const isMember = await DB_services.findOne({model:teamModel,filter:{_id:teamId,teamMembers:memberId}})
    if(!isMember){
        throw new Error("Member not found in team")
    }
    const isTeamAdmin = isTeamManager(team, req.member)
    if(!isTeamAdmin){
        throw new Error("You are not the team admin")
    }
    const updateTeam = await DB_services.updateDocument({model:teamModel,filter:{_id:teamId},update:{$pull:{teamMembers:memberId}}})
    await DB_services.updateDocument({
        model:memberModel,
        filter:{_id:memberId},
        update:{$pull:{teams:{teamId:teamId}}}
    })
    successResponse({
        res,
        status:200,
        message:"Member removed from team successfully"
    })
}

export const updateMemberRoleInTeam = async(req,res,next)=>{
    const {teamId,memberId,role} = req.body

    const team = await DB_services.findOne({model:teamModel,filter:{_id:teamId}})
    if(!team){
        throw new Error("Team not found")
    }
    const member = await DB_services.findOne({model:memberModel,filter:{_id:memberId}})
    if(!member){
        throw new Error("Member not found")
    }
    const isMember = await DB_services.findOne({model:teamModel,filter:{_id:teamId,teamMembers:memberId}})
    if(!isMember){
        throw new Error("Member not found in team")
    }
    const isTeamAdmin = isTeamManager(team, req.member)
    if(!isTeamAdmin){
        throw new Error("You are not the team admin")
    }
    if(role==="admin"){
        const updateTeam = await DB_services.updateDocument({model:teamModel,filter:{_id:teamId},update:{$addToSet:{teamAdims:memberId}}})
        await DB_services.updateDocument({
            model:memberModel,
            filter:{_id:memberId},
            update:{$pull:{teams:{teamId:teamId,role:"teamMember"}}}
        })
        await DB_services.updateDocument({
            model:memberModel,
            filter:{_id:memberId},
            update:{$push:{teams:{teamId:teamId,role:role}}}
        })
    }else{
        const updateTeam = await DB_services.updateDocument({model:teamModel,filter:{_id:teamId},update:{$pull:{teamAdims:memberId}}})
        await DB_services.updateDocument({
            model:memberModel,
            filter:{_id:memberId},
            update:{$pull:{teams:{teamId:teamId,role:"teamAdmin"}}}
        })
        await DB_services.updateDocument({
            model:memberModel,
            filter:{_id:memberId},
            update:{$push:{teams:{teamId:teamId,role:role}}}
        })
    }
    successResponse({
        res,
        status:200,
        message:"Member role updated successfully"
    })
}

export const updateTeamName = async(req,res,next)=>{
    const {teamId,name} = req.body
    const team = await DB_services.findOne({model:teamModel,filter:{_id:teamId}})
    if(!team){
        throw new Error("Team not found")
    }
    const isTeamAdmin = isTeamManager(team, req.member)
    if(!isTeamAdmin){
        throw new Error("You are not the team admin")
    }
    const updateTeam = await DB_services.updateDocument({model:teamModel,filter:{_id:teamId},update:{$set:{name}}})
    successResponse({
        res,
        status:200,
        message:"Team name updated successfully"
    })
}


export const deleteTeam = async(req,res,next)=>{
    const {teamId} = req.body
    const team = await DB_services.findOne({model:teamModel,filter:{_id:teamId}})
    if(!team){
        throw new Error("Team not found")
    }
    if(!isTeamManager(team, req.member)){
        throw new Error("You are not the team admin")
    }
    await DB_services.deleteDocument({model:teamModel,filter:{_id:teamId}})
    // clean up references so nothing points at a deleted team
    await memberModel.updateMany({"teams.teamId":teamId},{$pull:{teams:{teamId}}})
    await taskModel.updateMany({team:teamId},{$set:{team:null}})
    successResponse({
        res,
        status:200,
        message:"Team deleted successfully"
    })
}
