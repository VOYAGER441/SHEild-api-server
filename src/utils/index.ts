// import { v4 as uuid } from "uuid";
import { ObjectId } from "mongodb";
import { v4 as uuidv4 } from "uuid";


export enum HttpStatusCodes {
  OK = 200,
  CREATED = 201,
  ACCEPTED = 202,
  NO_CONTENT = 204,
  MOVED_PERMANENTLY = 301,
  FOUND = 302,
  NOT_MODIFIED = 304,
  BAD_REQUEST = 400,
  UNAUTHORIZED = 401,
  FORBIDDEN = 403,
  NOT_FOUND = 404,
  METHOD_NOT_ALLOWED = 405,
  CONFLICT = 409,
  INTERNAL_SERVER_ERROR = 500,
  NOT_IMPLEMENTED = 501,
  BAD_GATEWAY = 502,
  SERVICE_UNAVAILABLE = 503,
  GATEWAY_TIMEOUT = 504,
}

const toString = (str: any) => {
  const result = str + "";
  return result;
};

const stringToObjectId = (id: string) => {
  return new ObjectId(id);
};

const generatedIds = new Set<string>();

const generateUUID = () => {
  let id;
  do {
    id = uuidv4();
  } while (generatedIds.has(id));
  generatedIds.add(id);
  return id;
};

export default {
  HttpStatusCodes,
  toString,
  stringToObjectId,
  generateUUID

};
