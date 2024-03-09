import Repository from "./repository";

export default class ContactResolver {
    public repository: any;

    constructor() {
        this.repository = new Repository();
        this.repository.checkConnection();
    }

    public async identify(request: any, h: any): Promise<any> {
        return await this.repository.identify(request, h);
    }

    public async liveCheck(h: any): Promise<any> {
        return await this.repository.liveCheck(h);
    }
}
