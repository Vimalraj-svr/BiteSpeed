import Hapi from "@hapi/hapi";
import validate from './validate';
import IRoute from "../helper/route";
import ContactController from "./controller";

export default class ContactRoutes implements IRoute {
    public controller: any;

    constructor() {
        this.controller = new ContactController();
    }

    public async register(server: Hapi.Server): Promise<any> {
        return new Promise(resolve => {
            server.route([
                {
                    method: 'POST',
                    path: '/identify',
                    options: {
                        handler: this.controller.identify,
                        validate: validate.identify,
                        description: 'Method that identifies the repeated user.',
                        tags: ['api', 'user'],
                        auth: false,
                    }
                },
                {
                    method: 'GET',
                    path: '/',
                    options: {
                        handler: this.controller.liveCheck,
                        validate: validate.liveCheck,
                        description: 'Method that checks whether the service is live or not.',
                        tags: ['api', 'live'],
                        auth: false,
                    }
                },
            ]);
            resolve(true);
        });
    }
}
