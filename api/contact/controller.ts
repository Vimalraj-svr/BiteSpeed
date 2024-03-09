import Hapi from "@hapi/hapi";
import ContactResolver from "./resolver";

export default class ContactController {
    public contactResolver: any;

    constructor() {
        this.contactResolver = new ContactResolver();
    }

    public identify = async (request: Hapi.Request, h: Hapi.ResponseToolkit): Promise<any> => {
        try {
            const payload = request.payload;
            const entities: any = await this.contactResolver.identify(payload, h);
            return h.response(entities).code(200);
        } catch (error) {
            console.error(error);
            return h.response({ error: "Internal Server Error" }).code(500);
        }
    };

    public liveCheck = async (request: Hapi.Request, h: Hapi.ResponseToolkit): Promise<any> => {
        try {
            const entities: any = await this.contactResolver.liveCheck(h);
            return h.response(entities).code(200);
        } catch (error) {
            console.error(error);
            return h.response({ error: "Internal Server Error" }).code(500);
        }
    };
}
