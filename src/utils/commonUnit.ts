import { ObjectId } from "mongodb";
import { v4 as uuidv4 } from "uuid";

export const toString = (str: any) => {
    const result = str + "";
    return result;
};

export const stringToObjectId = (id: string) => {
    return new ObjectId(id);
};

const generatedIds = new Set<string>();

export const generateUUID = () => {
    let id;
    do {
        id = uuidv4();
    } while (generatedIds.has(id));
    generatedIds.add(id);
    return id;
};
