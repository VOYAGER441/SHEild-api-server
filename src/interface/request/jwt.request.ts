export interface IJwtRequest {
    userId: string;
    email: string;
    role: string;
}

export interface IJwtUserPayload {
    id: string;
    email: string;
    name: string;
    avatarUrl?: string;
    role?: string;
}

export interface IJwtResponse {
    accessToken: string;
    refreshToken: string;
    user?: IJwtUserPayload;
}
