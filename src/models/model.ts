

import mongoose, { Model, Schema } from "mongoose";
import DATABASE from "@/database/database";

export default class MODEL {
  protected db: DATABASE | undefined;
  protected connection: mongoose.Connection | undefined;
  protected collectionName: string | undefined;
  protected dbModel: Model<any, {}, {}> ;

  constructor(collectionName:string,schema:Schema) {
    this.db=new DATABASE();
    this.collectionName=collectionName;
    this.dbModel=mongoose.model(collectionName,schema);
  }

  // init()
  async init(){
    await this.db?.init();
    this.connection=this.db?.getConnection();
  }
  // get dbModel
  getDBModel(){
    return this.dbModel;
  }
  // find one
  async findOne(query:any,projection?:any){
    if(!projection)projection={};
    return await this.dbModel?.findOne(query,projection);
  }
  // find 
  async find(query:any,projection?:any){
    if(!projection)projection={};
    return await this.dbModel?.findOne(query,projection);
  }
  // create
  async create(data:any){
    let document=new this.dbModel(data);
    return await document.save(document);
  }
  // update
  async update(_id:string,data:any){
    return await this.dbModel.updateOne({_id},data);
  }
  // update query
  async updateQuery(query:any,data:any){
    return await this.dbModel.updateOne(query,data);
  }
  // hard delete
  async delete(_id:string){
    return await this.dbModel.deleteOne({_id});
  }
  // count
  async count(query:any):Promise<number>{
    return await this.dbModel.countDocuments(query);
  }
  close(){
    this.db?.close();
  }
}