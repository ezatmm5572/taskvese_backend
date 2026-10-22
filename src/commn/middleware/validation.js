
export const validation = (schema) => {
    return (req, res, next) => {
        const errors = [];

        for (const key of Object.keys(schema)) {
            const { error } = schema[key].validate(req[key], {
                abortEarly: false,
            });

            if (error) {
                error.details.forEach((element) => {
                    errors.push({
                        key,
                        path: element.path.join("."),
                        message: element.message,
                    });
                });
            }
        }

        if (errors.length > 0) {
            return res.status(400).json({
                message: "Validation Error",
                errors,
            });
        }

        next();
    };
};
