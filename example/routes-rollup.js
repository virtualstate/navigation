// src/path-to-regex-modified.ts
var Part = class {
  constructor(type, name, prefix, value, suffix, modifier) {
    this.type = 3 /* kFixed */;
    this.name = "";
    this.prefix = "";
    this.value = "";
    this.suffix = "";
    this.modifier = 3 /* kNone */;
    this.type = type;
    this.name = name;
    this.prefix = prefix;
    this.value = value;
    this.suffix = suffix;
    this.modifier = modifier;
  }
  hasCustomName() {
    return this.name !== "" && typeof this.name !== "number";
  }
};
var regexIdentifierStart = /[$_\p{ID_Start}]/u;
var regexIdentifierPart = /[$_\u200C\u200D\p{ID_Continue}]/u;
var kFullWildcardRegex = ".*";
function isASCII(str, extended) {
  return (extended ? /^[\x00-\xFF]*$/ : /^[\x00-\x7F]*$/).test(str);
}
function lexer(str, lenient = false) {
  const tokens = [];
  let i = 0;
  while (i < str.length) {
    const char = str[i];
    const ErrorOrInvalid = function(msg) {
      if (!lenient)
        throw new TypeError(msg);
      tokens.push({ type: "INVALID_CHAR", index: i, value: str[i++] });
    };
    if (char === "*") {
      tokens.push({ type: "ASTERISK", index: i, value: str[i++] });
      continue;
    }
    if (char === "+" || char === "?") {
      tokens.push({ type: "OTHER_MODIFIER", index: i, value: str[i++] });
      continue;
    }
    if (char === "\\") {
      tokens.push({ type: "ESCAPED_CHAR", index: i++, value: str[i++] });
      continue;
    }
    if (char === "{") {
      tokens.push({ type: "OPEN", index: i, value: str[i++] });
      continue;
    }
    if (char === "}") {
      tokens.push({ type: "CLOSE", index: i, value: str[i++] });
      continue;
    }
    if (char === ":") {
      let name = "";
      let j = i + 1;
      while (j < str.length) {
        const code = str.substr(j, 1);
        if (j === i + 1 && regexIdentifierStart.test(code) || j !== i + 1 && regexIdentifierPart.test(code)) {
          name += str[j++];
          continue;
        }
        break;
      }
      if (!name) {
        ErrorOrInvalid(`Missing parameter name at ${i}`);
        continue;
      }
      tokens.push({ type: "NAME", index: i, value: name });
      i = j;
      continue;
    }
    if (char === "(") {
      let count = 1;
      let pattern = "";
      let j = i + 1;
      let error = false;
      if (str[j] === "?") {
        ErrorOrInvalid(`Pattern cannot start with "?" at ${j}`);
        continue;
      }
      while (j < str.length) {
        if (!isASCII(str[j], false)) {
          ErrorOrInvalid(`Invalid character '${str[j]}' at ${j}.`);
          error = true;
          break;
        }
        if (str[j] === "\\") {
          pattern += str[j++] + str[j++];
          continue;
        }
        if (str[j] === ")") {
          count--;
          if (count === 0) {
            j++;
            break;
          }
        } else if (str[j] === "(") {
          count++;
          if (str[j + 1] !== "?") {
            ErrorOrInvalid(`Capturing groups are not allowed at ${j}`);
            error = true;
            break;
          }
        }
        pattern += str[j++];
      }
      if (error) {
        continue;
      }
      if (count) {
        ErrorOrInvalid(`Unbalanced pattern at ${i}`);
        continue;
      }
      if (!pattern) {
        ErrorOrInvalid(`Missing pattern at ${i}`);
        continue;
      }
      tokens.push({ type: "REGEX", index: i, value: pattern });
      i = j;
      continue;
    }
    tokens.push({ type: "CHAR", index: i, value: str[i++] });
  }
  tokens.push({ type: "END", index: i, value: "" });
  return tokens;
}
function parse(str, options = {}) {
  const tokens = lexer(str);
  options.delimiter ?? (options.delimiter = "/#?");
  options.prefixes ?? (options.prefixes = "./");
  const segmentWildcardRegex = `[^${escapeString(options.delimiter)}]+?`;
  const result = [];
  let key = 0;
  let i = 0;
  let nameSet = /* @__PURE__ */ new Set();
  const tryConsume = (type) => {
    if (i < tokens.length && tokens[i].type === type)
      return tokens[i++].value;
  };
  const tryConsumeModifier = () => {
    return tryConsume("OTHER_MODIFIER") ?? tryConsume("ASTERISK");
  };
  const mustConsume = (type) => {
    const value = tryConsume(type);
    if (value !== void 0)
      return value;
    const { type: nextType, index } = tokens[i];
    throw new TypeError(`Unexpected ${nextType} at ${index}, expected ${type}`);
  };
  const consumeText = () => {
    let result2 = "";
    let value;
    while (value = tryConsume("CHAR") ?? tryConsume("ESCAPED_CHAR")) {
      result2 += value;
    }
    return result2;
  };
  const DefaultEncodePart = (value) => {
    return value;
  };
  const encodePart = options.encodePart || DefaultEncodePart;
  let pendingFixedValue = "";
  const appendToPendingFixedValue = (value) => {
    pendingFixedValue += value;
  };
  const maybeAddPartFromPendingFixedValue = () => {
    if (!pendingFixedValue.length) {
      return;
    }
    result.push(new Part(3 /* kFixed */, "", "", encodePart(pendingFixedValue), "", 3 /* kNone */));
    pendingFixedValue = "";
  };
  const addPart = (prefix, nameToken, regexOrWildcardToken, suffix, modifierToken) => {
    let modifier = 3 /* kNone */;
    switch (modifierToken) {
      case "?":
        modifier = 1 /* kOptional */;
        break;
      case "*":
        modifier = 0 /* kZeroOrMore */;
        break;
      case "+":
        modifier = 2 /* kOneOrMore */;
        break;
    }
    if (!nameToken && !regexOrWildcardToken && modifier === 3 /* kNone */) {
      appendToPendingFixedValue(prefix);
      return;
    }
    maybeAddPartFromPendingFixedValue();
    if (!nameToken && !regexOrWildcardToken) {
      if (!prefix) {
        return;
      }
      result.push(new Part(3 /* kFixed */, "", "", encodePart(prefix), "", modifier));
      return;
    }
    let regexValue;
    if (!regexOrWildcardToken) {
      regexValue = segmentWildcardRegex;
    } else if (regexOrWildcardToken === "*") {
      regexValue = kFullWildcardRegex;
    } else {
      regexValue = regexOrWildcardToken;
    }
    let type = 2 /* kRegex */;
    if (regexValue === segmentWildcardRegex) {
      type = 1 /* kSegmentWildcard */;
      regexValue = "";
    } else if (regexValue === kFullWildcardRegex) {
      type = 0 /* kFullWildcard */;
      regexValue = "";
    }
    let name;
    if (nameToken) {
      name = nameToken;
    } else if (regexOrWildcardToken) {
      name = key++;
    }
    if (nameSet.has(name)) {
      throw new TypeError(`Duplicate name '${name}'.`);
    }
    nameSet.add(name);
    result.push(new Part(type, name, encodePart(prefix), regexValue, encodePart(suffix), modifier));
  };
  while (i < tokens.length) {
    const charToken = tryConsume("CHAR");
    const nameToken = tryConsume("NAME");
    let regexOrWildcardToken = tryConsume("REGEX");
    if (!nameToken && !regexOrWildcardToken) {
      regexOrWildcardToken = tryConsume("ASTERISK");
    }
    if (nameToken || regexOrWildcardToken) {
      let prefix = charToken ?? "";
      if (options.prefixes.indexOf(prefix) === -1) {
        appendToPendingFixedValue(prefix);
        prefix = "";
      }
      maybeAddPartFromPendingFixedValue();
      let modifierToken = tryConsumeModifier();
      addPart(prefix, nameToken, regexOrWildcardToken, "", modifierToken);
      continue;
    }
    const value = charToken ?? tryConsume("ESCAPED_CHAR");
    if (value) {
      appendToPendingFixedValue(value);
      continue;
    }
    const openToken = tryConsume("OPEN");
    if (openToken) {
      const prefix = consumeText();
      const nameToken2 = tryConsume("NAME");
      let regexOrWildcardToken2 = tryConsume("REGEX");
      if (!nameToken2 && !regexOrWildcardToken2) {
        regexOrWildcardToken2 = tryConsume("ASTERISK");
      }
      const suffix = consumeText();
      mustConsume("CLOSE");
      const modifierToken = tryConsumeModifier();
      addPart(prefix, nameToken2, regexOrWildcardToken2, suffix, modifierToken);
      continue;
    }
    maybeAddPartFromPendingFixedValue();
    mustConsume("END");
  }
  return result;
}
function escapeString(str) {
  return str.replace(/([.+*?^${}()[\]|/\\])/g, "\\$1");
}
function flags(options) {
  return options && options.ignoreCase ? "ui" : "u";
}
function stringToRegexp(path, names, options) {
  return partsToRegexp(parse(path, options), names, options);
}
function modifierToString(modifier) {
  switch (modifier) {
    case 0 /* kZeroOrMore */:
      return "*";
    case 1 /* kOptional */:
      return "?";
    case 2 /* kOneOrMore */:
      return "+";
    case 3 /* kNone */:
      return "";
  }
}
function partsToRegexp(parts, names, options = {}) {
  options.delimiter ?? (options.delimiter = "/#?");
  options.prefixes ?? (options.prefixes = "./");
  options.sensitive ?? (options.sensitive = false);
  options.strict ?? (options.strict = false);
  options.end ?? (options.end = true);
  options.start ?? (options.start = true);
  options.endsWith = "";
  let result = options.start ? "^" : "";
  for (const part of parts) {
    if (part.type === 3 /* kFixed */) {
      if (part.modifier === 3 /* kNone */) {
        result += escapeString(part.value);
      } else {
        result += `(?:${escapeString(part.value)})${modifierToString(part.modifier)}`;
      }
      continue;
    }
    if (names)
      names.push(part.name);
    const segmentWildcardRegex = `[^${escapeString(options.delimiter)}]+?`;
    let regexValue = part.value;
    if (part.type === 1 /* kSegmentWildcard */)
      regexValue = segmentWildcardRegex;
    else if (part.type === 0 /* kFullWildcard */)
      regexValue = kFullWildcardRegex;
    if (!part.prefix.length && !part.suffix.length) {
      if (part.modifier === 3 /* kNone */ || part.modifier === 1 /* kOptional */) {
        result += `(${regexValue})${modifierToString(part.modifier)}`;
      } else {
        result += `((?:${regexValue})${modifierToString(part.modifier)})`;
      }
      continue;
    }
    if (part.modifier === 3 /* kNone */ || part.modifier === 1 /* kOptional */) {
      result += `(?:${escapeString(part.prefix)}(${regexValue})${escapeString(part.suffix)})`;
      result += modifierToString(part.modifier);
      continue;
    }
    result += `(?:${escapeString(part.prefix)}`;
    result += `((?:${regexValue})(?:`;
    result += escapeString(part.suffix);
    result += escapeString(part.prefix);
    result += `(?:${regexValue}))*)${escapeString(part.suffix)})`;
    if (part.modifier === 0 /* kZeroOrMore */) {
      result += "?";
    }
  }
  const endsWith = `[${escapeString(options.endsWith)}]|$`;
  const delimiter = `[${escapeString(options.delimiter)}]`;
  if (options.end) {
    if (!options.strict) {
      result += `${delimiter}?`;
    }
    if (!options.endsWith.length) {
      result += "$";
    } else {
      result += `(?=${endsWith})`;
    }
    return new RegExp(result, flags(options));
  }
  if (!options.strict) {
    result += `(?:${delimiter}(?=${endsWith}))?`;
  }
  let isEndDelimited = false;
  if (parts.length) {
    const lastPart = parts[parts.length - 1];
    if (lastPart.type === 3 /* kFixed */ && lastPart.modifier === 3 /* kNone */) {
      isEndDelimited = options.delimiter.indexOf(lastPart) > -1;
    }
  }
  if (!isEndDelimited) {
    result += `(?=${delimiter}|${endsWith})`;
  }
  return new RegExp(result, flags(options));
}

// src/url-utils.ts
var DEFAULT_OPTIONS = {
  delimiter: "",
  prefixes: "",
  sensitive: true,
  strict: true
};
var HOSTNAME_OPTIONS = {
  delimiter: ".",
  prefixes: "",
  sensitive: true,
  strict: true
};
var PATHNAME_OPTIONS = {
  delimiter: "/",
  prefixes: "/",
  sensitive: true,
  strict: true
};
function isAbsolutePathname(pathname, isPattern) {
  if (!pathname.length) {
    return false;
  }
  if (pathname[0] === "/") {
    return true;
  }
  if (!isPattern) {
    return false;
  }
  if (pathname.length < 2) {
    return false;
  }
  if ((pathname[0] == "\\" || pathname[0] == "{") && pathname[1] == "/") {
    return true;
  }
  return false;
}
function maybeStripPrefix(value, prefix) {
  if (value.startsWith(prefix)) {
    return value.substring(prefix.length, value.length);
  }
  return value;
}
function maybeStripSuffix(value, suffix) {
  if (value.endsWith(suffix)) {
    return value.substr(0, value.length - suffix.length);
  }
  return value;
}
function treatAsIPv6Hostname(value) {
  if (!value || value.length < 2) {
    return false;
  }
  if (value[0] === "[") {
    return true;
  }
  if ((value[0] === "\\" || value[0] === "{") && value[1] === "[") {
    return true;
  }
  return false;
}
var SPECIAL_SCHEMES = [
  "ftp",
  "file",
  "http",
  "https",
  "ws",
  "wss"
];
function isSpecialScheme(protocol_regexp) {
  if (!protocol_regexp) {
    return true;
  }
  for (const scheme of SPECIAL_SCHEMES) {
    if (protocol_regexp.test(scheme)) {
      return true;
    }
  }
  return false;
}
function canonicalizeHash(hash, isPattern) {
  hash = maybeStripPrefix(hash, "#");
  if (isPattern || hash === "") {
    return hash;
  }
  const url = new URL("https://example.com");
  url.hash = hash;
  return url.hash ? url.hash.substring(1, url.hash.length) : "";
}
function canonicalizeSearch(search, isPattern) {
  search = maybeStripPrefix(search, "?");
  if (isPattern || search === "") {
    return search;
  }
  const url = new URL("https://example.com");
  url.search = search;
  return url.search ? url.search.substring(1, url.search.length) : "";
}
function canonicalizeHostname(hostname, isPattern) {
  if (isPattern || hostname === "") {
    return hostname;
  }
  if (treatAsIPv6Hostname(hostname)) {
    return ipv6HostnameEncodeCallback(hostname);
  } else {
    return hostnameEncodeCallback(hostname);
  }
}
function canonicalizePassword(password, isPattern) {
  if (isPattern || password === "") {
    return password;
  }
  const url = new URL("https://example.com");
  url.password = password;
  return url.password;
}
function canonicalizeUsername(username, isPattern) {
  if (isPattern || username === "") {
    return username;
  }
  const url = new URL("https://example.com");
  url.username = username;
  return url.username;
}
function canonicalizePathname(pathname, protocol, isPattern) {
  if (isPattern || pathname === "") {
    return pathname;
  }
  if (protocol && !SPECIAL_SCHEMES.includes(protocol)) {
    const url = new URL(`${protocol}:${pathname}`);
    return url.pathname;
  }
  const leadingSlash = pathname[0] == "/";
  pathname = new URL(
    !leadingSlash ? "/-" + pathname : pathname,
    "https://example.com"
  ).pathname;
  if (!leadingSlash) {
    pathname = pathname.substring(2, pathname.length);
  }
  return pathname;
}
function canonicalizePort(port, protocol, isPattern) {
  if (defaultPortForProtocol(protocol) === port) {
    port = "";
  }
  if (isPattern || port === "") {
    return port;
  }
  return portEncodeCallback(port);
}
function canonicalizeProtocol(protocol, isPattern) {
  protocol = maybeStripSuffix(protocol, ":");
  if (isPattern || protocol === "") {
    return protocol;
  }
  return protocolEncodeCallback(protocol);
}
function defaultPortForProtocol(protocol) {
  switch (protocol) {
    case "ws":
    case "http":
      return "80";
    case "wws":
    case "https":
      return "443";
    case "ftp":
      return "21";
    default:
      return "";
  }
}
function protocolEncodeCallback(input) {
  if (input === "") {
    return input;
  }
  if (/^[-+.A-Za-z0-9]*$/.test(input))
    return input.toLowerCase();
  throw new TypeError(`Invalid protocol '${input}'.`);
}
function usernameEncodeCallback(input) {
  if (input === "") {
    return input;
  }
  const url = new URL("https://example.com");
  url.username = input;
  return url.username;
}
function passwordEncodeCallback(input) {
  if (input === "") {
    return input;
  }
  const url = new URL("https://example.com");
  url.password = input;
  return url.password;
}
function hostnameEncodeCallback(input) {
  if (input === "") {
    return input;
  }
  if (/[\t\n\r #%/:<>?@[\]^\\|]/g.test(input)) {
    throw new TypeError(`Invalid hostname '${input}'`);
  }
  const url = new URL("https://example.com");
  url.hostname = input;
  return url.hostname;
}
function ipv6HostnameEncodeCallback(input) {
  if (input === "") {
    return input;
  }
  if (/[^0-9a-fA-F[\]:]/g.test(input)) {
    throw new TypeError(`Invalid IPv6 hostname '${input}'`);
  }
  return input.toLowerCase();
}
function portEncodeCallback(input) {
  if (input === "") {
    return input;
  }
  if (/^[0-9]*$/.test(input) && parseInt(input) <= 65535) {
    return input;
  }
  throw new TypeError(`Invalid port '${input}'.`);
}
function standardURLPathnameEncodeCallback(input) {
  if (input === "") {
    return input;
  }
  const url = new URL("https://example.com");
  url.pathname = input[0] !== "/" ? "/-" + input : input;
  if (input[0] !== "/") {
    return url.pathname.substring(2, url.pathname.length);
  }
  return url.pathname;
}
function pathURLPathnameEncodeCallback(input) {
  if (input === "") {
    return input;
  }
  const url = new URL(`data:${input}`);
  return url.pathname;
}
function searchEncodeCallback(input) {
  if (input === "") {
    return input;
  }
  const url = new URL("https://example.com");
  url.search = input;
  return url.search.substring(1, url.search.length);
}
function hashEncodeCallback(input) {
  if (input === "") {
    return input;
  }
  const url = new URL("https://example.com");
  url.hash = input;
  return url.hash.substring(1, url.hash.length);
}

// src/url-pattern-parser.ts
var Parser = class {
  constructor(input) {
    // The list of `LexToken`s produced by the path-to-regexp `lexer()` function
    // when passed `input` with lenient mode enabled.
    this.tokenList = [];
    // As we parse the input string we populate a `URLPatternInit` dictionary
    // with each component pattern.  This is then the final result of the parse.
    this.internalResult = {};
    // The index of the current `LexToken` being considered.
    this.tokenIndex = 0;
    // The value to add to `tokenIndex` on each turn through the parse loop.
    // While typically this is `1`, it is also set to `0` at times for things
    // like state transitions, etc.  It is automatically reset back to `1` at
    // the top of the parse loop.
    this.tokenIncrement = 1;
    // The index of the first `LexToken` to include in the component string.
    this.componentStart = 0;
    // The current parse state.  This should only be changed via `changeState()`
    // or `rewindAndSetState()`.
    this.state = 0 /* INIT */;
    // The current nest depth of `{ }` pattern groupings.
    this.groupDepth = 0;
    // The current nesting depth of `[ ]` in hostname patterns.
    this.hostnameIPv6BracketDepth = 0;
    // True if we should apply parse rules as if this is a "standard" URL.  If
    // false then this is treated as a "not a base URL".
    this.shouldTreatAsStandardURL = false;
    this.input = input;
  }
  // Return the parse result.  The result is only available after the
  // `parse()` method completes.
  get result() {
    return this.internalResult;
  }
  // Attempt to parse the input string used to construct the Parser object.
  // This method may only be called once.  Any errors will be thrown as an
  // exception.  Retrieve the parse result by accessing the `Parser.result`
  // property getter.
  parse() {
    this.tokenList = lexer(
      this.input,
      /*lenient=*/
      true
    );
    for (; this.tokenIndex < this.tokenList.length; this.tokenIndex += this.tokenIncrement) {
      this.tokenIncrement = 1;
      if (this.tokenList[this.tokenIndex].type === "END") {
        if (this.state === 0 /* INIT */) {
          this.rewind();
          if (this.isHashPrefix()) {
            this.changeState(
              9 /* HASH */,
              /*skip=*/
              1
            );
          } else if (this.isSearchPrefix()) {
            this.changeState(
              8 /* SEARCH */,
              /*skip=*/
              1
            );
            this.internalResult.hash = "";
          } else {
            this.changeState(
              7 /* PATHNAME */,
              /*skip=*/
              0
            );
            this.internalResult.search = "";
            this.internalResult.hash = "";
          }
          continue;
        } else if (this.state === 2 /* AUTHORITY */) {
          this.rewindAndSetState(5 /* HOSTNAME */);
          continue;
        }
        this.changeState(
          10 /* DONE */,
          /*skip=*/
          0
        );
        break;
      }
      if (this.groupDepth > 0) {
        if (this.isGroupClose()) {
          this.groupDepth -= 1;
        } else {
          continue;
        }
      }
      if (this.isGroupOpen()) {
        this.groupDepth += 1;
        continue;
      }
      switch (this.state) {
        case 0 /* INIT */:
          if (this.isProtocolSuffix()) {
            this.internalResult.username = "";
            this.internalResult.password = "";
            this.internalResult.hostname = "";
            this.internalResult.port = "";
            this.internalResult.pathname = "";
            this.internalResult.search = "";
            this.internalResult.hash = "";
            this.rewindAndSetState(1 /* PROTOCOL */);
          }
          break;
        case 1 /* PROTOCOL */:
          if (this.isProtocolSuffix()) {
            this.computeShouldTreatAsStandardURL();
            let nextState = 7 /* PATHNAME */;
            let skip = 1;
            if (this.shouldTreatAsStandardURL) {
              this.internalResult.pathname = "/";
            }
            if (this.nextIsAuthoritySlashes()) {
              nextState = 2 /* AUTHORITY */;
              skip = 3;
            } else if (this.shouldTreatAsStandardURL) {
              nextState = 2 /* AUTHORITY */;
            }
            this.changeState(nextState, skip);
          }
          break;
        case 2 /* AUTHORITY */:
          if (this.isIdentityTerminator()) {
            this.rewindAndSetState(3 /* USERNAME */);
          } else if (this.isPathnameStart() || this.isSearchPrefix() || this.isHashPrefix()) {
            this.rewindAndSetState(5 /* HOSTNAME */);
          }
          break;
        case 3 /* USERNAME */:
          if (this.isPasswordPrefix()) {
            this.changeState(
              4 /* PASSWORD */,
              /*skip=*/
              1
            );
          } else if (this.isIdentityTerminator()) {
            this.changeState(
              5 /* HOSTNAME */,
              /*skip=*/
              1
            );
          }
          break;
        case 4 /* PASSWORD */:
          if (this.isIdentityTerminator()) {
            this.changeState(
              5 /* HOSTNAME */,
              /*skip=*/
              1
            );
          }
          break;
        case 5 /* HOSTNAME */:
          if (this.isIPv6Open()) {
            this.hostnameIPv6BracketDepth += 1;
          } else if (this.isIPv6Close()) {
            this.hostnameIPv6BracketDepth -= 1;
          }
          if (this.isPortPrefix() && !this.hostnameIPv6BracketDepth) {
            this.changeState(
              6 /* PORT */,
              /*skip=*/
              1
            );
          } else if (this.isPathnameStart()) {
            this.changeState(
              7 /* PATHNAME */,
              /*skip=*/
              0
            );
          } else if (this.isSearchPrefix()) {
            this.changeState(
              8 /* SEARCH */,
              /*skip=*/
              1
            );
          } else if (this.isHashPrefix()) {
            this.changeState(
              9 /* HASH */,
              /*skip=*/
              1
            );
          }
          break;
        case 6 /* PORT */:
          if (this.isPathnameStart()) {
            this.changeState(
              7 /* PATHNAME */,
              /*skip=*/
              0
            );
          } else if (this.isSearchPrefix()) {
            this.changeState(
              8 /* SEARCH */,
              /*skip=*/
              1
            );
          } else if (this.isHashPrefix()) {
            this.changeState(
              9 /* HASH */,
              /*skip=*/
              1
            );
          }
          break;
        case 7 /* PATHNAME */:
          if (this.isSearchPrefix()) {
            this.changeState(
              8 /* SEARCH */,
              /*skip=*/
              1
            );
          } else if (this.isHashPrefix()) {
            this.changeState(
              9 /* HASH */,
              /*skip=*/
              1
            );
          }
          break;
        case 8 /* SEARCH */:
          if (this.isHashPrefix()) {
            this.changeState(
              9 /* HASH */,
              /*skip=*/
              1
            );
          }
          break;
      }
    }
  }
  changeState(newState, skip) {
    switch (this.state) {
      case 0 /* INIT */:
        break;
      case 1 /* PROTOCOL */:
        this.internalResult.protocol = this.makeComponentString();
        break;
      case 2 /* AUTHORITY */:
        break;
      case 3 /* USERNAME */:
        this.internalResult.username = this.makeComponentString();
        break;
      case 4 /* PASSWORD */:
        this.internalResult.password = this.makeComponentString();
        break;
      case 5 /* HOSTNAME */:
        this.internalResult.hostname = this.makeComponentString();
        break;
      case 6 /* PORT */:
        this.internalResult.port = this.makeComponentString();
        break;
      case 7 /* PATHNAME */:
        this.internalResult.pathname = this.makeComponentString();
        break;
      case 8 /* SEARCH */:
        this.internalResult.search = this.makeComponentString();
        break;
      case 9 /* HASH */:
        this.internalResult.hash = this.makeComponentString();
        break;
    }
    this.changeStateWithoutSettingComponent(newState, skip);
  }
  changeStateWithoutSettingComponent(newState, skip) {
    this.state = newState;
    this.componentStart = this.tokenIndex + skip;
    this.tokenIndex += skip;
    this.tokenIncrement = 0;
  }
  rewind() {
    this.tokenIndex = this.componentStart;
    this.tokenIncrement = 0;
  }
  rewindAndSetState(newState) {
    this.rewind();
    this.state = newState;
  }
  safeToken(index) {
    if (index < 0) {
      index = this.tokenList.length - index;
    }
    if (index < this.tokenList.length) {
      return this.tokenList[index];
    }
    return this.tokenList[this.tokenList.length - 1];
  }
  isNonSpecialPatternChar(index, value) {
    const token = this.safeToken(index);
    return token.value === value && (token.type === "CHAR" || token.type === "ESCAPED_CHAR" || token.type === "INVALID_CHAR");
  }
  isProtocolSuffix() {
    return this.isNonSpecialPatternChar(this.tokenIndex, ":");
  }
  nextIsAuthoritySlashes() {
    return this.isNonSpecialPatternChar(this.tokenIndex + 1, "/") && this.isNonSpecialPatternChar(this.tokenIndex + 2, "/");
  }
  isIdentityTerminator() {
    return this.isNonSpecialPatternChar(this.tokenIndex, "@");
  }
  isPasswordPrefix() {
    return this.isNonSpecialPatternChar(this.tokenIndex, ":");
  }
  isPortPrefix() {
    return this.isNonSpecialPatternChar(this.tokenIndex, ":");
  }
  isPathnameStart() {
    return this.isNonSpecialPatternChar(this.tokenIndex, "/");
  }
  isSearchPrefix() {
    if (this.isNonSpecialPatternChar(this.tokenIndex, "?")) {
      return true;
    }
    if (this.tokenList[this.tokenIndex].value !== "?") {
      return false;
    }
    const previousToken = this.safeToken(this.tokenIndex - 1);
    return previousToken.type !== "NAME" && previousToken.type !== "REGEX" && previousToken.type !== "CLOSE" && previousToken.type !== "ASTERISK";
  }
  isHashPrefix() {
    return this.isNonSpecialPatternChar(this.tokenIndex, "#");
  }
  isGroupOpen() {
    return this.tokenList[this.tokenIndex].type == "OPEN";
  }
  isGroupClose() {
    return this.tokenList[this.tokenIndex].type == "CLOSE";
  }
  isIPv6Open() {
    return this.isNonSpecialPatternChar(this.tokenIndex, "[");
  }
  isIPv6Close() {
    return this.isNonSpecialPatternChar(this.tokenIndex, "]");
  }
  makeComponentString() {
    const token = this.tokenList[this.tokenIndex];
    const componentCharStart = this.safeToken(this.componentStart).index;
    return this.input.substring(componentCharStart, token.index);
  }
  computeShouldTreatAsStandardURL() {
    const options = {};
    Object.assign(options, DEFAULT_OPTIONS);
    options.encodePart = protocolEncodeCallback;
    const regexp = stringToRegexp(
      this.makeComponentString(),
      /*keys=*/
      void 0,
      options
    );
    this.shouldTreatAsStandardURL = isSpecialScheme(regexp);
  }
};

// src/url-pattern.ts
var COMPONENTS = [
  "protocol",
  "username",
  "password",
  "hostname",
  "port",
  "pathname",
  "search",
  "hash"
];
var DEFAULT_PATTERN = "*";
function extractValues(url, baseURL) {
  if (typeof url !== "string") {
    throw new TypeError(`parameter 1 is not of type 'string'.`);
  }
  const o = new URL(url, baseURL);
  return {
    protocol: o.protocol.substring(0, o.protocol.length - 1),
    username: o.username,
    password: o.password,
    hostname: o.hostname,
    port: o.port,
    pathname: o.pathname,
    search: o.search !== "" ? o.search.substring(1, o.search.length) : void 0,
    hash: o.hash !== "" ? o.hash.substring(1, o.hash.length) : void 0
  };
}
function processBaseURLString(input, isPattern) {
  if (!isPattern) {
    return input;
  }
  return escapePatternString(input);
}
function applyInit(o, init, isPattern) {
  let baseURL;
  if (typeof init.baseURL === "string") {
    try {
      baseURL = new URL(init.baseURL);
      o.protocol = processBaseURLString(baseURL.protocol.substring(0, baseURL.protocol.length - 1), isPattern);
      o.username = processBaseURLString(baseURL.username, isPattern);
      o.password = processBaseURLString(baseURL.password, isPattern);
      o.hostname = processBaseURLString(baseURL.hostname, isPattern);
      o.port = processBaseURLString(baseURL.port, isPattern);
      o.pathname = processBaseURLString(baseURL.pathname, isPattern);
      o.search = processBaseURLString(baseURL.search.substring(1, baseURL.search.length), isPattern);
      o.hash = processBaseURLString(baseURL.hash.substring(1, baseURL.hash.length), isPattern);
    } catch {
      throw new TypeError(`invalid baseURL '${init.baseURL}'.`);
    }
  }
  if (typeof init.protocol === "string") {
    o.protocol = canonicalizeProtocol(init.protocol, isPattern);
  }
  if (typeof init.username === "string") {
    o.username = canonicalizeUsername(init.username, isPattern);
  }
  if (typeof init.password === "string") {
    o.password = canonicalizePassword(init.password, isPattern);
  }
  if (typeof init.hostname === "string") {
    o.hostname = canonicalizeHostname(init.hostname, isPattern);
  }
  if (typeof init.port === "string") {
    o.port = canonicalizePort(init.port, o.protocol, isPattern);
  }
  if (typeof init.pathname === "string") {
    o.pathname = init.pathname;
    if (baseURL && !isAbsolutePathname(o.pathname, isPattern)) {
      const slashIndex = baseURL.pathname.lastIndexOf("/");
      if (slashIndex >= 0) {
        o.pathname = processBaseURLString(baseURL.pathname.substring(0, slashIndex + 1), isPattern) + o.pathname;
      }
    }
    o.pathname = canonicalizePathname(o.pathname, o.protocol, isPattern);
  }
  if (typeof init.search === "string") {
    o.search = canonicalizeSearch(init.search, isPattern);
  }
  if (typeof init.hash === "string") {
    o.hash = canonicalizeHash(init.hash, isPattern);
  }
  return o;
}
function escapePatternString(value) {
  return value.replace(/([+*?:{}()\\])/g, "\\$1");
}
function escapeRegexpString(value) {
  return value.replace(/([.+*?^${}()[\]|/\\])/g, "\\$1");
}
function partsToPattern(parts, options) {
  options.delimiter ?? (options.delimiter = "/#?");
  options.prefixes ?? (options.prefixes = "./");
  options.sensitive ?? (options.sensitive = false);
  options.strict ?? (options.strict = false);
  options.end ?? (options.end = true);
  options.start ?? (options.start = true);
  options.endsWith = "";
  const kFullWildcardRegex2 = ".*";
  const segmentWildcardRegex = `[^${escapeRegexpString(options.delimiter)}]+?`;
  const regexIdentifierPart2 = /[$_\u200C\u200D\p{ID_Continue}]/u;
  let result = "";
  for (let i = 0; i < parts.length; ++i) {
    const part = parts[i];
    if (part.type === 3 /* kFixed */) {
      if (part.modifier === 3 /* kNone */) {
        result += escapePatternString(part.value);
        continue;
      }
      result += `{${escapePatternString(part.value)}}${modifierToString(part.modifier)}`;
      continue;
    }
    const customName = part.hasCustomName();
    let needsGrouping = !!part.suffix.length || !!part.prefix.length && (part.prefix.length !== 1 || !options.prefixes.includes(part.prefix));
    const lastPart = i > 0 ? parts[i - 1] : null;
    const nextPart = i < parts.length - 1 ? parts[i + 1] : null;
    if (!needsGrouping && customName && part.type === 1 /* kSegmentWildcard */ && part.modifier === 3 /* kNone */ && nextPart && !nextPart.prefix.length && !nextPart.suffix.length) {
      if (nextPart.type === 3 /* kFixed */) {
        const code = nextPart.value.length > 0 ? nextPart.value[0] : "";
        needsGrouping = regexIdentifierPart2.test(code);
      } else {
        needsGrouping = !nextPart.hasCustomName();
      }
    }
    if (!needsGrouping && !part.prefix.length && lastPart && lastPart.type === 3 /* kFixed */) {
      const code = lastPart.value[lastPart.value.length - 1];
      needsGrouping = options.prefixes.includes(code);
    }
    if (needsGrouping) {
      result += "{";
    }
    result += escapePatternString(part.prefix);
    if (customName) {
      result += `:${part.name}`;
    }
    if (part.type === 2 /* kRegex */) {
      result += `(${part.value})`;
    } else if (part.type === 1 /* kSegmentWildcard */) {
      if (!customName) {
        result += `(${segmentWildcardRegex})`;
      }
    } else if (part.type === 0 /* kFullWildcard */) {
      if (!customName && (!lastPart || lastPart.type === 3 /* kFixed */ || lastPart.modifier !== 3 /* kNone */ || needsGrouping || part.prefix !== "")) {
        result += "*";
      } else {
        result += `(${kFullWildcardRegex2})`;
      }
    }
    if (part.type === 1 /* kSegmentWildcard */ && customName && !!part.suffix.length) {
      if (regexIdentifierPart2.test(part.suffix[0])) {
        result += "\\";
      }
    }
    result += escapePatternString(part.suffix);
    if (needsGrouping) {
      result += "}";
    }
    if (part.modifier !== 3 /* kNone */) {
      result += modifierToString(part.modifier);
    }
  }
  return result;
}
var URLPattern$2 = class {
  constructor(init = {}, baseURLOrOptions, options) {
    this.regexp = {};
    this.names = {};
    this.component_pattern = {};
    this.parts = {};
    try {
      let baseURL = void 0;
      if (typeof baseURLOrOptions === "string") {
        baseURL = baseURLOrOptions;
      } else {
        options = baseURLOrOptions;
      }
      if (typeof init === "string") {
        const parser = new Parser(init);
        parser.parse();
        init = parser.result;
        if (baseURL === void 0 && typeof init.protocol !== "string") {
          throw new TypeError(`A base URL must be provided for a relative constructor string.`);
        }
        init.baseURL = baseURL;
      } else {
        if (!init || typeof init !== "object") {
          throw new TypeError(`parameter 1 is not of type 'string' and cannot convert to dictionary.`);
        }
        if (baseURL) {
          throw new TypeError(`parameter 1 is not of type 'string'.`);
        }
      }
      if (typeof options === "undefined") {
        options = { ignoreCase: false };
      }
      const ignoreCaseOptions = { ignoreCase: options.ignoreCase === true };
      const defaults = {
        pathname: DEFAULT_PATTERN,
        protocol: DEFAULT_PATTERN,
        username: DEFAULT_PATTERN,
        password: DEFAULT_PATTERN,
        hostname: DEFAULT_PATTERN,
        port: DEFAULT_PATTERN,
        search: DEFAULT_PATTERN,
        hash: DEFAULT_PATTERN
      };
      this.pattern = applyInit(defaults, init, true);
      if (defaultPortForProtocol(this.pattern.protocol) === this.pattern.port) {
        this.pattern.port = "";
      }
      let component;
      for (component of COMPONENTS) {
        if (!(component in this.pattern))
          continue;
        const options2 = {};
        const pattern = this.pattern[component];
        this.names[component] = [];
        switch (component) {
          case "protocol":
            Object.assign(options2, DEFAULT_OPTIONS);
            options2.encodePart = protocolEncodeCallback;
            break;
          case "username":
            Object.assign(options2, DEFAULT_OPTIONS);
            options2.encodePart = usernameEncodeCallback;
            break;
          case "password":
            Object.assign(options2, DEFAULT_OPTIONS);
            options2.encodePart = passwordEncodeCallback;
            break;
          case "hostname":
            Object.assign(options2, HOSTNAME_OPTIONS);
            if (treatAsIPv6Hostname(pattern)) {
              options2.encodePart = ipv6HostnameEncodeCallback;
            } else {
              options2.encodePart = hostnameEncodeCallback;
            }
            break;
          case "port":
            Object.assign(options2, DEFAULT_OPTIONS);
            options2.encodePart = portEncodeCallback;
            break;
          case "pathname":
            if (isSpecialScheme(this.regexp.protocol)) {
              Object.assign(options2, PATHNAME_OPTIONS, ignoreCaseOptions);
              options2.encodePart = standardURLPathnameEncodeCallback;
            } else {
              Object.assign(options2, DEFAULT_OPTIONS, ignoreCaseOptions);
              options2.encodePart = pathURLPathnameEncodeCallback;
            }
            break;
          case "search":
            Object.assign(options2, DEFAULT_OPTIONS, ignoreCaseOptions);
            options2.encodePart = searchEncodeCallback;
            break;
          case "hash":
            Object.assign(options2, DEFAULT_OPTIONS, ignoreCaseOptions);
            options2.encodePart = hashEncodeCallback;
            break;
        }
        try {
          this.parts[component] = parse(pattern, options2);
          this.regexp[component] = partsToRegexp(
            this.parts[component],
            /* out */
            this.names[component],
            options2
          );
          this.component_pattern[component] = partsToPattern(this.parts[component], options2);
        } catch (err) {
          throw new TypeError(`invalid ${component} pattern '${this.pattern[component]}'.`);
        }
      }
    } catch (err) {
      throw new TypeError(`Failed to construct 'URLPattern': ${err.message}`);
    }
  }
  test(input = {}, baseURL) {
    let values = {
      pathname: "",
      protocol: "",
      username: "",
      password: "",
      hostname: "",
      port: "",
      search: "",
      hash: ""
    };
    if (typeof input !== "string" && baseURL) {
      throw new TypeError(`parameter 1 is not of type 'string'.`);
    }
    if (typeof input === "undefined") {
      return false;
    }
    try {
      if (typeof input === "object") {
        values = applyInit(values, input, false);
      } else {
        values = applyInit(values, extractValues(input, baseURL), false);
      }
    } catch (err) {
      return false;
    }
    let component;
    for (component of COMPONENTS) {
      if (!this.regexp[component].exec(values[component])) {
        return false;
      }
    }
    return true;
  }
  exec(input = {}, baseURL) {
    let values = {
      pathname: "",
      protocol: "",
      username: "",
      password: "",
      hostname: "",
      port: "",
      search: "",
      hash: ""
    };
    if (typeof input !== "string" && baseURL) {
      throw new TypeError(`parameter 1 is not of type 'string'.`);
    }
    if (typeof input === "undefined") {
      return;
    }
    try {
      if (typeof input === "object") {
        values = applyInit(values, input, false);
      } else {
        values = applyInit(values, extractValues(input, baseURL), false);
      }
    } catch (err) {
      return null;
    }
    let result = {};
    if (baseURL) {
      result.inputs = [input, baseURL];
    } else {
      result.inputs = [input];
    }
    let component;
    for (component of COMPONENTS) {
      let match = this.regexp[component].exec(values[component]);
      if (!match) {
        return null;
      }
      let groups = {};
      for (let [i, name] of this.names[component].entries()) {
        if (typeof name === "string" || typeof name === "number") {
          let value = match[i + 1];
          groups[name] = value;
        }
      }
      result[component] = {
        input: values[component] ?? "",
        groups
      };
    }
    return result;
  }
  static compareComponent(component, left, right) {
    const comparePart = (left2, right2) => {
      for (let attr of ["type", "modifier", "prefix", "value", "suffix"]) {
        if (left2[attr] < right2[attr])
          return -1;
        else if (left2[attr] === right2[attr])
          continue;
        else
          return 1;
      }
      return 0;
    };
    const emptyFixedPart = new Part(3 /* kFixed */, "", "", "", "", 3 /* kNone */);
    const wildcardOnlyPart = new Part(0 /* kFullWildcard */, "", "", "", "", 3 /* kNone */);
    const comparePartList = (left2, right2) => {
      let i = 0;
      for (; i < Math.min(left2.length, right2.length); ++i) {
        let result = comparePart(left2[i], right2[i]);
        if (result)
          return result;
      }
      if (left2.length === right2.length) {
        return 0;
      }
      return comparePart(left2[i] ?? emptyFixedPart, right2[i] ?? emptyFixedPart);
    };
    if (!left.component_pattern[component] && !right.component_pattern[component]) {
      return 0;
    }
    if (left.component_pattern[component] && !right.component_pattern[component]) {
      return comparePartList(left.parts[component], [wildcardOnlyPart]);
    }
    if (!left.component_pattern[component] && right.component_pattern[component]) {
      return comparePartList([wildcardOnlyPart], right.parts[component]);
    }
    return comparePartList(left.parts[component], right.parts[component]);
  }
  get protocol() {
    return this.component_pattern.protocol;
  }
  get username() {
    return this.component_pattern.username;
  }
  get password() {
    return this.component_pattern.password;
  }
  get hostname() {
    return this.component_pattern.hostname;
  }
  get port() {
    return this.component_pattern.port;
  }
  get pathname() {
    return this.component_pattern.pathname;
  }
  get search() {
    return this.component_pattern.search;
  }
  get hash() {
    return this.component_pattern.hash;
  }
};

if (!globalThis.URLPattern) {
  globalThis.URLPattern = URLPattern$2;
}

const globalURLPattern = typeof URLPattern === "undefined" ? undefined : URLPattern;

/* c8 ignore start */
function isLike(value, ...and) {
    if (!and.length)
        return !!value;
    return !!value && and.every((value) => !!value);
}
function ok$2(value, message, ...conditions) {
    if (conditions.length ? !conditions.every((value) => value) : !value) {
        throw new Error(message ?? "Expected value");
    }
}

function isObjectLike(value) {
    return !!(typeof value === "object" && value) || typeof value === "function";
}
class DoubleMap {
    objects;
    values;
    get(parts, fn) {
        const found = this.pick(parts);
        if (isLike(found)) {
            return found;
        }
        return this.place(parts, fn(parts));
    }
    getStored(key) {
        if (isObjectLike(key)) {
            return this.objects?.get(key);
        }
        else {
            return this.values?.get(key);
        }
    }
    pick(parts) {
        const [key, ...rest] = parts;
        const value = this.getStored(key);
        if (value instanceof DoubleMap) {
            return value.pick(rest);
        }
        return value;
    }
    place(parts, value) {
        const target = parts.slice(0, -1).reduce((map, key) => {
            const existing = map.getStored(key);
            if (existing instanceof DoubleMap) {
                return existing;
            }
            const next = new DoubleMap();
            map.set(key, next);
            return next;
        }, this);
        ok$2(target instanceof DoubleMap);
        target.set(parts.at(-1), value);
        return value;
    }
    set(key, value) {
        if (isObjectLike(key)) {
            if (!this.objects) {
                this.objects = new WeakMap();
            }
            this.objects.set(key, value);
        }
        else {
            if (!this.values) {
                this.values = new Map();
            }
            this.values.set(key, value);
        }
    }
}
function createCompositeValue(fn) {
    const keys = new Map();
    return function compositeValue(...parts) {
        const { length } = parts;
        let map = keys.get(length);
        if (!map) {
            map = new DoubleMap();
            keys.set(length, map);
        }
        return map.get(parts, fn);
    };
}
function createCompositeKey() {
    return createCompositeValue(() => Object.freeze({ __proto__: null }));
}
let internalCompositeKey = undefined;
function compositeKey(...parts) {
    if (!internalCompositeKey) {
        internalCompositeKey = createCompositeKey();
    }
    return internalCompositeKey(...parts);
}

class URLPattern$1 extends (globalURLPattern ?? URLPattern$2) {
}
function isURLPatternStringWildcard(pattern) {
    return pattern === "*";
}
const patternSymbols = Object.values({
    // From https://wicg.github.io/urlpattern/#parsing-patterns
    open: "{",
    close: "}",
    regexpOpen: "(",
    regexpClose: ")",
    nameStart: ":",
    asterisk: "*"
});
const patternParts = [
    "protocol",
    "hostname",
    "username",
    "password",
    "port",
    "pathname",
    "search",
    "hash"
];
function isURLPatternStringPlain(pattern) {
    for (const symbol of patternSymbols) {
        if (pattern.includes(symbol)) {
            return false;
        }
    }
    return true;
}
function isURLPatternPlainPathname(pattern) {
    if (!isURLPatternStringPlain(pattern.pathname)) {
        return false;
    }
    for (const part of patternParts) {
        if (part === "pathname")
            continue;
        if (!isURLPatternStringWildcard(pattern[part])) {
            return false;
        }
    }
    return true;
}
// Note, this weak map will contain all urls
// matched in the current process.
// This may not be wanted by everyone
let execCache = undefined;
function enableURLPatternCache() {
    execCache = execCache ?? new WeakMap();
}
function exec(pattern, url) {
    if (!execCache) {
        return pattern.exec(url);
    }
    const key = compositeKey(pattern, ...patternParts
        .filter(part => !isURLPatternStringWildcard(pattern[part]))
        .map(part => url[part]));
    const existing = execCache.get(key);
    if (existing)
        return existing;
    if (existing === false)
        return undefined;
    const result = pattern.exec(url);
    execCache.set(key, result ?? false);
    return result;
}

function isPromise(value) {
    return (like(value) &&
        typeof value.then === "function");
}
function ok$1(value, message = "Expected value") {
    if (!value) {
        throw new Error(message);
    }
}
function isPromiseRejectedResult(value) {
    return value.status === "rejected";
}
function like(value) {
    return !!value;
}

async function transitionEvent(router, event) {
    const promises = [];
    const { signal, } = event;
    const url = getURL(event);
    const { pathname } = url;
    transitionPart("route", (route, match) => route.fn(event, match), handleResolve, handleReject);
    if (promises.length) {
        await Promise.all(promises);
    }
    function transitionPart(type, fn, resolve = handleResolve, reject = handleReject) {
        let isRoute = false;
        resolveRouter(router);
        return isRoute;
        function matchRoute(route, parentMatch) {
            const { router, pattern, string } = route;
            let match = parentMatch;
            if (string) {
                if (string !== pathname) {
                    return;
                }
            }
            else if (pattern) {
                match = exec(pattern, url);
                if (!match)
                    return;
            }
            if (isRouter(router)) {
                return resolveRouter(router, match);
            }
            isRoute = true;
            try {
                const maybe = fn(route, match);
                if (isPromise(maybe)) {
                    promises.push(maybe
                        .then(resolve)
                        .catch(reject));
                }
                else {
                    resolve(maybe);
                }
            }
            catch (error) {
                reject(error);
            }
        }
        function resolveRouter(router, match) {
            const routes = getRouterRoutes(router);
            resolveRoutes(routes[type]);
            resolveRoutes(routes.router);
            function resolveRoutes(routes) {
                for (const route of routes) {
                    if (signal?.aborted)
                        break;
                    matchRoute(route, match);
                }
            }
        }
    }
    function noop() { }
    function handleResolve(value) {
        transitionPart("resolve", (route, match) => route.fn(value, event, match), noop, handleReject);
    }
    function handleReject(error) {
        const isRoute = transitionPart("reject", (route, match) => route.fn(error, event, match), noop, (error) => Promise.reject(error));
        if (!isRoute) {
            throw error;
        }
    }
    function getURL(event) {
        if (isDestination(event)) {
            return new URL(event.destination.url);
        }
        else if (isRequest(event)) {
            return new URL(event.request.url);
        }
        else if (isURL(event)) {
            return new URL(event.url);
        }
        throw new Error("Could not get url from event");
        function isDestination(event) {
            return (like(event) &&
                !!event.destination);
        }
        function isRequest(event) {
            return (like(event) &&
                !!event.request);
        }
        function isURL(event) {
            return (like(event) &&
                !!(event.url && (typeof event.url === "string" ||
                    event.url instanceof URL)));
        }
    }
}

const Routes = Symbol.for("@virtualstate/navigation/routes/routes");
const Attached = Symbol.for("@virtualstate/navigation/routes/attached");
const Detach = Symbol.for("@virtualstate/navigation/routes/detach");
const Target = Symbol.for("@virtualstate/navigation/routes/target");
const TargetType = Symbol.for("@virtualstate/navigation/routes/target/type");
/**
 * @internal
 */
function getRouterRoutes(router) {
    return router[Routes];
}
function isRouter(value) {
    function isRouterLike(value) {
        return !!value;
    }
    return isRouterLike(value) && !!value[Routes];
}
function getPatternString(pattern) {
    if (!pattern)
        return undefined;
    if (typeof pattern === "string") {
        if (isURLPatternStringPlain(pattern)) {
            return pattern;
        }
        else {
            return undefined;
        }
    }
    if (isURLPatternPlainPathname(pattern)) {
        return pattern.pathname;
    }
    return undefined;
}
function getPattern(pattern) {
    if (!pattern)
        return undefined;
    if (typeof pattern !== "string") {
        return pattern;
    }
    return new URLPattern$1({ pathname: pattern });
}
class Router {
    [Routes] = {
        router: [],
        route: [],
        reject: [],
        resolve: [],
    };
    [Attached] = new Set();
    [Target];
    [TargetType];
    listening = false;
    constructor(target, type) {
        this[Target] = target;
        this[TargetType] = type;
        // Catch use override types with
        // arrow functions so need to bind manually
        this.routes = this.routes.bind(this);
        this.route = this.route.bind(this);
        this.then = this.then.bind(this);
        this.catch = this.catch.bind(this);
    }
    routes(...args) {
        let router, pattern;
        if (args.length === 1) {
            [router] = args;
        }
        else if (args.length === 2) {
            [pattern, router] = args;
        }
        if (router[Attached].has(this)) {
            throw new Error("Router already attached");
        }
        this[Routes].router.push({
            string: getPatternString(pattern),
            pattern: getPattern(pattern),
            router,
        });
        router[Attached].add(this);
        this.#init();
        return this;
    }
    then(...args) {
        if (args.length === 1) {
            const [fn] = args;
            this[Routes].resolve.push({
                fn,
            });
        }
        else if (args.length === 2 && isThenError(args)) {
            const [fn, errorFn] = args;
            this[Routes].resolve.push({
                fn,
            });
            this[Routes].reject.push({
                fn: errorFn,
            });
        }
        else {
            const [pattern, fn, errorFn] = args;
            this[Routes].resolve.push({
                string: getPatternString(pattern),
                pattern: getPattern(pattern),
                fn,
            });
            if (errorFn) {
                this[Routes].reject.push({
                    string: getPatternString(pattern),
                    pattern: getPattern(pattern),
                    fn: errorFn
                });
            }
        }
        // No init for just then
        return this;
        function isThenError(args) {
            const [left, right] = args;
            return typeof left === "function" && typeof right === "function";
        }
    }
    catch(...args) {
        if (args.length === 1) {
            const [fn] = args;
            this[Routes].reject.push({
                fn,
            });
        }
        else {
            const [pattern, fn] = args;
            this[Routes].reject.push({
                string: getPatternString(pattern),
                pattern: getPattern(pattern),
                fn,
            });
        }
        // No init for just catch
        return this;
    }
    route(...args) {
        if (args.length === 1) {
            const [fn] = args;
            this[Routes].route.push({
                fn,
            });
        }
        else {
            const [pattern, fn] = args;
            this[Routes].route.push({
                string: getPatternString(pattern),
                pattern: getPattern(pattern),
                fn,
            });
        }
        this.#init();
        return this;
    }
    [Detach](router) {
        const index = this[Routes].router.findIndex((route) => route.router === router);
        if (index > -1) {
            this[Routes].router.splice(index, 1);
        }
        const length = Object.values(this[Routes]).reduce((sum, routes) => sum + routes.length, 0);
        if (length === 0) {
            this.#deinit();
        }
    }
    detach = () => {
        if (this.listening) {
            this.#deinit();
        }
        for (const attached of this[Attached]) {
            if (isRouter(attached)) {
                attached[Detach](this);
            }
        }
        this[Attached] = new Set();
    };
    #init = () => {
        if (this.listening) {
            return;
        }
        const target = this[Target];
        if (!target)
            return;
        this.listening = true;
        if (typeof target === "function") {
            return target(this.#event);
        }
        const type = this[TargetType] ?? "navigate";
        target.addEventListener(type, this.#event);
    };
    #deinit = () => {
        if (!this.listening) {
            return;
        }
        const target = this[Target];
        if (!target)
            return;
        if (typeof target === "function") {
            throw new Error("Cannot stop listening");
        }
        this.listening = false;
        const type = this[TargetType] ?? "navigate";
        target.removeEventListener(type, this.#event);
    };
    #event = (event) => {
        if (!event.canIntercept)
            return;
        if (isIntercept(event)) {
            event.intercept({
                handler: () => {
                    return this.#transition(event);
                }
            });
        }
        else if (isTransitionWhile(event)) {
            event.transitionWhile(this.#transition(event));
        }
        else if (isWaitUntil(event)) {
            event.waitUntil(this.#transition(event));
        }
        else if (isRespondWith(event)) {
            event.respondWith(this.#transition(event));
        }
        else {
            return this.#transition(event);
        }
        function isIntercept(event) {
            return (like(event) &&
                typeof event.intercept === "function");
        }
        function isTransitionWhile(event) {
            return (like(event) &&
                typeof event.transitionWhile === "function");
        }
        function isRespondWith(event) {
            return (like(event) &&
                typeof event.respondWith === "function");
        }
        function isWaitUntil(event) {
            return (like(event) &&
                typeof event.waitUntil === "function");
        }
    };
    #transition = async (event) => {
        return transitionEvent(this, event);
    };
}

let globalNavigation = undefined;
if (typeof window !== "undefined" && window.navigation) {
    const navigation = window.navigation;
    assertNavigation(navigation);
    globalNavigation = navigation;
}
function assertNavigation(value) {
    if (!value) {
        throw new Error("Expected Navigation");
    }
}

function isEvent(value) {
    function isLike(value) {
        return !!value;
    }
    return (isLike(value) &&
        (typeof value.type === "string" || typeof value.type === "symbol"));
}
function assertEvent(value, type) {
    if (!isEvent(value)) {
        throw new Error("Expected event");
    }
    if (typeof type !== "undefined" && value.type !== type) {
        throw new Error(`Expected event type ${String(type)}, got ${value.type.toString()}`);
    }
}

function isParallelEvent(value) {
    return isEvent(value) && value.parallel !== false;
}

class AbortError extends Error {
    constructor(message) {
        super(`AbortError${message ? `: ${message}` : ""}`);
        this.name = "AbortError";
    }
}
function isAbortError(error) {
    return error instanceof Error && error.name === "AbortError";
}
class InvalidStateError extends Error {
    constructor(message) {
        super(`InvalidStateError${message ? `: ${message}` : ""}`);
        this.name = "InvalidStateError";
    }
}
function isInvalidStateError(error) {
    return error instanceof Error && error.name === "InvalidStateError";
}

function isAbortSignal(value) {
    function isAbortSignalLike(value) {
        return typeof value === "object";
    }
    return (isAbortSignalLike(value) &&
        typeof value.aborted === "boolean" &&
        typeof value.addEventListener === "function");
}
function isSignalEvent(value) {
    function isSignalEventLike(value) {
        return value.hasOwnProperty("signal");
    }
    return (isEvent(value) && isSignalEventLike(value) && isAbortSignal(value.signal));
}
function isSignalHandled(event, error) {
    if (isSignalEvent(event) &&
        event.signal.aborted &&
        error instanceof Error &&
        isAbortError(error)) {
        return true;
    }
}

/**
 * @experimental
 */
const EventTargetListeners$1 = Symbol.for("@opennetwork/environment/events/target/listeners");
/**
 * @experimental
 */
const EventTargetListenersIgnore = Symbol.for("@opennetwork/environment/events/target/listeners/ignore");
/**
 * @experimental
 */
const EventTargetListenersMatch = Symbol.for("@opennetwork/environment/events/target/listeners/match");
/**
 * @experimental
 */
const EventTargetListenersThis = Symbol.for("@opennetwork/environment/events/target/listeners/this");

const EventDescriptorSymbol = Symbol.for("@opennetwork/environment/events/descriptor");

function matchEventCallback(type, callback, options) {
    const optionsDescriptor = isOptionsDescriptor(options) ? options : undefined;
    return (descriptor) => {
        if (optionsDescriptor) {
            return optionsDescriptor === descriptor;
        }
        return ((!callback || callback === descriptor.callback) &&
            type === descriptor.type);
    };
    function isOptionsDescriptor(options) {
        function isLike(options) {
            return !!options;
        }
        return isLike(options) && options[EventDescriptorSymbol] === true;
    }
}

function isFunctionEventCallback(fn) {
    return typeof fn === "function";
}
const EventTargetDescriptors = Symbol.for("@virtualstate/navigation/event-target/descriptors");
class EventTargetListeners {
    [EventTargetDescriptors] = [];
    [EventTargetListenersIgnore] = new WeakSet();
    get [EventTargetListeners$1]() {
        return [...(this[EventTargetDescriptors] ?? [])];
    }
    [EventTargetListenersMatch](type) {
        const external = this[EventTargetListeners$1];
        const matched = [
            ...new Set([...(external ?? []), ...(this[EventTargetDescriptors] ?? [])]),
        ]
            .filter((descriptor) => descriptor.type === type || descriptor.type === "*")
            .filter((descriptor) => !this[EventTargetListenersIgnore]?.has(descriptor));
        const listener = typeof type === "string" ? this[`on${type}`] : undefined;
        if (typeof listener === "function" && isFunctionEventCallback(listener)) {
            matched.push({
                type,
                callback: listener,
                [EventDescriptorSymbol]: true,
            });
        }
        return matched;
    }
    addEventListener(type, callback, options) {
        const listener = {
            ...options,
            isListening: () => !!this[EventTargetDescriptors]?.find(matchEventCallback(type, callback)),
            descriptor: {
                [EventDescriptorSymbol]: true,
                ...options,
                type,
                callback,
            },
            timestamp: Date.now(),
        };
        if (listener.isListening()) {
            return;
        }
        this[EventTargetDescriptors]?.push(listener.descriptor);
    }
    removeEventListener(type, callback, options) {
        if (!isFunctionEventCallback(callback)) {
            return;
        }
        const externalListeners = this[EventTargetListeners$1] ?? this[EventTargetDescriptors] ?? [];
        const externalIndex = externalListeners.findIndex(matchEventCallback(type, callback, options));
        if (externalIndex === -1) {
            return;
        }
        const index = this[EventTargetDescriptors]?.findIndex(matchEventCallback(type, callback, options)) ??
            -1;
        if (index !== -1) {
            this[EventTargetDescriptors]?.splice(index, 1);
        }
        const descriptor = externalListeners[externalIndex];
        if (descriptor) {
            this[EventTargetListenersIgnore]?.add(descriptor);
        }
    }
    hasEventListener(type, callback) {
        if (callback && !isFunctionEventCallback(callback)) {
            return false;
        }
        const foundIndex = this[EventTargetDescriptors]?.findIndex(matchEventCallback(type, callback)) ?? -1;
        return foundIndex > -1;
    }
}

class AsyncEventTarget extends EventTargetListeners {
    [EventTargetListenersThis];
    constructor(thisValue = undefined) {
        super();
        this[EventTargetListenersThis] = thisValue;
    }
    async dispatchEvent(event) {
        const listeners = this[EventTargetListenersMatch]?.(event.type) ?? [];
        // Don't even dispatch an aborted event
        if (isSignalEvent(event) && event.signal.aborted) {
            throw new AbortError();
        }
        const parallel = isParallelEvent(event);
        const promises = [];
        for (let index = 0; index < listeners.length; index += 1) {
            const descriptor = listeners[index];
            const promise = (async () => {
                // Remove the listener before invoking the callback
                // This ensures that inside of the callback causes no more additional event triggers to this
                // listener
                if (descriptor.once) {
                    // by passing the descriptor as the options, we get an internal redirect
                    // that forces an instance level object equals, meaning
                    // we will only remove _this_ descriptor!
                    this.removeEventListener(descriptor.type, descriptor.callback, descriptor);
                }
                await descriptor.callback.call(this[EventTargetListenersThis] ?? this, event);
            })();
            if (!parallel) {
                try {
                    await promise;
                }
                catch (error) {
                    if (!isSignalHandled(event, error)) {
                        await Promise.reject(error);
                    }
                }
                if (isSignalEvent(event) && event.signal.aborted) {
                    // bye
                    return;
                }
            }
            else {
                promises.push(promise);
            }
        }
        if (promises.length) {
            // Allows for all promises to settle finish so we can stay within the event, we then
            // will utilise Promise.all which will reject with the first rejected promise
            const results = await Promise.allSettled(promises);
            const rejected = results.filter((result) => {
                return result.status === "rejected";
            });
            if (rejected.length) {
                let unhandled = rejected;
                // If the event was aborted, then allow abort errors to occur, and handle these as handled errors
                // The dispatcher does not care about this because they requested it
                //
                // There may be other unhandled errors that are more pressing to the task they are doing.
                //
                // The dispatcher can throw an abort error if they need to throw it up the chain
                if (isSignalEvent(event) && event.signal.aborted) {
                    unhandled = unhandled.filter((result) => !isSignalHandled(event, result.reason));
                }
                if (unhandled.length === 1) {
                    await Promise.reject(unhandled[0].reason);
                    throw unhandled[0].reason; // We shouldn't get here
                }
                else if (unhandled.length > 1) {
                    throw new AggregateError(unhandled.map(({ reason }) => reason));
                }
            }
        }
    }
}

const defaultEventTargetModule = {
    EventTarget: AsyncEventTarget,
    AsyncEventTarget,
    SyncEventTarget: AsyncEventTarget,
};
let eventTargetModule = defaultEventTargetModule;
//
// try {
//     eventTargetModule = await import("@virtualstate/navigation/event-target");
//     console.log("Using @virtualstate/navigation/event-target", eventTargetModule);
// } catch {
//     console.log("Using defaultEventTargetModule");
//     eventTargetModule = defaultEventTargetModule;
// }
const EventTargetImplementation = eventTargetModule.EventTarget || eventTargetModule.SyncEventTarget || eventTargetModule.AsyncEventTarget;
function assertEventTarget(target) {
    if (typeof target !== "function") {
        throw new Error("Could not load EventTarget implementation");
    }
}
class EventTarget extends AsyncEventTarget {
    constructor(...args) {
        super();
        if (EventTargetImplementation) {
            assertEventTarget(EventTargetImplementation);
            const { dispatchEvent } = new EventTargetImplementation(...args);
            this.dispatchEvent = dispatchEvent;
        }
    }
}

class NavigationEventTarget extends EventTarget {
    addEventListener(type, listener, options) {
        assertEventCallback(listener);
        return super.addEventListener(type, listener, typeof options === "boolean" ? { once: options } : options);
        function assertEventCallback(listener) {
            if (typeof listener !== "function")
                throw new Error("Please us the function variant of event listener");
        }
    }
    removeEventListener(type, listener, options) {
        assertEventCallback(listener);
        return super.removeEventListener(type, listener);
        function assertEventCallback(listener) {
            if (typeof listener !== "function")
                throw new Error("Please us the function variant of event listener");
        }
    }
}

const isWebCryptoSupported = "crypto" in globalThis && typeof globalThis.crypto.randomUUID === "function";
const v4 = isWebCryptoSupported
    ? globalThis.crypto.randomUUID.bind(globalThis.crypto)
    : () => Array.from({ length: 5 }, () => `${Math.random()}`.replace(/^0\./, ""))
        .join("-")
        .replace(".", "");

// To prevent cyclic imports, where a circular is used, instead use the prototype interface
// and then copy over the "private" symbol
const NavigationGetState$1 = Symbol.for("@virtualstate/navigation/getState");
const NavigationHistoryEntryNavigationType = Symbol.for("@virtualstate/navigation/entry/navigationType");
const NavigationHistoryEntryKnownAs = Symbol.for("@virtualstate/navigation/entry/knownAs");
const NavigationHistoryEntrySetState = Symbol.for("@virtualstate/navigation/entry/setState");
function isPrimitiveValue(state) {
    return (typeof state === "number" ||
        typeof state === "boolean" ||
        typeof state === "symbol" ||
        typeof state === "bigint" ||
        typeof state === "string");
}
function isValue(state) {
    return !!(state || isPrimitiveValue(state));
}
class NavigationHistoryEntry extends NavigationEventTarget {
    #index;
    #state;
    get index() {
        return typeof this.#index === "number" ? this.#index : this.#index();
    }
    key;
    id;
    url;
    sameDocument;
    get [NavigationHistoryEntryNavigationType]() {
        return this.#options.navigationType;
    }
    get [NavigationHistoryEntryKnownAs]() {
        const set = new Set(this.#options[NavigationHistoryEntryKnownAs]);
        set.add(this.id);
        return set;
    }
    #options;
    get [EventTargetListeners$1]() {
        return [
            ...(super[EventTargetListeners$1] ?? []),
            ...(this.#options[EventTargetListeners$1] ?? []),
        ];
    }
    constructor(init) {
        super();
        this.#options = init;
        this.key = init.key || v4();
        this.id = v4();
        this.url = init.url ?? undefined;
        this.#index = init.index;
        this.sameDocument = init.sameDocument ?? true;
        this.#state = init.state ?? undefined;
    }
    [NavigationGetState$1]() {
        return this.#options?.getState?.(this);
    }
    getState() {
        let state = this.#state;
        if (!isValue(state)) {
            const external = this[NavigationGetState$1]();
            if (isValue(external)) {
                state = this.#state = external;
            }
        }
        /**
         * https://github.com/WICG/app-history/blob/7c0332b30746b14863f717404402bc49e497a2b2/spec.bs#L1406
         * Note that in general, unless the state value is a primitive, entry.getState() !== entry.getState(), since a fresh copy is returned each time.
         */
        if (typeof state === "undefined" ||
            isPrimitiveValue(state)) {
            return state;
        }
        if (typeof state === "function") {
            console.warn("State passed to Navigation.navigate was a function, this may be unintentional");
            console.warn("Unless a state value is primitive, with a standard implementation of Navigation");
            console.warn("your state value will be serialized and deserialized before this point, meaning");
            console.warn("a function would not be usable.");
        }
        return {
            ...state,
        };
    }
    [NavigationHistoryEntrySetState](state) {
        this.#state = state;
    }
}

/**
 * @param handleCatch rejected promises automatically to allow free usage
 */
function deferred(handleCatch) {
    let resolve = undefined, reject = undefined;
    const promise = new Promise((resolveFn, rejectFn) => {
        resolve = resolveFn;
        reject = rejectFn;
    });
    ok(resolve);
    ok(reject);
    return {
        resolve,
        reject,
        promise: handleCatch ? promise.catch(handleCatch) : promise,
    };
}
function ok(value) {
    if (!value) {
        throw new Error("Value not provided");
    }
}

const GlobalAbortController = typeof AbortController !== "undefined" ? AbortController : undefined;

if (!GlobalAbortController) {
    throw new Error("AbortController expected to be available or polyfilled");
}
const AbortController$1 = GlobalAbortController;

const THIS_WILL_BE_REMOVED = "This will be removed when version 1.0.0 of @virtualstate/navigation is published";
const WARNINGS = {
    EVENT_INTERCEPT_HANDLER: `You are using a non standard interface, please update your code to use event.intercept({ async handler() {} })\n${THIS_WILL_BE_REMOVED}`
};
function logWarning(warning, ...message) {
    try {
        {
            console.trace(WARNINGS[warning], ...message);
        }
    }
    catch {
        // We don't want attempts to log causing issues
        // maybe we don't have a console
    }
}

const Rollback = Symbol.for("@virtualstate/navigation/rollback");
const Unset = Symbol.for("@virtualstate/navigation/unset");
const NavigationTransitionParentEventTarget = Symbol.for("@virtualstate/navigation/transition/parentEventTarget");
const NavigationTransitionFinishedDeferred = Symbol.for("@virtualstate/navigation/transition/deferred/finished");
const NavigationTransitionCommittedDeferred = Symbol.for("@virtualstate/navigation/transition/deferred/committed");
const NavigationTransitionNavigationType = Symbol.for("@virtualstate/navigation/transition/navigationType");
const NavigationTransitionInitialEntries = Symbol.for("@virtualstate/navigation/transition/entries/initial");
const NavigationTransitionFinishedEntries = Symbol.for("@virtualstate/navigation/transition/entries/finished");
const NavigationTransitionInitialIndex = Symbol.for("@virtualstate/navigation/transition/index/initial");
const NavigationTransitionFinishedIndex = Symbol.for("@virtualstate/navigation/transition/index/finished");
const NavigationTransitionEntry = Symbol.for("@virtualstate/navigation/transition/entry");
const NavigationTransitionIsCommitted = Symbol.for("@virtualstate/navigation/transition/isCommitted");
const NavigationTransitionIsFinished = Symbol.for("@virtualstate/navigation/transition/isFinished");
const NavigationTransitionIsRejected = Symbol.for("@virtualstate/navigation/transition/isRejected");
const NavigationTransitionKnown = Symbol.for("@virtualstate/navigation/transition/known");
const NavigationTransitionPromises = Symbol.for("@virtualstate/navigation/transition/promises");
const NavigationIntercept = Symbol.for("@virtualstate/navigation/intercept");
const NavigationTransitionIsOngoing = Symbol.for("@virtualstate/navigation/transition/isOngoing");
const NavigationTransitionIsPending = Symbol.for("@virtualstate/navigation/transition/isPending");
const NavigationTransitionIsAsync = Symbol.for("@virtualstate/navigation/transition/isAsync");
const NavigationTransitionWait = Symbol.for("@virtualstate/navigation/transition/wait");
const NavigationTransitionPromiseResolved = Symbol.for("@virtualstate/navigation/transition/promise/resolved");
const NavigationTransitionRejected = Symbol.for("@virtualstate/navigation/transition/rejected");
const NavigationTransitionCommit = Symbol.for("@virtualstate/navigation/transition/commit");
const NavigationTransitionFinish = Symbol.for("@virtualstate/navigation/transition/finish");
const NavigationTransitionStart = Symbol.for("@virtualstate/navigation/transition/start");
const NavigationTransitionStartDeadline = Symbol.for("@virtualstate/navigation/transition/start/deadline");
const NavigationTransitionError = Symbol.for("@virtualstate/navigation/transition/error");
const NavigationTransitionFinally = Symbol.for("@virtualstate/navigation/transition/finally");
const NavigationTransitionAbort = Symbol.for("@virtualstate/navigation/transition/abort");
const NavigationTransitionInterceptOptionsCommit = Symbol.for("@virtualstate/navigation/transition/intercept/options/commit");
const NavigationTransitionCommitIsManual = Symbol.for("@virtualstate/navigation/transition/commit/isManual");
class NavigationTransition extends EventTarget {
    finished;
    /**
     * @experimental
     */
    committed;
    from;
    navigationType;
    /**
     * true if transition has an async intercept
     */
    [NavigationTransitionIsAsync] = false;
    /**
     * @experimental
     */
    [NavigationTransitionInterceptOptionsCommit];
    #options;
    [NavigationTransitionFinishedDeferred] = deferred();
    [NavigationTransitionCommittedDeferred] = deferred();
    get [NavigationTransitionIsPending]() {
        return !!this.#promises.size;
    }
    get [NavigationTransitionNavigationType]() {
        return this.#options[NavigationTransitionNavigationType];
    }
    get [NavigationTransitionInitialEntries]() {
        return this.#options[NavigationTransitionInitialEntries];
    }
    get [NavigationTransitionInitialIndex]() {
        return this.#options[NavigationTransitionInitialIndex];
    }
    get [NavigationTransitionCommitIsManual]() {
        return !!(this[NavigationTransitionInterceptOptionsCommit]?.includes("after-transition") ||
            this[NavigationTransitionInterceptOptionsCommit]?.includes("manual"));
    }
    [NavigationTransitionFinishedEntries];
    [NavigationTransitionFinishedIndex];
    [NavigationTransitionIsCommitted] = false;
    [NavigationTransitionIsFinished] = false;
    [NavigationTransitionIsRejected] = false;
    [NavigationTransitionIsOngoing] = false;
    [NavigationTransitionKnown] = new Set();
    [NavigationTransitionEntry];
    #promises = new Set();
    #rolledBack = false;
    #abortController = new AbortController$1();
    get signal() {
        return this.#abortController.signal;
    }
    get [NavigationTransitionPromises]() {
        return this.#promises;
    }
    constructor(init) {
        super();
        this[NavigationTransitionInterceptOptionsCommit] = [];
        this[NavigationTransitionFinishedDeferred] =
            init[NavigationTransitionFinishedDeferred] ??
                this[NavigationTransitionFinishedDeferred];
        this[NavigationTransitionCommittedDeferred] =
            init[NavigationTransitionCommittedDeferred] ??
                this[NavigationTransitionCommittedDeferred];
        this.#options = init;
        const finished = (this.finished =
            this[NavigationTransitionFinishedDeferred].promise);
        const committed = (this.committed =
            this[NavigationTransitionCommittedDeferred].promise);
        // Auto catching abort
        void finished.catch((error) => error);
        void committed.catch((error) => error);
        this.from = init.from;
        this.navigationType = init.navigationType;
        this[NavigationTransitionFinishedEntries] =
            init[NavigationTransitionFinishedEntries];
        this[NavigationTransitionFinishedIndex] =
            init[NavigationTransitionFinishedIndex];
        const known = init[NavigationTransitionKnown];
        if (known) {
            for (const entry of known) {
                this[NavigationTransitionKnown].add(entry);
            }
        }
        this[NavigationTransitionEntry] = init[NavigationTransitionEntry];
        // Event listeners
        {
            // Events to promises
            {
                this.addEventListener(NavigationTransitionCommit, this.#onCommitPromise, { once: true });
                this.addEventListener(NavigationTransitionFinish, this.#onFinishPromise, { once: true });
            }
            // Events to property setters
            {
                this.addEventListener(NavigationTransitionCommit, this.#onCommitSetProperty, { once: true });
                this.addEventListener(NavigationTransitionFinish, this.#onFinishSetProperty, { once: true });
            }
            // Rejection + Abort
            {
                this.addEventListener(NavigationTransitionError, this.#onError, {
                    once: true,
                });
                this.addEventListener(NavigationTransitionAbort, () => {
                    if (!this[NavigationTransitionIsFinished]) {
                        return this[NavigationTransitionRejected](new AbortError());
                    }
                });
            }
            // Proxy all events from this transition onto entry + the parent event target
            //
            // The parent could be another transition, or the Navigation, this allows us to
            // "bubble up" events layer by layer
            //
            // In this implementation, this allows individual transitions to "intercept" navigate and break the child
            // transition from happening
            //
            // TODO WARN this may not be desired behaviour vs standard spec'd Navigation
            {
                this.addEventListener("*", this[NavigationTransitionEntry].dispatchEvent.bind(this[NavigationTransitionEntry]));
                this.addEventListener("*", init[NavigationTransitionParentEventTarget].dispatchEvent.bind(init[NavigationTransitionParentEventTarget]));
            }
        }
    }
    rollback = (options) => {
        // console.log({ rolled: this.#rolledBack });
        if (this.#rolledBack) {
            // TODO
            throw new InvalidStateError("Rollback invoked multiple times: Please raise an issue at https://github.com/virtualstate/navigation with the use case where you want to use a rollback multiple times, this may have been unexpected behaviour");
        }
        this.#rolledBack = true;
        return this.#options.rollback(options);
    };
    #onCommitSetProperty = () => {
        this[NavigationTransitionIsCommitted] = true;
    };
    #onFinishSetProperty = () => {
        this[NavigationTransitionIsFinished] = true;
    };
    #onFinishPromise = () => {
        // console.log("onFinishPromise")
        this[NavigationTransitionFinishedDeferred].resolve(this[NavigationTransitionEntry]);
    };
    #onCommitPromise = () => {
        if (this.signal.aborted) ;
        else {
            this[NavigationTransitionCommittedDeferred].resolve(this[NavigationTransitionEntry]);
        }
    };
    #onError = (event) => {
        return this[NavigationTransitionRejected](event.error);
    };
    [NavigationTransitionPromiseResolved] = (...promises) => {
        for (const promise of promises) {
            this.#promises.delete(promise);
        }
    };
    [NavigationTransitionRejected] = async (reason) => {
        if (this[NavigationTransitionIsRejected])
            return;
        this[NavigationTransitionIsRejected] = true;
        this[NavigationTransitionAbort]();
        const navigationType = this[NavigationTransitionNavigationType];
        // console.log({ navigationType, reason, entry: this[NavigationTransitionEntry] });
        if (typeof navigationType === "string" || navigationType === Rollback) {
            // console.log("navigateerror", { reason, z: isInvalidStateError(reason) });
            await this.dispatchEvent({
                type: "navigateerror",
                error: reason,
                get message() {
                    if (reason instanceof Error) {
                        return reason.message;
                    }
                    return `${reason}`;
                },
            });
            // console.log("navigateerror finished");
            if (navigationType !== Rollback &&
                !(isInvalidStateError(reason) || isAbortError(reason))) {
                try {
                    // console.log("Rollback", navigationType);
                    // console.warn("Rolling back immediately due to internal error", error);
                    await this.rollback()?.finished;
                    // console.log("Rollback complete", navigationType);
                }
                catch (error) {
                    // console.error("Failed to rollback", error);
                    throw new InvalidStateError("Failed to rollback, please raise an issue at https://github.com/virtualstate/navigation/issues");
                }
            }
        }
        this[NavigationTransitionCommittedDeferred].reject(reason);
        this[NavigationTransitionFinishedDeferred].reject(reason);
    };
    [NavigationIntercept] = (options) => {
        const transition = this;
        const promise = parseOptions();
        this[NavigationTransitionIsOngoing] = true;
        if (!promise)
            return;
        this[NavigationTransitionIsAsync] = true;
        const statusPromise = promise
            .then(() => ({
            status: "fulfilled",
            value: undefined,
        }))
            .catch(async (reason) => {
            await this[NavigationTransitionRejected](reason);
            return {
                status: "rejected",
                reason,
            };
        });
        this.#promises.add(statusPromise);
        function parseOptions() {
            if (!options)
                return undefined;
            if (isPromise(options)) {
                logWarning("EVENT_INTERCEPT_HANDLER");
                return options;
            }
            if (typeof options === "function") {
                logWarning("EVENT_INTERCEPT_HANDLER");
                return options();
            }
            const { handler, commit } = options;
            if (commit && typeof commit === "string") {
                transition[NavigationTransitionInterceptOptionsCommit].push(commit);
            }
            if (typeof handler !== "function") {
                return;
            }
            return handler();
        }
    };
    [NavigationTransitionWait] = async () => {
        if (!this.#promises.size)
            return this[NavigationTransitionEntry];
        try {
            const captured = [...this.#promises];
            const results = await Promise.all(captured);
            const rejected = results.filter((result) => result.status === "rejected");
            // console.log({ rejected, results, captured });
            if (rejected.length) {
                // TODO handle differently when there are failures, e.g. we could move navigateerror to here
                if (rejected.length === 1) {
                    throw rejected[0].reason;
                }
                if (typeof AggregateError !== "undefined") {
                    throw new AggregateError(rejected.map(({ reason }) => reason));
                }
                throw new Error();
            }
            this[NavigationTransitionPromiseResolved](...captured);
            if (this[NavigationTransitionIsPending]) {
                return this[NavigationTransitionWait]();
            }
            return this[NavigationTransitionEntry];
        }
        catch (error) {
            await this.#onError(error);
            throw await Promise.reject(error);
        }
        finally {
            await this[NavigationTransitionFinish]();
        }
    };
    [NavigationTransitionAbort]() {
        if (this.#abortController.signal.aborted)
            return;
        this.#abortController.abort();
        this.dispatchEvent({
            type: NavigationTransitionAbort,
            transition: this,
            entry: this[NavigationTransitionEntry],
        });
    }
    [NavigationTransitionFinish] = async () => {
        if (this[NavigationTransitionIsFinished]) {
            return;
        }
        await this.dispatchEvent({
            type: NavigationTransitionFinish,
            transition: this,
            entry: this[NavigationTransitionEntry],
            intercept: this[NavigationIntercept],
        });
    };
}

function getWindowBaseURL() {
    try {
        if (typeof window !== "undefined" && window.location) {
            return window.location.href;
        }
    }
    catch { }
}
function getBaseURL(url) {
    const baseURL = getWindowBaseURL() ?? "https://html.spec.whatwg.org/";
    return new URL(
    // Deno wants this to be always a string
    (url ?? "").toString(), baseURL);
}

function defer() {
    let resolve = undefined, reject = undefined, settled = false, status = "pending";
    const promise = new Promise((resolveFn, rejectFn) => {
        resolve = (value) => {
            status = "fulfilled";
            settled = true;
            resolveFn(value);
        };
        reject = (reason) => {
            status = "rejected";
            settled = true;
            rejectFn(reason);
        };
    });
    ok$1(resolve);
    ok$1(reject);
    return {
        get settled() {
            return settled;
        },
        get status() {
            return status;
        },
        resolve,
        reject,
        promise,
    };
}

class NavigationCurrentEntryChangeEvent {
    type;
    from;
    navigationType;
    constructor(type, init) {
        this.type = type;
        if (!init) {
            throw new TypeError("init required");
        }
        if (!init.from) {
            throw new TypeError("from required");
        }
        this.from = init.from;
        this.navigationType = init.navigationType ?? undefined;
    }
}

class NavigateEvent {
    type;
    canIntercept;
    /**
     * @deprecated
     */
    canTransition;
    destination;
    downloadRequest;
    formData;
    hashChange;
    info;
    signal;
    userInitiated;
    navigationType;
    constructor(type, init) {
        this.type = type;
        if (!init) {
            throw new TypeError("init required");
        }
        if (!init.destination) {
            throw new TypeError("destination required");
        }
        if (!init.signal) {
            throw new TypeError("signal required");
        }
        this.canIntercept = init.canIntercept ?? false;
        this.canTransition = init.canIntercept ?? false;
        this.destination = init.destination;
        this.downloadRequest = init.downloadRequest;
        this.formData = init.formData;
        this.hashChange = init.hashChange ?? false;
        this.info = init.info;
        this.signal = init.signal;
        this.userInitiated = init.userInitiated ?? false;
        this.navigationType = init.navigationType ?? "push";
    }
    commit() {
        throw new Error("Not implemented");
    }
    intercept(options) {
        throw new Error("Not implemented");
    }
    preventDefault() {
        throw new Error("Not implemented");
    }
    reportError(reason) {
        throw new Error("Not implemented");
    }
    scroll() {
        throw new Error("Not implemented");
    }
    /**
     * @deprecated
     */
    transitionWhile(options) {
        return this.intercept(options);
    }
}

const NavigationFormData = Symbol.for("@virtualstate/navigation/formData");
const NavigationDownloadRequest = Symbol.for("@virtualstate/navigation/downloadRequest");
const NavigationCanIntercept = Symbol.for("@virtualstate/navigation/canIntercept");
const NavigationUserInitiated = Symbol.for("@virtualstate/navigation/userInitiated");
const NavigationOriginalEvent = Symbol.for("@virtualstate/navigation/originalEvent");
function noop() {
    return undefined;
}
function getEntryIndex(entries, entry) {
    const knownIndex = entry.index;
    if (knownIndex !== -1) {
        return knownIndex;
    }
    // TODO find an entry if it has changed id
    return -1;
}
function createNavigationTransition(context) {
    const { commit: transitionCommit, currentIndex, options, known: initialKnown, currentEntry, transition, transition: { [NavigationTransitionInitialEntries]: previousEntries, [NavigationTransitionEntry]: entry, [NavigationIntercept]: intercept, }, reportError } = context;
    let { transition: { [NavigationTransitionNavigationType]: navigationType }, } = context;
    let resolvedEntries = [...previousEntries];
    const known = new Set(initialKnown);
    let destinationIndex = -1, nextIndex = currentIndex;
    if (navigationType === Rollback) {
        const { index } = options ?? { index: undefined };
        if (typeof index !== "number")
            throw new InvalidStateError("Expected index to be provided for rollback");
        destinationIndex = index;
        nextIndex = index;
    }
    else if (navigationType === "traverse" || navigationType === "reload") {
        destinationIndex = getEntryIndex(previousEntries, entry);
        nextIndex = destinationIndex;
    }
    else if (navigationType === "replace") {
        if (currentIndex === -1) {
            navigationType = "push";
            destinationIndex = currentIndex + 1;
            nextIndex = destinationIndex;
        }
        else {
            destinationIndex = currentIndex;
            nextIndex = currentIndex;
        }
    }
    else {
        destinationIndex = currentIndex + 1;
        nextIndex = destinationIndex;
    }
    if (typeof destinationIndex !== "number" || destinationIndex === -1) {
        throw new InvalidStateError("Could not resolve next index");
    }
    // console.log({ navigationType, entry, options });
    if (!entry.url) {
        console.trace({ navigationType, entry, options });
        throw new InvalidStateError("Expected entry url");
    }
    const destination = {
        url: entry.url,
        key: entry.key,
        index: destinationIndex,
        sameDocument: entry.sameDocument,
        getState() {
            return entry.getState();
        },
    };
    let hashChange = false;
    const currentUrlInstance = getBaseURL(currentEntry?.url);
    const destinationUrlInstance = new URL(destination.url);
    const currentHash = currentUrlInstance.hash;
    const destinationHash = destinationUrlInstance.hash;
    // console.log({ currentHash, destinationHash });
    if (currentHash !== destinationHash) {
        const currentUrlInstanceWithoutHash = new URL(currentUrlInstance.toString());
        currentUrlInstanceWithoutHash.hash = "";
        const destinationUrlInstanceWithoutHash = new URL(destinationUrlInstance.toString());
        destinationUrlInstanceWithoutHash.hash = "";
        hashChange =
            currentUrlInstanceWithoutHash.toString() ===
                destinationUrlInstanceWithoutHash.toString();
        // console.log({ hashChange, currentUrlInstanceWithoutHash: currentUrlInstanceWithoutHash.toString(), before: destinationUrlInstanceWithoutHash.toString() })
    }
    let contextToCommit;
    const { resolve: resolveCommit, promise: waitForCommit } = defer();
    function commit() {
        ok$1(contextToCommit, "Expected contextToCommit");
        resolveCommit(transitionCommit(contextToCommit));
    }
    const abortController = new AbortController$1();
    const event = new NavigateEvent("navigate", {
        signal: abortController.signal,
        info: undefined,
        ...options,
        canIntercept: options?.[NavigationCanIntercept] ?? true,
        formData: options?.[NavigationFormData] ?? undefined,
        downloadRequest: options?.[NavigationDownloadRequest] ?? undefined,
        hashChange,
        navigationType: options?.navigationType ??
            (typeof navigationType === "string" ? navigationType : "replace"),
        userInitiated: options?.[NavigationUserInitiated] ?? false,
        destination,
    });
    const originalEvent = options?.[NavigationOriginalEvent];
    const preventDefault = transition[NavigationTransitionAbort].bind(transition);
    if (originalEvent) {
        const definedEvent = originalEvent;
        event.intercept = function originalEventIntercept(options) {
            definedEvent.preventDefault();
            return intercept(options);
        };
        event.preventDefault = function originalEventPreventDefault() {
            definedEvent.preventDefault();
            return preventDefault();
        };
    }
    else {
        event.intercept = intercept;
        event.preventDefault = preventDefault;
    }
    // Enforce that transitionWhile and intercept match
    event.transitionWhile = event.intercept;
    event.commit = commit;
    if (reportError) {
        event.reportError = reportError;
    }
    event.scroll = noop;
    if (originalEvent) {
        event.originalEvent = originalEvent;
    }
    const currentEntryChange = new NavigationCurrentEntryChangeEvent("currententrychange", {
        from: currentEntry,
        navigationType: event.navigationType,
    });
    let updatedEntries = [], removedEntries = [], addedEntries = [];
    const previousKeys = previousEntries.map(entry => entry.key);
    if (navigationType === Rollback) {
        const { entries } = options ?? { entries: undefined };
        if (!entries)
            throw new InvalidStateError("Expected entries to be provided for rollback");
        resolvedEntries = entries;
        resolvedEntries.forEach((entry) => known.add(entry));
        const keys = resolvedEntries.map(entry => entry.key);
        removedEntries = previousEntries.filter(entry => !keys.includes(entry.key));
        addedEntries = resolvedEntries.filter(entry => !previousKeys.includes(entry.key));
    }
    // Default next index is current entries length, aka
    // console.log({ navigationType, givenNavigationType, index: this.#currentIndex, resolvedNextIndex });
    else if (navigationType === "replace" ||
        navigationType === "traverse" ||
        navigationType === "reload") {
        resolvedEntries[destination.index] = entry;
        if (navigationType !== "traverse") {
            updatedEntries.push(entry);
        }
        if (navigationType === "replace") {
            resolvedEntries = resolvedEntries.slice(0, destination.index + 1);
        }
        const keys = resolvedEntries.map(entry => entry.key);
        removedEntries = previousEntries.filter(entry => !keys.includes(entry.key));
        if (previousKeys.includes(entry.id)) {
            addedEntries = [entry];
        }
    }
    else if (navigationType === "push") {
        let removed = false;
        // Trim forward, we have reset our stack
        if (resolvedEntries[destination.index]) {
            // const before = [...this.#entries];
            resolvedEntries = resolvedEntries.slice(0, destination.index);
            // console.log({ before, after: [...this.#entries]})
            removed = true;
        }
        resolvedEntries.push(entry);
        addedEntries = [entry];
        if (removed) {
            const keys = resolvedEntries.map(entry => entry.key);
            removedEntries = previousEntries.filter(entry => !keys.includes(entry.key));
        }
    }
    known.add(entry);
    let entriesChange = undefined;
    if (updatedEntries.length || addedEntries.length || removedEntries.length) {
        entriesChange = {
            updatedEntries,
            addedEntries,
            removedEntries
        };
    }
    contextToCommit = {
        entries: resolvedEntries,
        index: nextIndex,
        known,
        entriesChange
    };
    return {
        entries: resolvedEntries,
        known,
        index: nextIndex,
        currentEntryChange,
        destination,
        navigate: event,
        navigationType,
        waitForCommit,
        commit,
        abortController
    };
}

function createEvent(event) {
    if (typeof CustomEvent !== "undefined" && typeof event.type === "string") {
        if (event instanceof CustomEvent) {
            return event;
        }
        const { type, detail, ...rest } = event;
        const customEvent = new CustomEvent(type, {
            detail: detail ?? rest,
        });
        Object.assign(customEvent, rest);
        assertEvent(customEvent, event.type);
        return customEvent;
    }
    return event;
}

const NavigationSetOptions = Symbol.for("@virtualstate/navigation/setOptions");
const NavigationSetEntries = Symbol.for("@virtualstate/navigation/setEntries");
const NavigationSetCurrentIndex = Symbol.for("@virtualstate/navigation/setCurrentIndex");
const NavigationSetCurrentKey = Symbol.for("@virtualstate/navigation/setCurrentKey");
const NavigationGetState = Symbol.for("@virtualstate/navigation/getState");
const NavigationSetState = Symbol.for("@virtualstate/navigation/setState");
const NavigationDisposeState = Symbol.for("@virtualstate/navigation/disposeState");
function isNavigationNavigationType(value) {
    return (value === "reload" ||
        value === "push" ||
        value === "replace" ||
        value === "traverse");
}
class Navigation extends NavigationEventTarget {
    // Should be always 0 or 1
    #transitionInProgressCount = 0;
    // #activePromise?: Promise<void> = undefined;
    #entries = [];
    #known = new Set();
    #currentIndex = -1;
    #activeTransition;
    #knownTransitions = new WeakSet();
    #baseURL = "";
    #initialEntry = undefined;
    #options = undefined;
    get canGoBack() {
        return !!this.#entries[this.#currentIndex - 1];
    }
    get canGoForward() {
        return !!this.#entries[this.#currentIndex + 1];
    }
    get currentEntry() {
        if (this.#currentIndex === -1) {
            if (!this.#initialEntry) {
                this.#initialEntry = new NavigationHistoryEntry({
                    getState: this[NavigationGetState],
                    navigationType: "push",
                    index: -1,
                    sameDocument: false,
                    url: this.#baseURL.toString()
                });
            }
            return this.#initialEntry;
        }
        return this.#entries[this.#currentIndex];
    }
    get transition() {
        const transition = this.#activeTransition;
        // Never let an aborted transition leak, it doesn't need to be accessed any more
        return transition?.signal.aborted ? undefined : transition;
    }
    constructor(options = {}) {
        super();
        this[NavigationSetOptions](options);
    }
    [NavigationSetOptions](options) {
        this.#options = options;
        this.#baseURL = getBaseURL(options?.baseURL);
        this.#entries = [];
        if (options.entries) {
            this[NavigationSetEntries](options.entries);
        }
        if (options.currentKey) {
            this[NavigationSetCurrentKey](options.currentKey);
        }
        else if (typeof options.currentIndex === "number") {
            this[NavigationSetCurrentIndex](options.currentIndex);
        }
    }
    /**
     * Set the current entry key without any lifecycle eventing
     *
     * This would be more exact than providing an index
     * @param key
     */
    [NavigationSetCurrentKey](key) {
        const index = this.#entries.findIndex(entry => entry.key === key);
        // If the key can't be found, becomes a no-op
        if (index === -1)
            return;
        this.#currentIndex = index;
    }
    /**
     * Set the current entry index without any lifecycle eventing
     * @param index
     */
    [NavigationSetCurrentIndex](index) {
        if (index <= -1)
            return;
        if (index >= this.#entries.length)
            return;
        this.#currentIndex = index;
    }
    /**
     * Set the entries available without any lifecycle eventing
     * @param entries
     */
    [NavigationSetEntries](entries) {
        this.#entries = entries.map(({ key, url, navigationType, state, sameDocument }, index) => new NavigationHistoryEntry({
            getState: this[NavigationGetState],
            navigationType: isNavigationNavigationType(navigationType) ? navigationType : "push",
            sameDocument: sameDocument ?? true,
            index,
            url,
            key,
            state
        }));
        if (this.#currentIndex === -1 && this.#entries.length) {
            // Initialise, even if its not the one that was expected
            this.#currentIndex = 0;
        }
    }
    [NavigationGetState] = (entry) => {
        return this.#options?.getState?.(entry) ?? undefined;
    };
    [NavigationSetState] = (entry) => {
        return this.#options?.setState?.(entry);
    };
    [NavigationDisposeState] = (entry) => {
        return this.#options?.disposeState?.(entry);
    };
    back(options) {
        if (!this.canGoBack)
            throw new InvalidStateError("Cannot go back");
        const entry = this.#entries[this.#currentIndex - 1];
        return this.#pushEntry("traverse", this.#cloneNavigationHistoryEntry(entry, {
            ...options,
            navigationType: "traverse",
        }));
    }
    entries() {
        return [...this.#entries];
    }
    forward(options) {
        if (!this.canGoForward)
            throw new InvalidStateError();
        const entry = this.#entries[this.#currentIndex + 1];
        return this.#pushEntry("traverse", this.#cloneNavigationHistoryEntry(entry, {
            ...options,
            navigationType: "traverse",
        }));
    }
    /**
    /**
     * @deprecated use traverseTo
     */
    goTo(key, options) {
        return this.traverseTo(key, options);
    }
    traverseTo(key, options) {
        const found = this.#entries.find((entry) => entry.key === key);
        if (found) {
            return this.#pushEntry("traverse", this.#cloneNavigationHistoryEntry(found, {
                ...options,
                navigationType: "traverse",
            }));
        }
        throw new InvalidStateError();
    }
    #isSameDocument = (url) => {
        function isSameOrigins(a, b) {
            return a.origin === b.origin;
        }
        const currentEntryUrl = this.currentEntry?.url;
        if (!currentEntryUrl)
            return true;
        return isSameOrigins(new URL(currentEntryUrl), new URL(url));
    };
    navigate(url, options) {
        let baseURL = this.#baseURL;
        if (this.currentEntry?.url) {
            // This allows use to use relative
            baseURL = this.currentEntry?.url;
        }
        const nextUrl = new URL(url, baseURL).toString();
        let navigationType = "push";
        if (options?.history === "push" || options?.history === "replace") {
            navigationType = options?.history;
        }
        const entry = this.#createNavigationHistoryEntry({
            getState: this[NavigationGetState],
            url: nextUrl,
            ...options,
            sameDocument: this.#isSameDocument(nextUrl),
            navigationType,
        });
        return this.#pushEntry(navigationType, entry, undefined, options);
    }
    #cloneNavigationHistoryEntry = (entry, options) => {
        return this.#createNavigationHistoryEntry({
            ...entry,
            getState: this[NavigationGetState],
            index: entry?.index ?? undefined,
            state: options?.state ?? entry?.getState(),
            navigationType: entry?.[NavigationHistoryEntryNavigationType] ??
                (typeof options?.navigationType === "string"
                    ? options.navigationType
                    : "replace"),
            ...options,
            get [NavigationHistoryEntryKnownAs]() {
                return entry?.[NavigationHistoryEntryKnownAs];
            },
            get [EventTargetListeners$1]() {
                return entry?.[EventTargetListeners$1];
            },
        });
    };
    #createNavigationHistoryEntry = (options) => {
        const entry = new NavigationHistoryEntry({
            ...options,
            index: options.index ??
                (() => {
                    return this.#entries.indexOf(entry);
                }),
        });
        return entry;
    };
    #pushEntry = (navigationType, entry, transition, options) => {
        /* c8 ignore start */
        if (entry === this.currentEntry)
            throw new InvalidStateError();
        const existingPosition = this.#entries.findIndex((existing) => existing.id === entry.id);
        if (existingPosition > -1) {
            throw new InvalidStateError();
        }
        /* c8 ignore end */
        return this.#commitTransition(navigationType, entry, transition, options);
    };
    #commitTransition = (givenNavigationType, entry, transition, options) => {
        const nextTransition = transition ??
            new NavigationTransition({
                from: entry,
                navigationType: typeof givenNavigationType === "string"
                    ? givenNavigationType
                    : "replace",
                rollback: (options) => {
                    return this.#rollback(nextTransition, options);
                },
                [NavigationTransitionNavigationType]: givenNavigationType,
                [NavigationTransitionInitialEntries]: [...this.#entries],
                [NavigationTransitionInitialIndex]: this.#currentIndex,
                [NavigationTransitionKnown]: [...this.#known],
                [NavigationTransitionEntry]: entry,
                [NavigationTransitionParentEventTarget]: this,
            });
        const { finished, committed } = nextTransition;
        const handler = () => {
            return this.#immediateTransition(givenNavigationType, entry, nextTransition, options);
        };
        this.#queueTransition(nextTransition);
        void handler().catch((error) => void error);
        // let nextPromise;
        // if (!this.#transitionInProgressCount || !this.#activePromise) {
        //   nextPromise = handler().catch((error) => void error);
        // } else {
        //   nextPromise = this.#activePromise.then(handler);
        // }
        //
        // const promise = nextPromise
        //     .catch(error => void error)
        //     .then(() => {
        //       if (this.#activePromise === promise) {
        //         this.#activePromise = undefined;
        //       }
        //     })
        //
        // this.#activePromise = promise;
        return { committed, finished };
    };
    #queueTransition = (transition) => {
        // TODO consume errors that are not abort errors
        // transition.finished.catch(error => void error);
        this.#knownTransitions.add(transition);
    };
    #immediateTransition = (givenNavigationType, entry, transition, options) => {
        try {
            // This number can grow if navigation is
            // called during a transition
            //
            // ... I had used transitionInProgressCount as a
            // safeguard until I could see this flow firsthand
            this.#transitionInProgressCount += 1;
            return this.#transition(givenNavigationType, entry, transition, options);
        }
        finally {
            this.#transitionInProgressCount -= 1;
        }
    };
    #rollback = (rollbackTransition, options) => {
        const previousEntries = rollbackTransition[NavigationTransitionInitialEntries];
        const previousIndex = rollbackTransition[NavigationTransitionInitialIndex];
        const previousCurrent = previousEntries[previousIndex];
        // console.log("z");
        // console.log("Rollback!", { previousCurrent, previousEntries, previousIndex });
        const entry = previousCurrent
            ? this.#cloneNavigationHistoryEntry(previousCurrent, options)
            : undefined;
        const nextOptions = {
            ...options,
            index: previousIndex,
            known: new Set([...this.#known, ...previousEntries]),
            navigationType: entry?.[NavigationHistoryEntryNavigationType] ?? "replace",
            entries: previousEntries,
        };
        const resolvedNavigationType = entry ? Rollback : Unset;
        const resolvedEntry = entry ??
            this.#createNavigationHistoryEntry({
                getState: this[NavigationGetState],
                navigationType: "replace",
                index: nextOptions.index,
                sameDocument: true,
                ...options,
            });
        return this.#pushEntry(resolvedNavigationType, resolvedEntry, undefined, nextOptions);
    };
    #transition = (givenNavigationType, entry, transition, options) => {
        // console.log({ givenNavigationType, transition });
        let navigationType = givenNavigationType;
        const performance = getPerformance();
        if (performance &&
            entry.sameDocument &&
            typeof navigationType === "string") {
            performance?.mark?.(`same-document-navigation:${entry.id}`);
        }
        let currentEntryChangeEvent = false, committedCurrentEntryChange = false;
        const { currentEntry } = this;
        void this.#activeTransition?.finished?.catch((error) => error);
        void this.#activeTransition?.[NavigationTransitionFinishedDeferred]?.promise?.catch((error) => error);
        void this.#activeTransition?.[NavigationTransitionCommittedDeferred]?.promise?.catch((error) => error);
        this.#activeTransition?.[NavigationTransitionAbort]();
        this.#activeTransition = transition;
        const startEventPromise = transition.dispatchEvent({
            type: NavigationTransitionStart,
            transition,
            entry,
        });
        const syncCommit = ({ entries, index, known }) => {
            if (transition.signal.aborted)
                return;
            this.#entries = entries;
            if (known) {
                this.#known = new Set([...this.#known, ...known]);
            }
            this.#currentIndex = index;
            // Let's trigger external state here
            // because it is the absolute point of
            // committing to using an entry
            //
            // If the entry came from an external source
            // then internal to getState the external source will be pulled from
            // only if the entry doesn't hold the state in memory
            //
            // TLDR I believe this will be no issue doing here, even if we end up
            // calling an external setState multiple times, it is better than
            // loss of the state
            this[NavigationSetState](this.currentEntry);
        };
        const asyncCommit = async (commit) => {
            if (committedCurrentEntryChange) {
                return;
            }
            committedCurrentEntryChange = true;
            syncCommit(commit);
            const { entriesChange } = commit;
            const promises = [
                transition.dispatchEvent(createEvent({
                    type: NavigationTransitionCommit,
                    transition,
                    entry,
                }))
            ];
            if (entriesChange) {
                promises.push(this.dispatchEvent(createEvent({
                    type: "entrieschange",
                    ...entriesChange
                })));
            }
            await Promise.all(promises);
        };
        const unsetTransition = async () => {
            await startEventPromise;
            if (!(typeof options?.index === "number" && options.entries))
                throw new InvalidStateError();
            const previous = this.entries();
            const previousKeys = previous.map(entry => entry.key);
            const keys = options.entries.map(entry => entry.key);
            const removedEntries = previous.filter(entry => !keys.includes(entry.key));
            const addedEntries = options.entries.filter(entry => !previousKeys.includes(entry.key));
            await asyncCommit({
                entries: options.entries,
                index: options.index,
                known: options.known,
                entriesChange: (removedEntries.length || addedEntries.length) ? {
                    removedEntries,
                    addedEntries,
                    updatedEntries: []
                } : undefined
            });
            await this.dispatchEvent(createEvent({
                type: "currententrychange",
            }));
            currentEntryChangeEvent = true;
            return entry;
        };
        const completeTransition = () => {
            if (givenNavigationType === Unset) {
                return unsetTransition();
            }
            const transitionResult = createNavigationTransition({
                currentEntry,
                currentIndex: this.#currentIndex,
                options,
                transition,
                known: this.#known,
                commit: asyncCommit,
                reportError: transition[NavigationTransitionRejected]
            });
            const microtask = new Promise(queueMicrotask);
            let promises = [];
            const iterator = transitionSteps(transitionResult)[Symbol.iterator]();
            const iterable = {
                [Symbol.iterator]: () => ({ next: () => iterator.next() }),
            };
            async function syncTransition() {
                for (const promise of iterable) {
                    if (isPromise(promise)) {
                        promises.push(Promise.allSettled([
                            promise
                        ]).then(([result]) => result));
                    }
                    if (transition[NavigationTransitionCommitIsManual] ||
                        (currentEntryChangeEvent && transition[NavigationTransitionIsAsync])) {
                        return asyncTransition().then(syncTransition);
                    }
                    if (transition.signal.aborted) {
                        break;
                    }
                }
                if (promises.length) {
                    return asyncTransition();
                }
            }
            async function asyncTransition() {
                const captured = [...promises];
                if (captured.length) {
                    promises = [];
                    const results = await Promise.all(captured);
                    const rejected = results.filter(isPromiseRejectedResult);
                    if (rejected.length === 1) {
                        throw await Promise.reject(rejected[0]);
                    }
                    else if (rejected.length) {
                        throw new AggregateError(rejected, rejected[0].reason?.message);
                    }
                }
                else if (!transition[NavigationTransitionIsOngoing]) {
                    await microtask;
                }
            }
            // console.log("Returning", { entry });
            return syncTransition()
                .then(() => transition[NavigationTransitionIsOngoing] ? undefined : microtask)
                .then(() => entry);
        };
        const dispose = async () => this.#dispose();
        function* transitionSteps(transitionResult) {
            const microtask = new Promise(queueMicrotask);
            const { currentEntryChange, navigate, waitForCommit, commit, abortController } = transitionResult;
            const navigateAbort = abortController.abort.bind(abortController);
            transition.signal.addEventListener("abort", navigateAbort, {
                once: true,
            });
            if (typeof navigationType === "string" || navigationType === Rollback) {
                const promise = currentEntry?.dispatchEvent(createEvent({
                    type: "navigatefrom",
                    intercept: transition[NavigationIntercept],
                    /**
                     * @deprecated
                     */
                    transitionWhile: transition[NavigationIntercept],
                }));
                if (promise)
                    yield promise;
            }
            if (typeof navigationType === "string") {
                yield transition.dispatchEvent(navigate);
            }
            if (!transition[NavigationTransitionCommitIsManual]) {
                commit();
            }
            yield waitForCommit;
            if (entry.sameDocument) {
                yield transition.dispatchEvent(currentEntryChange);
            }
            currentEntryChangeEvent = true;
            if (typeof navigationType === "string") {
                yield entry.dispatchEvent(createEvent({
                    type: "navigateto",
                    intercept: transition[NavigationIntercept],
                    /**
                     * @deprecated
                     */
                    transitionWhile: transition[NavigationIntercept],
                }));
            }
            yield dispose();
            if (!transition[NavigationTransitionPromises].size) {
                yield microtask;
            }
            yield transition.dispatchEvent({
                type: NavigationTransitionStartDeadline,
                transition,
                entry,
            });
            yield transition[NavigationTransitionWait]();
            transition.signal.removeEventListener("abort", navigateAbort);
            yield transition[NavigationTransitionFinish]();
            if (typeof navigationType === "string") {
                yield transition.dispatchEvent(createEvent({
                    type: "finish",
                    intercept: transition[NavigationIntercept],
                    /**
                     * @deprecated
                     */
                    transitionWhile: transition[NavigationIntercept],
                }));
                yield transition.dispatchEvent(createEvent({
                    type: "navigatesuccess",
                    intercept: transition[NavigationIntercept],
                    /**
                     * @deprecated
                     */
                    transitionWhile: transition[NavigationIntercept],
                }));
            }
        }
        const maybeSyncTransition = () => {
            try {
                return completeTransition();
            }
            catch (error) {
                return Promise.reject(error);
            }
        };
        return Promise.allSettled([maybeSyncTransition()])
            .then(async ([detail]) => {
            if (detail.status === "rejected") {
                await transition.dispatchEvent({
                    type: NavigationTransitionError,
                    error: detail.reason,
                    transition,
                    entry,
                });
            }
            await dispose();
            await transition.dispatchEvent({
                type: NavigationTransitionFinally,
                transition,
                entry,
            });
            await transition[NavigationTransitionWait]();
            if (this.#activeTransition === transition) {
                this.#activeTransition = undefined;
            }
            if (entry.sameDocument && typeof navigationType === "string") {
                performance.mark(`same-document-navigation-finish:${entry.id}`);
                performance.measure(`same-document-navigation:${entry.url}`, `same-document-navigation:${entry.id}`, `same-document-navigation-finish:${entry.id}`);
            }
        })
            .then(() => entry);
    };
    #dispose = async () => {
        // console.log(JSON.stringify({ known: [...this.#known], entries: this.#entries }));
        for (const known of this.#known) {
            const index = this.#entries.findIndex((entry) => entry.key === known.key);
            if (index !== -1) {
                // Still in use
                continue;
            }
            // No index, no longer known
            this.#known.delete(known);
            const event = createEvent({
                type: "dispose",
                entry: known,
            });
            this[NavigationDisposeState](known);
            await known.dispatchEvent(event);
            await this.dispatchEvent(event);
        }
        // console.log(JSON.stringify({ pruned: [...this.#known] }));
    };
    reload(options) {
        const { currentEntry } = this;
        if (!currentEntry)
            throw new InvalidStateError();
        const entry = this.#cloneNavigationHistoryEntry(currentEntry, options);
        return this.#pushEntry("reload", entry, undefined, options);
    }
    updateCurrentEntry(options) {
        const { currentEntry } = this;
        if (!currentEntry) {
            throw new InvalidStateError("Expected current entry");
        }
        // Instant change
        currentEntry[NavigationHistoryEntrySetState](options.state);
        this[NavigationSetState](currentEntry);
        const currentEntryChange = new NavigationCurrentEntryChangeEvent("currententrychange", {
            from: currentEntry,
            navigationType: undefined,
        });
        const entriesChange = createEvent({
            type: "entrieschange",
            addedEntries: [],
            removedEntries: [],
            updatedEntries: [
                currentEntry
            ]
        });
        return Promise.all([
            this.dispatchEvent(currentEntryChange),
            this.dispatchEvent(entriesChange)
        ]);
    }
}
function getPerformance() {
    if (typeof performance !== "undefined") {
        return performance;
    }
    /* c8 ignore start */
    return {
        now() {
            return Date.now();
        },
        mark() { },
        measure() { },
    };
    // const { performance: nodePerformance } = await import("perf_hooks");
    // return nodePerformance;
    /* c8 ignore end */
}

let navigation;
function getNavigation() {
    if (globalNavigation) {
        return globalNavigation;
    }
    if (navigation) {
        return navigation;
    }
    return (navigation = new Navigation());
}

let router;
function getRouter() {
    if (isRouter(router)) {
        return router;
    }
    const navigation = getNavigation();
    const local = new Router(navigation, "navigate");
    router = local;
    return local;
}
function route(...args) {
    let pattern, fn;
    if (args.length === 1) {
        [fn] = args;
    }
    else if (args.length === 2) {
        [pattern, fn] = args;
    }
    return routes(pattern).route(fn);
}
function routes(...args) {
    let router;
    if (!args.length) {
        router = new Router();
        getRouter().routes(router);
    }
    else if (args.length === 1) {
        const [arg] = args;
        if (isRouter(arg)) {
            router = arg;
            getRouter().routes(router);
        }
        else {
            const pattern = arg;
            router = new Router();
            getRouter().routes(pattern, router);
        }
    }
    else if (args.length >= 2) {
        const [pattern, routerArg] = args;
        router = routerArg ?? new Router();
        getRouter().routes(pattern, router);
    }
    return router;
}

export { Router, enableURLPatternCache, getRouter, getRouterRoutes, isRouter, route, routes, transitionEvent };
//# sourceMappingURL=routes-rollup.js.map
