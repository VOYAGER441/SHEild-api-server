export interface IJwtRequest {
    userId: string;
    email: string;
    role: string;
}

export interface IJwtResponse {
    accessToken: string;
    refreshToken: string;
}