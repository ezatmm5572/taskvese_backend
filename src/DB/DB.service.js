import mongoose from "mongoose";


export const findById = ({
    model,
    id,
    populate = null,
    select = null,
    option = null,
}) => {
    return model
        .findById(id, null, option)
        .populate(populate)
        .select(select);
};


export const findOne = ({
    model,
    filter,
    populate = null,
    select = null,
    option = null,
}) => {
    return model
        .findOne(filter, null, option)
        .populate(populate)
        .select(select);
};


export const find = ({
    model,
    filter,
    populate = null,
    select = null,
    option = null,
}) => {
    return model
        .find(filter, null, option)
        .populate(populate)
        .select(select);
};


export const createDocument = ({ model, doc }) => {
    return model.create(doc);
};


export const updateDocument = ({ model, filter, update, option = null }) => {
    return model.findOneAndUpdate(filter, update, option);
};


export const deleteDocument = ({ model, filter, option = null }) => {
    return model.findOneAndDelete(filter, option);
};


export const deleteMany = ({ model, filter, option = null }) => {
    return model.deleteMany(filter, option)
};