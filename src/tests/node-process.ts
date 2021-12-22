/* c8 ignore start */
import defaultProcess from "./default-process";

export default typeof process === "undefined" ? defaultProcess : process;