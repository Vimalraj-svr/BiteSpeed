import { createClient, SupabaseClient, PostgrestError } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import _ from 'lodash';
dotenv.config();

export default class Repository {
    private supabase: SupabaseClient;

    constructor() {
        const connectionString = process.env.SUPABASE_CONNECTION_STRING!;
        const apiKey = process.env.SUPABASE_API_KEY!;
        this.supabase = createClient(connectionString, apiKey);
    }

    private async getEmailOrPhoneResult(field: string, value: string): Promise<any> {
        try {
            const { data, error } = await this.supabase.from('contact').select().eq(field, value);
            return { data, error };
        } catch (error) {
            console.error(`Error checking ${field} presence in Database:`, error);
            return { error };
        }
    }

    private async insertData(email: string, phoneNumber: string, linkPrecedence: string, linkedId?: number): Promise<any> {
        try {
            const { data, error } = await this.supabase
                .from('contact')
                .insert([{ email, phoneNumber, linkPrecedence, linkedId }])
                .select();
            return { data, error };
        } catch (error) {
            console.error('Error inserting data into Supabase:', error);
            return { error };
        }
    }

    private async fetchDataByLinkedId(linkedId: number): Promise<any> {
        try {
            const { data, error } = await this.supabase.from('contact').select("*").eq('linkedId', linkedId);
            return { data, error };
        } catch (error) {
            console.error('Error fetching data by linkedId from Supabase:', error);
            return { error };
        }
    }

    public async checkConnection(): Promise<void> {
        try {
            const { data, error } = await this.supabase.from('contact').select('*');
            if (error) {
                const postgrestError = error as PostgrestError;
                console.error('Error checking connection to Supabase:', postgrestError.message);
            } else {
                console.log('Connected to Database.');
            }
        } catch (error) {
            console.error('Error checking connection to Supabase:', (error as Error).message);
        }
    }

    public async identify(payload: any, h: any): Promise<any> {
        try {
            const { email, phoneNumber } = payload;

            const emailResult = await this.getEmailOrPhoneResult('email', email);
            const phoneResult = await this.getEmailOrPhoneResult('phoneNumber', phoneNumber);

            if (emailResult.error || phoneResult.error) {
                console.error('Error checking email or phone number presence in Supabase:', emailResult.error || phoneResult.error);
                return { ...payload, success: false };
            }

            const emailPresent = emailResult.data && emailResult.data.length > 0;
            const phonePresent = phoneResult.data && phoneResult.data.length > 0;

            let primaryData: any;
            let secondaryData: any = [];

            if (emailPresent && phonePresent) {
                const datas = [...emailResult.data, ...phoneResult.data];
                const commonValues = _.intersectionBy(emailResult.data, phoneResult.data, 'id');
                const uniqueIds = _.uniq(_.map(datas, 'id'));
                if (commonValues && commonValues.length) {
                    if (uniqueIds.length === 1) {
                        return {
                            "contact": {
                                "primaryContactId": uniqueIds[0],
                                "emails": [emailResult.data[0].email],
                                "phoneNumbers": [phoneResult.data[0].phoneNumber],
                                "secondaryContactIds": []
                            }
                        };
                    } else {
                        _.uniqBy(datas, 'id').forEach((data: any) => {
                            data.linkPrecedence === 'primary' ? primaryData = data : secondaryData.push(data);
                        });

                        return {
                            "contact": {
                                "primaryContactId": primaryData.id,
                                "emails": _.uniq([primaryData.email, ..._.map(secondaryData, 'email')]),
                                "phoneNumbers": _.uniq([primaryData.phoneNumber, ..._.map(secondaryData, 'phoneNumber')]),
                                "secondaryContactIds": _.uniq(_.map(secondaryData, 'id'))
                            }
                        };
                    }
                }
                else {
                    const primaryEmailData: any = await this.supabase.from('contact').select().eq("email", email).eq("linkPrecedence", 'primary');
                    const primaryPhoneNumberData: any = await this.supabase.from('contact').select().eq("phoneNumber", phoneNumber).eq("linkPrecedence", 'primary');
                    let primaryData: any;
                    let secondaryData: any;
                    if (primaryEmailData.data.length === 0 && primaryPhoneNumberData.data.length === 0) {
                        return {
                            "success": false,
                            "message": "No primary records found."
                        };
                    } else if (primaryEmailData.data.length === 0) {
                        return {
                            "success": false,
                            "message": "No primary email data."
                        };
                    } else if (primaryPhoneNumberData.data.length === 0) {
                        return {
                            "success": false,
                            "message": "No primary phone number data."
                        };
                    } else {
                        if (new Date(primaryEmailData.data[0].createdAt) > new Date(primaryPhoneNumberData.data[0].createdAt)) {
                            const { data, error } = await this.updateData(primaryPhoneNumberData.data[0].id, primaryEmailData.data[0].id);
                            if (!error) {
                                primaryData = primaryPhoneNumberData.data[0];
                                secondaryData = await this.fetchDataByLinkedId(primaryPhoneNumberData.data[0].id);
                            }
                            else {
                                console.log("Error in 138:", error)
                                return {
                                    "success": false,
                                    "message": "Error While updating Primary Email data."
                                };
                            }
                        } else {
                            const { data, error } = await this.updateData(primaryEmailData.data[0].id, primaryPhoneNumberData.data[0].id);
                            if (!error) {
                                primaryData = primaryEmailData.data[0];
                                secondaryData = await this.fetchDataByLinkedId(primaryEmailData.data[0].id);
                            }
                            else {
                                console.log("Error in 151:", error)
                                return {
                                    "success": false,
                                    "message": "Error While updating Primary Phone Number data."
                                };
                            }
                        }
                        return {
                            "contact": {
                                "primaryContactId": primaryData.id,
                                "emails": _.uniq([
                                    primaryData.email,
                                    ..._.without(getAllSecondaryEmails(secondaryData.data, primaryData.id), primaryData.email)
                                ]),
                                "phoneNumbers": _.uniq([primaryData.phoneNumber, ..._.without(getAllSecondaryPhoneNumbers(secondaryData.data, primaryData.id))]),
                                "secondaryContactIds": _.uniq(getAllSecondaryIds(secondaryData.data, primaryData.id)),
                            }
                        };
                    }
                }

            } else if (emailPresent) {
                return await this.processEmailOnly(emailResult.data, email, phoneNumber, primaryData, secondaryData);
            } else if (phonePresent) {
                return await this.processPhoneOnly(phoneResult.data, email, phoneNumber, primaryData, secondaryData);
            } else {
                const { data, error } = await this.insertData(email, phoneNumber, 'primary');
                if (!error) {
                    return {
                        "contact": {
                            "primaryContatctId": data[0].id,
                            "emails": [data[0].email],
                            "phoneNumbers": [data[0].phoneNumber],
                            "secondaryContactIds": []
                        }
                    };
                } else {
                    console.log("Error in 188:", error)
                    return { message: "An error occurred while inserting data.", success: false };
                }
            }
        } catch (error) {
            console.error('Error processing /identify request:', error);
            return h.response({ error: 'Internal Server Error' }).code(500);
        }
    }

    private async updateData(linkedId: number, id: number): Promise<any> {
        const data = await this.supabase
            .from('contact')
            .update({ linkPrecedence: 'secondary', linkedId: linkedId })
            .eq('id', id)
            .select()

        return data;
    }

    private async processEmailOnly(emailData: any, email: string, phoneNumber: string, primaryData: any, secondaryData: any): Promise<any> {
        emailData.forEach((data: any) => {
            data.linkPrecedence === 'primary' ? primaryData = data : secondaryData.push(data);
        });

        if (email && phoneNumber) {
            const { data, error } = await this.insertData(email, phoneNumber, 'secondary', primaryData.id);

            if (!error) {
                secondaryData.push(data[0]);
                return {
                    "contact": {
                        "primaryContactId": primaryData.id,
                        "emails": _.uniq([
                            primaryData.email,
                            ..._.without(getAllSecondaryEmails(secondaryData, primaryData.id), primaryData.email)
                        ]),
                        "phoneNumbers": _.uniq([primaryData.phoneNumber, ...getAllSecondaryPhoneNumbers(secondaryData, primaryData.id)]),
                        "secondaryContactIds": _.uniq(getAllSecondaryIds(secondaryData, primaryData.id)),
                    }
                };
            } else {
                console.log("Error in 230:", error)
                return {
                    message: "An error occurred while inserting data.",
                    success: false
                };
            }
        } else {
            if (primaryData && primaryData.id) {
                const { data, error } = await this.fetchDataByLinkedId(primaryData.id);
                if (!error) {
                    secondaryData = data;
                    return {
                        "contact": {
                            "primaryContactId": primaryData.id,
                            "emails": _.uniq([
                                primaryData.email,
                                ..._.without(getAllSecondaryEmails(secondaryData, primaryData.id), primaryData.email)
                            ]),
                            "phoneNumbers": _.uniq([primaryData.phoneNumber, ...getAllSecondaryPhoneNumbers(secondaryData, primaryData.id)]),
                            "secondaryContactIds": _.uniq(getAllSecondaryIds(secondaryData, primaryData.id)),
                        }
                    };
                } else {
                    console.log("Error in 253:", error)
                    return {
                        message: "An error occurred while fetching data.",
                        success: false
                    };
                }
            }
            else {
                const secondaryEmail: any = await this.supabase.from('contact').select().eq("email", email);
                const primaryEmail: any = await this.supabase.from('contact').select().eq("id", secondaryEmail.data[0].linkedId);
                primaryData = primaryEmail.data[0];
                const secondaryDatas: any = await this.fetchDataByLinkedId(primaryData.id);
                if (!secondaryDatas.error && !secondaryEmail.error && !primaryEmail.error) {
                    secondaryData = secondaryDatas.data;
                    return {
                        "contact": {
                            "primaryContactId": primaryData.id,
                            "emails": _.uniq([
                                primaryData.email,
                                ..._.without(getAllSecondaryEmails(secondaryData, primaryData.id), primaryData.email)
                            ]),
                            "phoneNumbers": _.uniq([primaryData.phoneNumber, ...getAllSecondaryPhoneNumbers(secondaryData, primaryData.id)]),
                            "secondaryContactIds": _.uniq(getAllSecondaryIds(secondaryData, primaryData.id)),
                        }
                    };
                } else {
                    return {
                        message: "An error occurred while fetching data.",
                        success: false
                    };
                }
            }

        }
    }

    private async processPhoneOnly(phoneData: any, email: string, phoneNumber: string, primaryData: any, secondaryData: any): Promise<any> {
        phoneData.forEach((data: any) => {
            data.linkPrecedence === 'primary' ? primaryData = data : secondaryData.push(data);
        });

        if (email && phoneNumber) {
            const { data, error } = await this.insertData(email, phoneNumber, 'secondary', primaryData.id);

            if (!error) {
                secondaryData.push(data[0]);
                return {
                    "contact": {
                        "primaryContactId": primaryData.id,
                        "emails": _.uniq([
                            primaryData.email,
                            ...getAllSecondaryEmails(secondaryData, primaryData.id), primaryData.email
                        ]),
                        "phoneNumbers": _.uniq([primaryData.phoneNumber, ..._.without(getAllSecondaryPhoneNumbers(secondaryData, primaryData.id))]),
                        "secondaryContactIds": _.uniq(getAllSecondaryIds(secondaryData, primaryData.id)),
                    }
                };
            } else {
                console.log("Error in 311:", error)
                return {
                    message: "An error occurred while inserting data.",
                    success: false
                };
            }
        } else {
            if (primaryData && primaryData.id) {
                const { data, error } = await this.fetchDataByLinkedId(primaryData.id);
                if (!error) {
                    secondaryData = data;
                    return {
                        "contact": {
                            "primaryContactId": primaryData.id,
                            "emails": _.uniq([
                                primaryData.email,
                                ..._.without(getAllSecondaryEmails(secondaryData, primaryData.id), primaryData.email)
                            ]),
                            "phoneNumbers": _.uniq([primaryData.phoneNumber, ..._.without(getAllSecondaryPhoneNumbers(secondaryData, primaryData.id))]),
                            "secondaryContactIds": _.uniq(getAllSecondaryIds(secondaryData, primaryData.id)),
                        }
                    };
                } else {
                    console.log("Error in 334:", error)
                    return {
                        message: "An error occurred while fetching data.",
                        success: false
                    };
                }
            }
            else {
                const secondaryPhoneNumber: any = await this.supabase.from('contact').select().eq("phoneNumber", phoneNumber);
                const primaryPhoneNumber: any = await this.supabase.from('contact').select().eq("id", secondaryPhoneNumber.data[0].linkedId);
                primaryData = primaryPhoneNumber.data[0];
                const secondaryDatas: any = await this.fetchDataByLinkedId(primaryData.id);
                if (!secondaryDatas.error && !secondaryPhoneNumber.error && !secondaryPhoneNumber.error) {
                    secondaryData = secondaryDatas.data;
                    return {
                        "contact": {
                            "primaryContactId": primaryData.id,
                            "emails": _.uniq([
                                primaryData.email,
                                ..._.without(getAllSecondaryEmails(secondaryData, primaryData.id), primaryData.email)
                            ]),
                            "phoneNumbers": _.uniq([primaryData.phoneNumber, ..._.without(getAllSecondaryPhoneNumbers(secondaryData, primaryData.id))]),
                            "secondaryContactIds": _.uniq(getAllSecondaryIds(secondaryData, primaryData.id)),
                        }
                    };
                } else {
                    return {
                        message: "An error occurred while fetching data.",
                        success: false
                    };
                }
            }
        }
    }
}

function getAllSecondaryEmails(secondaryData: any, primaryId: number) {
    return secondaryData.filter((data: any) => data.email && data.linkedId === primaryId).map((data: any) => data.email);
}

function getAllSecondaryPhoneNumbers(secondaryData: any, primaryId: number) {
    return secondaryData.filter((data: any) => data.phoneNumber && data.linkedId === primaryId).map((data: any) => data.phoneNumber);
}

function getAllSecondaryIds(secondaryData: any, primaryId: number) {
    return secondaryData.filter((data: any) => data.email && data.linkedId === primaryId).map((data: any) => data.id);
}
