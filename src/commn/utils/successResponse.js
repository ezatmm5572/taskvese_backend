export const successResponse = ({
    res,
    status = 200,
    message = "done",
    data=undefined
}) => {
    res.status(status).json({message,data})
}