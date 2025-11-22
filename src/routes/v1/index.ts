import express from "express";
import ChatRouter from "./chat.route";



const router= express.Router();

// TODO: add middleware to all routes

// system routes
// ###############################################


// public routes
// ###############################################
router.use("/chat",ChatRouter)

// private routes
// ###############################################



// user routes
// ###############################################


export default router;