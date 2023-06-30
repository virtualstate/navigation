import { DynamicNavigation } from "../../dynamic";

const navigation = new DynamicNavigation({
    baseURL: import.meta.url
});

await navigation.navigate("./test").finished;
await navigation.navigate("./another").finished;