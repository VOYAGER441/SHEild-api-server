import express from "express";
import dotenv from "dotenv";
import cors from "cors";
import bodyParser from "body-parser";
import env from "./environment";


dotenv.config();

const app=express();
app.use(cors());
app.use(bodyParser.json());



app.listen(env.PORT,()=>{
     console.log(`Server is running on port ${env.PORT}`);
})
