import * as Joi from 'joi';

export default {
    identify: {
        payload: Joi.object({
            email: Joi.any().optional(),
            phoneNumber: Joi.any().optional(),
        }),
    }
};
