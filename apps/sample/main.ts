import { createMiniCmsClient } from "./mini.client";
import config from "./mini.config.json"

const client = createMiniCmsClient(config)
console.log(config)

const col =await  client.getCollectionItems("partners")

console.log(col)

