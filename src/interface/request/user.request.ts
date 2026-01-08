export interface IUserCreateRequest {
    appwriteId: string;
    email: string;
    name: string;
    emailVerification: boolean;
    prefs: any;
}
