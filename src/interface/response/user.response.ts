export interface IUserResponse {
    id: string;
    userName: string
    email: string
    avatarUrl: string
    role: string
    isActive: boolean
    isDeleted: boolean
    createdAt: Date
    updatedAt: Date
}
