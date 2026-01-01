class AuthService {
    async jwtVerify() {
        // check the JWT validity with Appwrite
        // check if user is registered in our system if not then create user
        // return user info if valid
    }
    
    async logout() {
        // TODO: implement logout logic
    }
}

export default new AuthService();