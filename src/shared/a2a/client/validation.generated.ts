// @ts-nocheck -- generated standalone validators intentionally contain untyped locals.
// deno-lint-ignore-file
/**
 * @generated Standalone runtime validators. Do not edit by hand.
 *
 * A2A protocol: 1.0 (v1.0.0)
 * Normative proto: https://github.com/a2aproject/A2A/blob/v1.0.0/specification/a2a.proto
 * Published schema: https://a2a-protocol.org/v1.0.0/spec/a2a.json
 * Schema SHA-256: 6b6560c726289734799b7d5883be84e4cc0452600736db0f811341bac43b8d62
 * Schema generator: github.com/bufbuild/protoschema-plugins@v0.6.0
 * Artifact generator: json-schema-to-typescript@15.0.4; ajv@8.20.0
 * Upstream license: Apache-2.0
 */
"use strict";
export const validateAgentCard = validate20;
const schema31 = {
  "$id": "https://point-and-shoot.invalid/schemas/a2a/v1/validateAgentCard",
  "$ref": "https://point-and-shoot.invalid/schemas/a2a/v1#/definitions/Agent Card",
};
const schema33 = {
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "additionalProperties": false,
  "description":
    "A self-describing manifest for an agent. It provides essential\n metadata including the agent's identity, capabilities, skills, supported\n communication methods, and security requirements.\n Next ID: 20",
  "patternProperties": {
    "^(default_input_modes)$": {
      "description":
        "The set of interaction modes that the agent supports across all skills.\n This can be overridden per skill. Defined as media types.",
      "items": { "type": "string" },
      "type": "array",
    },
    "^(default_output_modes)$": {
      "description": "The media types supported as outputs from this agent.",
      "items": { "type": "string" },
      "type": "array",
    },
    "^(documentation_url)$": {
      "description": "A URL providing additional documentation about the agent.",
      "type": "string",
    },
    "^(icon_url)$": {
      "description": "Optional. A URL to an icon for the agent.",
      "type": "string",
    },
    "^(security_requirements)$": {
      "description": "Security requirements for contacting the agent.",
      "items": { "$ref": "#/definitions/Security Requirement" },
      "type": "array",
    },
    "^(security_schemes)$": {
      "additionalProperties": { "$ref": "#/definitions/Security Scheme" },
      "description": "The security scheme details used for authenticating with this agent.",
      "propertyNames": { "type": "string" },
      "type": "object",
    },
    "^(supported_interfaces)$": {
      "description": "Ordered list of supported interfaces. The first entry is preferred.",
      "items": { "$ref": "#/definitions/Agent Interface" },
      "type": "array",
    },
  },
  "properties": {
    "capabilities": {
      "$ref": "#/definitions/Agent Capabilities",
      "description": "A2A Capability set supported by the agent.",
    },
    "defaultInputModes": {
      "description":
        "The set of interaction modes that the agent supports across all skills.\n This can be overridden per skill. Defined as media types.",
      "items": { "type": "string" },
      "type": "array",
    },
    "defaultOutputModes": {
      "description": "The media types supported as outputs from this agent.",
      "items": { "type": "string" },
      "type": "array",
    },
    "description": {
      "default": "",
      "description":
        'A human-readable description of the agent, assisting users and other agents\n in understanding its purpose.\n Example: "Agent that helps users with recipes and cooking."',
      "type": "string",
    },
    "documentationUrl": {
      "description": "A URL providing additional documentation about the agent.",
      "type": "string",
    },
    "iconUrl": { "description": "Optional. A URL to an icon for the agent.", "type": "string" },
    "name": {
      "default": "",
      "description": 'A human readable name for the agent.\n Example: "Recipe Agent"',
      "type": "string",
    },
    "provider": {
      "$ref": "#/definitions/Agent Provider",
      "description": "The service provider of the agent.",
    },
    "securityRequirements": {
      "description": "Security requirements for contacting the agent.",
      "items": { "$ref": "#/definitions/Security Requirement" },
      "type": "array",
    },
    "securitySchemes": {
      "additionalProperties": { "$ref": "#/definitions/Security Scheme" },
      "description": "The security scheme details used for authenticating with this agent.",
      "propertyNames": { "type": "string" },
      "type": "object",
    },
    "signatures": {
      "description": "JSON Web Signatures computed for this `AgentCard`.",
      "items": { "$ref": "#/definitions/Agent Card Signature" },
      "type": "array",
    },
    "skills": {
      "description":
        "Skills represent the abilities of an agent.\n It is largely a descriptive concept but represents a more focused set of behaviors that the\n agent is likely to succeed at.",
      "items": { "$ref": "#/definitions/Agent Skill" },
      "type": "array",
    },
    "supportedInterfaces": {
      "description": "Ordered list of supported interfaces. The first entry is preferred.",
      "items": { "$ref": "#/definitions/Agent Interface" },
      "type": "array",
    },
    "version": {
      "default": "",
      "description": 'The version of the agent.\n Example: "1.0.0"',
      "type": "string",
    },
  },
  "title": "Agent Card",
  "type": "object",
};
const schema37 = {
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "additionalProperties": false,
  "description": "Represents the service provider of an agent.",
  "properties": {
    "organization": {
      "default": "",
      "description": 'The name of the agent provider\'s organization.\n Example: "Google"',
      "type": "string",
    },
    "url": {
      "default": "",
      "description":
        'A URL for the agent provider\'s website or relevant documentation.\n Example: "https://ai.google.dev"',
      "type": "string",
    },
  },
  "title": "Agent Provider",
  "type": "object",
};
const schema62 = {
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "additionalProperties": false,
  "description":
    "Declares a combination of a target URL, transport and protocol version for interacting with the agent.\n This allows agents to expose the same functionality over multiple protocol binding mechanisms.",
  "patternProperties": {
    "^(protocol_binding)$": {
      "default": "",
      "description":
        "The protocol binding supported at this URL. This is an open form string, to be\n easily extended for other protocol bindings. The core ones officially\n supported are `JSONRPC`, `GRPC` and `HTTP+JSON`.",
      "type": "string",
    },
    "^(protocol_version)$": {
      "default": "",
      "description":
        'The version of the A2A protocol this interface exposes.\n Use the latest supported minor version per major version.\n Examples: "0.3", "1.0"',
      "type": "string",
    },
  },
  "properties": {
    "protocolBinding": {
      "default": "",
      "description":
        "The protocol binding supported at this URL. This is an open form string, to be\n easily extended for other protocol bindings. The core ones officially\n supported are `JSONRPC`, `GRPC` and `HTTP+JSON`.",
      "type": "string",
    },
    "protocolVersion": {
      "default": "",
      "description":
        'The version of the A2A protocol this interface exposes.\n Use the latest supported minor version per major version.\n Examples: "0.3", "1.0"',
      "type": "string",
    },
    "tenant": {
      "default": "",
      "description": "Tenant ID to be used in the request when calling the agent.",
      "type": "string",
    },
    "url": {
      "default": "",
      "description":
        'The URL where this interface is available. Must be a valid absolute HTTPS URL in production.\n Example: "https://api.example.com/a2a/v1", "https://grpc.example.com/a2a"',
      "type": "string",
    },
  },
  "title": "Agent Interface",
  "type": "object",
};
const func1 = Object.prototype.hasOwnProperty;
const pattern4 = new RegExp("^(default_input_modes)$", "u");
const pattern5 = new RegExp("^(default_output_modes)$", "u");
const pattern6 = new RegExp("^(documentation_url)$", "u");
const pattern7 = new RegExp("^(icon_url)$", "u");
const pattern8 = new RegExp("^(security_requirements)$", "u");
const pattern9 = new RegExp("^(security_schemes)$", "u");
const pattern10 = new RegExp("^(supported_interfaces)$", "u");
const pattern91 = new RegExp("^(protocol_binding)$", "u");
const pattern92 = new RegExp("^(protocol_version)$", "u");
const schema34 = {
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "additionalProperties": false,
  "description": "Defines optional capabilities supported by an agent.",
  "patternProperties": {
    "^(extended_agent_card)$": {
      "description":
        "Indicates if the agent supports providing an extended agent card when authenticated.",
      "type": "boolean",
    },
    "^(push_notifications)$": {
      "description":
        "Indicates if the agent supports sending push notifications for asynchronous task updates.",
      "type": "boolean",
    },
  },
  "properties": {
    "extendedAgentCard": {
      "description":
        "Indicates if the agent supports providing an extended agent card when authenticated.",
      "type": "boolean",
    },
    "extensions": {
      "description": "A list of protocol extensions supported by the agent.",
      "items": { "$ref": "#/definitions/Agent Extension" },
      "type": "array",
    },
    "pushNotifications": {
      "description":
        "Indicates if the agent supports sending push notifications for asynchronous task updates.",
      "type": "boolean",
    },
    "streaming": {
      "description": "Indicates if the agent supports streaming responses.",
      "type": "boolean",
    },
  },
  "title": "Agent Capabilities",
  "type": "object",
};
const pattern11 = new RegExp("^(extended_agent_card)$", "u");
const pattern12 = new RegExp("^(push_notifications)$", "u");
const schema35 = {
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "additionalProperties": false,
  "description": "A declaration of a protocol extension supported by an Agent.",
  "properties": {
    "description": {
      "default": "",
      "description": "A human-readable description of how this agent uses the extension.",
      "type": "string",
    },
    "params": {
      "$ref": "#/definitions/Struct",
      "description": "Optional. Extension-specific configuration parameters.",
    },
    "required": {
      "default": false,
      "description":
        "If true, the client must understand and comply with the extension's requirements.",
      "type": "boolean",
    },
    "uri": {
      "default": "",
      "description": "The unique URI identifying the extension.",
      "type": "string",
    },
  },
  "title": "Agent Extension",
  "type": "object",
};
const schema36 = {
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "title": "Struct",
  "type": "object",
};

function validate24(
  data,
  { instancePath = "", parentData, parentDataProperty, rootData = data, dynamicAnchors = {} } = {},
) {
  let vErrors = null;
  let errors = 0;
  const evaluated0 = validate24.evaluated;
  if (evaluated0.dynamicProps) {
    evaluated0.props = undefined;
  }
  if (evaluated0.dynamicItems) {
    evaluated0.items = undefined;
  }
  if (data && typeof data == "object" && !Array.isArray(data)) {
    for (const key0 in data) {
      if (
        !((((key0 === "description") || (key0 === "params")) || (key0 === "required")) ||
          (key0 === "uri"))
      ) {
        const err0 = {
          instancePath,
          schemaPath: "#/additionalProperties",
          keyword: "additionalProperties",
          params: { additionalProperty: key0 },
          message: "must NOT have additional properties",
        };
        if (vErrors === null) {
          vErrors = [err0];
        } else {
          vErrors.push(err0);
        }
        errors++;
      }
    }
    if (data.description !== undefined) {
      if (typeof data.description !== "string") {
        const err1 = {
          instancePath: instancePath + "/description",
          schemaPath: "#/properties/description/type",
          keyword: "type",
          params: { type: "string" },
          message: "must be string",
        };
        if (vErrors === null) {
          vErrors = [err1];
        } else {
          vErrors.push(err1);
        }
        errors++;
      }
    }
    if (data.params !== undefined) {
      let data1 = data.params;
      if (!(data1 && typeof data1 == "object" && !Array.isArray(data1))) {
        const err2 = {
          instancePath: instancePath + "/params",
          schemaPath: "#/definitions/Struct/type",
          keyword: "type",
          params: { type: "object" },
          message: "must be object",
        };
        if (vErrors === null) {
          vErrors = [err2];
        } else {
          vErrors.push(err2);
        }
        errors++;
      }
    }
    if (data.required !== undefined) {
      if (typeof data.required !== "boolean") {
        const err3 = {
          instancePath: instancePath + "/required",
          schemaPath: "#/properties/required/type",
          keyword: "type",
          params: { type: "boolean" },
          message: "must be boolean",
        };
        if (vErrors === null) {
          vErrors = [err3];
        } else {
          vErrors.push(err3);
        }
        errors++;
      }
    }
    if (data.uri !== undefined) {
      if (typeof data.uri !== "string") {
        const err4 = {
          instancePath: instancePath + "/uri",
          schemaPath: "#/properties/uri/type",
          keyword: "type",
          params: { type: "string" },
          message: "must be string",
        };
        if (vErrors === null) {
          vErrors = [err4];
        } else {
          vErrors.push(err4);
        }
        errors++;
      }
    }
  } else {
    const err5 = {
      instancePath,
      schemaPath: "#/type",
      keyword: "type",
      params: { type: "object" },
      message: "must be object",
    };
    if (vErrors === null) {
      vErrors = [err5];
    } else {
      vErrors.push(err5);
    }
    errors++;
  }
  validate24.errors = vErrors;
  return errors === 0;
}
validate24.evaluated = { "props": true, "dynamicProps": false, "dynamicItems": false };

function validate23(
  data,
  { instancePath = "", parentData, parentDataProperty, rootData = data, dynamicAnchors = {} } = {},
) {
  let vErrors = null;
  let errors = 0;
  const evaluated0 = validate23.evaluated;
  if (evaluated0.dynamicProps) {
    evaluated0.props = undefined;
  }
  if (evaluated0.dynamicItems) {
    evaluated0.items = undefined;
  }
  if (data && typeof data == "object" && !Array.isArray(data)) {
    for (const key0 in data) {
      if (
        !((((((key0 === "extendedAgentCard") || (key0 === "extensions")) ||
          (key0 === "pushNotifications")) || (key0 === "streaming")) || (pattern11.test(key0))) ||
          (pattern12.test(key0)))
      ) {
        const err0 = {
          instancePath,
          schemaPath: "#/additionalProperties",
          keyword: "additionalProperties",
          params: { additionalProperty: key0 },
          message: "must NOT have additional properties",
        };
        if (vErrors === null) {
          vErrors = [err0];
        } else {
          vErrors.push(err0);
        }
        errors++;
      }
    }
    if (data.extendedAgentCard !== undefined) {
      if (typeof data.extendedAgentCard !== "boolean") {
        const err1 = {
          instancePath: instancePath + "/extendedAgentCard",
          schemaPath: "#/properties/extendedAgentCard/type",
          keyword: "type",
          params: { type: "boolean" },
          message: "must be boolean",
        };
        if (vErrors === null) {
          vErrors = [err1];
        } else {
          vErrors.push(err1);
        }
        errors++;
      }
    }
    if (data.extensions !== undefined) {
      let data1 = data.extensions;
      if (Array.isArray(data1)) {
        const len0 = data1.length;
        for (let i0 = 0; i0 < len0; i0++) {
          if (
            !(validate24(data1[i0], {
              instancePath: instancePath + "/extensions/" + i0,
              parentData: data1,
              parentDataProperty: i0,
              rootData,
              dynamicAnchors,
            }))
          ) {
            vErrors = vErrors === null ? validate24.errors : vErrors.concat(validate24.errors);
            errors = vErrors.length;
          }
        }
      } else {
        const err2 = {
          instancePath: instancePath + "/extensions",
          schemaPath: "#/properties/extensions/type",
          keyword: "type",
          params: { type: "array" },
          message: "must be array",
        };
        if (vErrors === null) {
          vErrors = [err2];
        } else {
          vErrors.push(err2);
        }
        errors++;
      }
    }
    if (data.pushNotifications !== undefined) {
      if (typeof data.pushNotifications !== "boolean") {
        const err3 = {
          instancePath: instancePath + "/pushNotifications",
          schemaPath: "#/properties/pushNotifications/type",
          keyword: "type",
          params: { type: "boolean" },
          message: "must be boolean",
        };
        if (vErrors === null) {
          vErrors = [err3];
        } else {
          vErrors.push(err3);
        }
        errors++;
      }
    }
    if (data.streaming !== undefined) {
      if (typeof data.streaming !== "boolean") {
        const err4 = {
          instancePath: instancePath + "/streaming",
          schemaPath: "#/properties/streaming/type",
          keyword: "type",
          params: { type: "boolean" },
          message: "must be boolean",
        };
        if (vErrors === null) {
          vErrors = [err4];
        } else {
          vErrors.push(err4);
        }
        errors++;
      }
    }
    for (const key1 in data) {
      if (pattern11.test(key1)) {
        if (typeof data[key1] !== "boolean") {
          const err5 = {
            instancePath: instancePath + "/" + key1.replace(/~/g, "~0").replace(/\//g, "~1"),
            schemaPath: "#/patternProperties/%5E(extended_agent_card)%24/type",
            keyword: "type",
            params: { type: "boolean" },
            message: "must be boolean",
          };
          if (vErrors === null) {
            vErrors = [err5];
          } else {
            vErrors.push(err5);
          }
          errors++;
        }
      }
    }
    for (const key2 in data) {
      if (pattern12.test(key2)) {
        if (typeof data[key2] !== "boolean") {
          const err6 = {
            instancePath: instancePath + "/" + key2.replace(/~/g, "~0").replace(/\//g, "~1"),
            schemaPath: "#/patternProperties/%5E(push_notifications)%24/type",
            keyword: "type",
            params: { type: "boolean" },
            message: "must be boolean",
          };
          if (vErrors === null) {
            vErrors = [err6];
          } else {
            vErrors.push(err6);
          }
          errors++;
        }
      }
    }
  } else {
    const err7 = {
      instancePath,
      schemaPath: "#/type",
      keyword: "type",
      params: { type: "object" },
      message: "must be object",
    };
    if (vErrors === null) {
      vErrors = [err7];
    } else {
      vErrors.push(err7);
    }
    errors++;
  }
  validate23.errors = vErrors;
  return errors === 0;
}
validate23.evaluated = { "props": true, "dynamicProps": false, "dynamicItems": false };

const schema38 = {
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "additionalProperties": false,
  "description": "Defines the security requirements for an agent.",
  "properties": {
    "schemes": {
      "additionalProperties": { "$ref": "#/definitions/String List" },
      "description": "A map of security schemes to the required scopes.",
      "propertyNames": { "type": "string" },
      "type": "object",
    },
  },
  "title": "Security Requirement",
  "type": "object",
};
const schema39 = {
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "additionalProperties": false,
  "description": "A list of strings.",
  "properties": {
    "list": {
      "description": "The individual string values.",
      "items": { "type": "string" },
      "type": "array",
    },
  },
  "title": "String List",
  "type": "object",
};

function validate27(
  data,
  { instancePath = "", parentData, parentDataProperty, rootData = data, dynamicAnchors = {} } = {},
) {
  let vErrors = null;
  let errors = 0;
  const evaluated0 = validate27.evaluated;
  if (evaluated0.dynamicProps) {
    evaluated0.props = undefined;
  }
  if (evaluated0.dynamicItems) {
    evaluated0.items = undefined;
  }
  if (data && typeof data == "object" && !Array.isArray(data)) {
    for (const key0 in data) {
      if (!(key0 === "schemes")) {
        const err0 = {
          instancePath,
          schemaPath: "#/additionalProperties",
          keyword: "additionalProperties",
          params: { additionalProperty: key0 },
          message: "must NOT have additional properties",
        };
        if (vErrors === null) {
          vErrors = [err0];
        } else {
          vErrors.push(err0);
        }
        errors++;
      }
    }
    if (data.schemes !== undefined) {
      let data0 = data.schemes;
      if (data0 && typeof data0 == "object" && !Array.isArray(data0)) {
        for (const key1 in data0) {
          const _errs4 = errors;
          if (typeof key1 !== "string") {
            const err1 = {
              instancePath: instancePath + "/schemes",
              schemaPath: "#/properties/schemes/propertyNames/type",
              keyword: "type",
              params: { type: "string" },
              message: "must be string",
              propertyName: key1,
            };
            if (vErrors === null) {
              vErrors = [err1];
            } else {
              vErrors.push(err1);
            }
            errors++;
          }
          var valid1 = _errs4 === errors;
          if (!valid1) {
            const err2 = {
              instancePath: instancePath + "/schemes",
              schemaPath: "#/properties/schemes/propertyNames",
              keyword: "propertyNames",
              params: { propertyName: key1 },
              message: "property name must be valid",
            };
            if (vErrors === null) {
              vErrors = [err2];
            } else {
              vErrors.push(err2);
            }
            errors++;
          }
        }
        for (const key2 in data0) {
          let data1 = data0[key2];
          if (data1 && typeof data1 == "object" && !Array.isArray(data1)) {
            for (const key3 in data1) {
              if (!(key3 === "list")) {
                const err3 = {
                  instancePath: instancePath + "/schemes/" +
                    key2.replace(/~/g, "~0").replace(/\//g, "~1"),
                  schemaPath: "#/definitions/String List/additionalProperties",
                  keyword: "additionalProperties",
                  params: { additionalProperty: key3 },
                  message: "must NOT have additional properties",
                };
                if (vErrors === null) {
                  vErrors = [err3];
                } else {
                  vErrors.push(err3);
                }
                errors++;
              }
            }
            if (data1.list !== undefined) {
              let data2 = data1.list;
              if (Array.isArray(data2)) {
                const len0 = data2.length;
                for (let i0 = 0; i0 < len0; i0++) {
                  if (typeof data2[i0] !== "string") {
                    const err4 = {
                      instancePath: instancePath + "/schemes/" +
                        key2.replace(/~/g, "~0").replace(/\//g, "~1") + "/list/" + i0,
                      schemaPath: "#/definitions/String List/properties/list/items/type",
                      keyword: "type",
                      params: { type: "string" },
                      message: "must be string",
                    };
                    if (vErrors === null) {
                      vErrors = [err4];
                    } else {
                      vErrors.push(err4);
                    }
                    errors++;
                  }
                }
              } else {
                const err5 = {
                  instancePath: instancePath + "/schemes/" +
                    key2.replace(/~/g, "~0").replace(/\//g, "~1") + "/list",
                  schemaPath: "#/definitions/String List/properties/list/type",
                  keyword: "type",
                  params: { type: "array" },
                  message: "must be array",
                };
                if (vErrors === null) {
                  vErrors = [err5];
                } else {
                  vErrors.push(err5);
                }
                errors++;
              }
            }
          } else {
            const err6 = {
              instancePath: instancePath + "/schemes/" +
                key2.replace(/~/g, "~0").replace(/\//g, "~1"),
              schemaPath: "#/definitions/String List/type",
              keyword: "type",
              params: { type: "object" },
              message: "must be object",
            };
            if (vErrors === null) {
              vErrors = [err6];
            } else {
              vErrors.push(err6);
            }
            errors++;
          }
        }
      } else {
        const err7 = {
          instancePath: instancePath + "/schemes",
          schemaPath: "#/properties/schemes/type",
          keyword: "type",
          params: { type: "object" },
          message: "must be object",
        };
        if (vErrors === null) {
          vErrors = [err7];
        } else {
          vErrors.push(err7);
        }
        errors++;
      }
    }
  } else {
    const err8 = {
      instancePath,
      schemaPath: "#/type",
      keyword: "type",
      params: { type: "object" },
      message: "must be object",
    };
    if (vErrors === null) {
      vErrors = [err8];
    } else {
      vErrors.push(err8);
    }
    errors++;
  }
  validate27.errors = vErrors;
  return errors === 0;
}
validate27.evaluated = { "props": true, "dynamicProps": false, "dynamicItems": false };

const schema40 = {
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "additionalProperties": false,
  "description":
    "Defines a security scheme that can be used to secure an agent's endpoints.\n This is a discriminated union type based on the OpenAPI 3.2 Security Scheme Object.\n See: https://spec.openapis.org/oas/v3.2.0.html#security-scheme-object",
  "patternProperties": {
    "^(api_key_security_scheme)$": {
      "$ref": "#/definitions/API Key Security Scheme",
      "description": "API key-based authentication.",
    },
    "^(http_auth_security_scheme)$": {
      "$ref": "#/definitions/HTTP Auth Security Scheme",
      "description": "HTTP authentication (Basic, Bearer, etc.).",
    },
    "^(mtls_security_scheme)$": {
      "$ref": "#/definitions/Mutual Tls Security Scheme",
      "description": "Mutual TLS authentication.",
    },
    "^(oauth2_security_scheme)$": {
      "$ref": "#/definitions/O Auth2 Security Scheme",
      "description": "OAuth 2.0 authentication.",
    },
    "^(open_id_connect_security_scheme)$": {
      "$ref": "#/definitions/Open Id Connect Security Scheme",
      "description": "OpenID Connect authentication.",
    },
  },
  "properties": {
    "apiKeySecurityScheme": {
      "$ref": "#/definitions/API Key Security Scheme",
      "description": "API key-based authentication.",
    },
    "httpAuthSecurityScheme": {
      "$ref": "#/definitions/HTTP Auth Security Scheme",
      "description": "HTTP authentication (Basic, Bearer, etc.).",
    },
    "mtlsSecurityScheme": {
      "$ref": "#/definitions/Mutual Tls Security Scheme",
      "description": "Mutual TLS authentication.",
    },
    "oauth2SecurityScheme": {
      "$ref": "#/definitions/O Auth2 Security Scheme",
      "description": "OAuth 2.0 authentication.",
    },
    "openIdConnectSecurityScheme": {
      "$ref": "#/definitions/Open Id Connect Security Scheme",
      "description": "OpenID Connect authentication.",
    },
  },
  "title": "Security Scheme",
  "type": "object",
};
const schema41 = {
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "additionalProperties": false,
  "description": "Defines a security scheme using an API key.",
  "properties": {
    "description": {
      "default": "",
      "description": "An optional description for the security scheme.",
      "type": "string",
    },
    "location": {
      "default": "",
      "description":
        'The location of the API key. Valid values are "query", "header", or "cookie".',
      "type": "string",
    },
    "name": {
      "default": "",
      "description": "The name of the header, query, or cookie parameter to be used.",
      "type": "string",
    },
  },
  "title": "API Key Security Scheme",
  "type": "object",
};
const schema42 = {
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "additionalProperties": false,
  "description": "Defines a security scheme using HTTP authentication.",
  "patternProperties": {
    "^(bearer_format)$": {
      "default": "",
      "description":
        'A hint to the client to identify how the bearer token is formatted (e.g., "JWT").\n Primarily for documentation purposes.',
      "type": "string",
    },
  },
  "properties": {
    "bearerFormat": {
      "default": "",
      "description":
        'A hint to the client to identify how the bearer token is formatted (e.g., "JWT").\n Primarily for documentation purposes.',
      "type": "string",
    },
    "description": {
      "default": "",
      "description": "An optional description for the security scheme.",
      "type": "string",
    },
    "scheme": {
      "default": "",
      "description":
        'The name of the HTTP Authentication scheme to be used in the Authorization header,\n as defined in RFC7235 (e.g., "Bearer").\n This value should be registered in the IANA Authentication Scheme registry.',
      "type": "string",
    },
  },
  "title": "HTTP Auth Security Scheme",
  "type": "object",
};
const schema43 = {
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "additionalProperties": false,
  "description": "Defines a security scheme using mTLS authentication.",
  "properties": {
    "description": {
      "default": "",
      "description": "An optional description for the security scheme.",
      "type": "string",
    },
  },
  "title": "Mutual Tls Security Scheme",
  "type": "object",
};
const schema54 = {
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "additionalProperties": false,
  "description": "Defines a security scheme using OpenID Connect.",
  "patternProperties": {
    "^(open_id_connect_url)$": {
      "default": "",
      "description":
        "The [OpenID Connect Discovery URL](https://openid.net/specs/openid-connect-discovery-1_0.html) for the OIDC provider's metadata.",
      "type": "string",
    },
  },
  "properties": {
    "description": {
      "default": "",
      "description": "An optional description for the security scheme.",
      "type": "string",
    },
    "openIdConnectUrl": {
      "default": "",
      "description":
        "The [OpenID Connect Discovery URL](https://openid.net/specs/openid-connect-discovery-1_0.html) for the OIDC provider's metadata.",
      "type": "string",
    },
  },
  "title": "Open Id Connect Security Scheme",
  "type": "object",
};
const pattern15 = new RegExp("^(api_key_security_scheme)$", "u");
const pattern16 = new RegExp("^(http_auth_security_scheme)$", "u");
const pattern17 = new RegExp("^(mtls_security_scheme)$", "u");
const pattern18 = new RegExp("^(oauth2_security_scheme)$", "u");
const pattern19 = new RegExp("^(open_id_connect_security_scheme)$", "u");
const pattern20 = new RegExp("^(bearer_format)$", "u");
const pattern74 = new RegExp("^(open_id_connect_url)$", "u");
const schema44 = {
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "additionalProperties": false,
  "description": "Defines a security scheme using OAuth 2.0.",
  "patternProperties": {
    "^(oauth2_metadata_url)$": {
      "default": "",
      "description":
        "URL to the OAuth2 authorization server metadata [RFC 8414](https://datatracker.ietf.org/doc/html/rfc8414).\n TLS is required.",
      "type": "string",
    },
  },
  "properties": {
    "description": {
      "default": "",
      "description": "An optional description for the security scheme.",
      "type": "string",
    },
    "flows": {
      "$ref": "#/definitions/O Auth Flows",
      "description":
        "An object containing configuration information for the supported OAuth 2.0 flows.",
    },
    "oauth2MetadataUrl": {
      "default": "",
      "description":
        "URL to the OAuth2 authorization server metadata [RFC 8414](https://datatracker.ietf.org/doc/html/rfc8414).\n TLS is required.",
      "type": "string",
    },
  },
  "title": "O Auth2 Security Scheme",
  "type": "object",
};
const pattern22 = new RegExp("^(oauth2_metadata_url)$", "u");
const schema45 = {
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "additionalProperties": false,
  "description": "Defines the configuration for the supported OAuth 2.0 flows.",
  "patternProperties": {
    "^(authorization_code)$": {
      "$ref": "#/definitions/Authorization CodeO Auth Flow",
      "description": "Configuration for the OAuth Authorization Code flow.",
    },
    "^(client_credentials)$": {
      "$ref": "#/definitions/Client CredentialsO Auth Flow",
      "description": "Configuration for the OAuth Client Credentials flow.",
    },
    "^(device_code)$": {
      "$ref": "#/definitions/Device CodeO Auth Flow",
      "description": "Configuration for the OAuth Device Code flow.",
    },
  },
  "properties": {
    "authorizationCode": {
      "$ref": "#/definitions/Authorization CodeO Auth Flow",
      "description": "Configuration for the OAuth Authorization Code flow.",
    },
    "clientCredentials": {
      "$ref": "#/definitions/Client CredentialsO Auth Flow",
      "description": "Configuration for the OAuth Client Credentials flow.",
    },
    "deviceCode": {
      "$ref": "#/definitions/Device CodeO Auth Flow",
      "description": "Configuration for the OAuth Device Code flow.",
    },
    "implicit": {
      "$ref": "#/definitions/ImplicitO Auth Flow",
      "description": "Deprecated: Use Authorization Code + PKCE instead.",
    },
    "password": {
      "$ref": "#/definitions/PasswordO Auth Flow",
      "description": "Deprecated: Use Authorization Code + PKCE or Device Code.",
    },
  },
  "title": "O Auth Flows",
  "type": "object",
};
const schema46 = {
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "additionalProperties": false,
  "description": "Defines configuration details for the OAuth 2.0 Authorization Code flow.",
  "patternProperties": {
    "^(authorization_url)$": {
      "default": "",
      "description": "The authorization URL to be used for this flow.",
      "type": "string",
    },
    "^(pkce_required)$": {
      "default": false,
      "description":
        "Indicates if PKCE (RFC 7636) is required for this flow.\n PKCE should always be used for public clients and is recommended for all clients.",
      "type": "boolean",
    },
    "^(refresh_url)$": {
      "default": "",
      "description": "The URL to be used for obtaining refresh tokens.",
      "type": "string",
    },
    "^(token_url)$": {
      "default": "",
      "description": "The token URL to be used for this flow.",
      "type": "string",
    },
  },
  "properties": {
    "authorizationUrl": {
      "default": "",
      "description": "The authorization URL to be used for this flow.",
      "type": "string",
    },
    "pkceRequired": {
      "default": false,
      "description":
        "Indicates if PKCE (RFC 7636) is required for this flow.\n PKCE should always be used for public clients and is recommended for all clients.",
      "type": "boolean",
    },
    "refreshUrl": {
      "default": "",
      "description": "The URL to be used for obtaining refresh tokens.",
      "type": "string",
    },
    "scopes": {
      "additionalProperties": { "type": "string" },
      "description": "The available scopes for the OAuth2 security scheme.",
      "propertyNames": { "type": "string" },
      "type": "object",
    },
    "tokenUrl": {
      "default": "",
      "description": "The token URL to be used for this flow.",
      "type": "string",
    },
  },
  "title": "Authorization CodeO Auth Flow",
  "type": "object",
};
const schema47 = {
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "additionalProperties": false,
  "description": "Defines configuration details for the OAuth 2.0 Client Credentials flow.",
  "patternProperties": {
    "^(refresh_url)$": {
      "default": "",
      "description": "The URL to be used for obtaining refresh tokens.",
      "type": "string",
    },
    "^(token_url)$": {
      "default": "",
      "description": "The token URL to be used for this flow.",
      "type": "string",
    },
  },
  "properties": {
    "refreshUrl": {
      "default": "",
      "description": "The URL to be used for obtaining refresh tokens.",
      "type": "string",
    },
    "scopes": {
      "additionalProperties": { "type": "string" },
      "description": "The available scopes for the OAuth2 security scheme.",
      "propertyNames": { "type": "string" },
      "type": "object",
    },
    "tokenUrl": {
      "default": "",
      "description": "The token URL to be used for this flow.",
      "type": "string",
    },
  },
  "title": "Client CredentialsO Auth Flow",
  "type": "object",
};
const schema48 = {
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "additionalProperties": false,
  "description":
    "Defines configuration details for the OAuth 2.0 Device Code flow (RFC 8628).\n This flow is designed for input-constrained devices such as IoT devices,\n and CLI tools where the user authenticates on a separate device.",
  "patternProperties": {
    "^(device_authorization_url)$": {
      "default": "",
      "description": "The device authorization endpoint URL.",
      "type": "string",
    },
    "^(refresh_url)$": {
      "default": "",
      "description": "The URL to be used for obtaining refresh tokens.",
      "type": "string",
    },
    "^(token_url)$": {
      "default": "",
      "description": "The token URL to be used for this flow.",
      "type": "string",
    },
  },
  "properties": {
    "deviceAuthorizationUrl": {
      "default": "",
      "description": "The device authorization endpoint URL.",
      "type": "string",
    },
    "refreshUrl": {
      "default": "",
      "description": "The URL to be used for obtaining refresh tokens.",
      "type": "string",
    },
    "scopes": {
      "additionalProperties": { "type": "string" },
      "description": "The available scopes for the OAuth2 security scheme.",
      "propertyNames": { "type": "string" },
      "type": "object",
    },
    "tokenUrl": {
      "default": "",
      "description": "The token URL to be used for this flow.",
      "type": "string",
    },
  },
  "title": "Device CodeO Auth Flow",
  "type": "object",
};
const schema49 = {
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "additionalProperties": false,
  "description": "Deprecated: Use Authorization Code + PKCE instead.",
  "patternProperties": {
    "^(authorization_url)$": {
      "default": "",
      "description":
        "The authorization URL to be used for this flow. This MUST be in the\n form of a URL. The OAuth2 standard requires the use of TLS",
      "type": "string",
    },
    "^(refresh_url)$": {
      "default": "",
      "description":
        "The URL to be used for obtaining refresh tokens. This MUST be in the\n form of a URL. The OAuth2 standard requires the use of TLS.",
      "type": "string",
    },
  },
  "properties": {
    "authorizationUrl": {
      "default": "",
      "description":
        "The authorization URL to be used for this flow. This MUST be in the\n form of a URL. The OAuth2 standard requires the use of TLS",
      "type": "string",
    },
    "refreshUrl": {
      "default": "",
      "description":
        "The URL to be used for obtaining refresh tokens. This MUST be in the\n form of a URL. The OAuth2 standard requires the use of TLS.",
      "type": "string",
    },
    "scopes": {
      "additionalProperties": { "type": "string" },
      "description":
        "The available scopes for the OAuth2 security scheme. A map between the\n scope name and a short description for it. The map MAY be empty.",
      "propertyNames": { "type": "string" },
      "type": "object",
    },
  },
  "title": "ImplicitO Auth Flow",
  "type": "object",
};
const schema50 = {
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "additionalProperties": false,
  "description": "Deprecated: Use Authorization Code + PKCE or Device Code.",
  "patternProperties": {
    "^(refresh_url)$": {
      "default": "",
      "description":
        "The URL to be used for obtaining refresh tokens. This MUST be in the\n form of a URL. The OAuth2 standard requires the use of TLS.",
      "type": "string",
    },
    "^(token_url)$": {
      "default": "",
      "description":
        "The token URL to be used for this flow. This MUST be in the form of a URL.\n The OAuth2 standard requires the use of TLS.",
      "type": "string",
    },
  },
  "properties": {
    "refreshUrl": {
      "default": "",
      "description":
        "The URL to be used for obtaining refresh tokens. This MUST be in the\n form of a URL. The OAuth2 standard requires the use of TLS.",
      "type": "string",
    },
    "scopes": {
      "additionalProperties": { "type": "string" },
      "description":
        "The available scopes for the OAuth2 security scheme. A map between the\n scope name and a short description for it. The map MAY be empty.",
      "propertyNames": { "type": "string" },
      "type": "object",
    },
    "tokenUrl": {
      "default": "",
      "description":
        "The token URL to be used for this flow. This MUST be in the form of a URL.\n The OAuth2 standard requires the use of TLS.",
      "type": "string",
    },
  },
  "title": "PasswordO Auth Flow",
  "type": "object",
};
const pattern23 = new RegExp("^(authorization_code)$", "u");
const pattern24 = new RegExp("^(client_credentials)$", "u");
const pattern25 = new RegExp("^(device_code)$", "u");
const pattern26 = new RegExp("^(authorization_url)$", "u");
const pattern27 = new RegExp("^(pkce_required)$", "u");
const pattern28 = new RegExp("^(refresh_url)$", "u");
const pattern29 = new RegExp("^(token_url)$", "u");
const pattern38 = new RegExp("^(device_authorization_url)$", "u");

function validate31(
  data,
  { instancePath = "", parentData, parentDataProperty, rootData = data, dynamicAnchors = {} } = {},
) {
  let vErrors = null;
  let errors = 0;
  const evaluated0 = validate31.evaluated;
  if (evaluated0.dynamicProps) {
    evaluated0.props = undefined;
  }
  if (evaluated0.dynamicItems) {
    evaluated0.items = undefined;
  }
  if (data && typeof data == "object" && !Array.isArray(data)) {
    for (const key0 in data) {
      if (
        !((((((((key0 === "authorizationCode") || (key0 === "clientCredentials")) ||
          (key0 === "deviceCode")) || (key0 === "implicit")) || (key0 === "password")) ||
          (pattern23.test(key0))) || (pattern24.test(key0))) || (pattern25.test(key0)))
      ) {
        const err0 = {
          instancePath,
          schemaPath: "#/additionalProperties",
          keyword: "additionalProperties",
          params: { additionalProperty: key0 },
          message: "must NOT have additional properties",
        };
        if (vErrors === null) {
          vErrors = [err0];
        } else {
          vErrors.push(err0);
        }
        errors++;
      }
    }
    if (data.authorizationCode !== undefined) {
      let data0 = data.authorizationCode;
      if (data0 && typeof data0 == "object" && !Array.isArray(data0)) {
        for (const key1 in data0) {
          if (
            !(((((((((key1 === "authorizationUrl") || (key1 === "pkceRequired")) ||
              (key1 === "refreshUrl")) || (key1 === "scopes")) || (key1 === "tokenUrl")) ||
              (pattern26.test(key1))) || (pattern27.test(key1))) || (pattern28.test(key1))) ||
              (pattern29.test(key1)))
          ) {
            const err1 = {
              instancePath: instancePath + "/authorizationCode",
              schemaPath: "#/definitions/Authorization CodeO Auth Flow/additionalProperties",
              keyword: "additionalProperties",
              params: { additionalProperty: key1 },
              message: "must NOT have additional properties",
            };
            if (vErrors === null) {
              vErrors = [err1];
            } else {
              vErrors.push(err1);
            }
            errors++;
          }
        }
        if (data0.authorizationUrl !== undefined) {
          if (typeof data0.authorizationUrl !== "string") {
            const err2 = {
              instancePath: instancePath + "/authorizationCode/authorizationUrl",
              schemaPath:
                "#/definitions/Authorization CodeO Auth Flow/properties/authorizationUrl/type",
              keyword: "type",
              params: { type: "string" },
              message: "must be string",
            };
            if (vErrors === null) {
              vErrors = [err2];
            } else {
              vErrors.push(err2);
            }
            errors++;
          }
        }
        if (data0.pkceRequired !== undefined) {
          if (typeof data0.pkceRequired !== "boolean") {
            const err3 = {
              instancePath: instancePath + "/authorizationCode/pkceRequired",
              schemaPath:
                "#/definitions/Authorization CodeO Auth Flow/properties/pkceRequired/type",
              keyword: "type",
              params: { type: "boolean" },
              message: "must be boolean",
            };
            if (vErrors === null) {
              vErrors = [err3];
            } else {
              vErrors.push(err3);
            }
            errors++;
          }
        }
        if (data0.refreshUrl !== undefined) {
          if (typeof data0.refreshUrl !== "string") {
            const err4 = {
              instancePath: instancePath + "/authorizationCode/refreshUrl",
              schemaPath: "#/definitions/Authorization CodeO Auth Flow/properties/refreshUrl/type",
              keyword: "type",
              params: { type: "string" },
              message: "must be string",
            };
            if (vErrors === null) {
              vErrors = [err4];
            } else {
              vErrors.push(err4);
            }
            errors++;
          }
        }
        if (data0.scopes !== undefined) {
          let data4 = data0.scopes;
          if (data4 && typeof data4 == "object" && !Array.isArray(data4)) {
            for (const key2 in data4) {
              const _errs14 = errors;
              if (typeof key2 !== "string") {
                const err5 = {
                  instancePath: instancePath + "/authorizationCode/scopes",
                  schemaPath:
                    "#/definitions/Authorization CodeO Auth Flow/properties/scopes/propertyNames/type",
                  keyword: "type",
                  params: { type: "string" },
                  message: "must be string",
                  propertyName: key2,
                };
                if (vErrors === null) {
                  vErrors = [err5];
                } else {
                  vErrors.push(err5);
                }
                errors++;
              }
              var valid3 = _errs14 === errors;
              if (!valid3) {
                const err6 = {
                  instancePath: instancePath + "/authorizationCode/scopes",
                  schemaPath:
                    "#/definitions/Authorization CodeO Auth Flow/properties/scopes/propertyNames",
                  keyword: "propertyNames",
                  params: { propertyName: key2 },
                  message: "property name must be valid",
                };
                if (vErrors === null) {
                  vErrors = [err6];
                } else {
                  vErrors.push(err6);
                }
                errors++;
              }
            }
            for (const key3 in data4) {
              if (typeof data4[key3] !== "string") {
                const err7 = {
                  instancePath: instancePath + "/authorizationCode/scopes/" +
                    key3.replace(/~/g, "~0").replace(/\//g, "~1"),
                  schemaPath:
                    "#/definitions/Authorization CodeO Auth Flow/properties/scopes/additionalProperties/type",
                  keyword: "type",
                  params: { type: "string" },
                  message: "must be string",
                };
                if (vErrors === null) {
                  vErrors = [err7];
                } else {
                  vErrors.push(err7);
                }
                errors++;
              }
            }
          } else {
            const err8 = {
              instancePath: instancePath + "/authorizationCode/scopes",
              schemaPath: "#/definitions/Authorization CodeO Auth Flow/properties/scopes/type",
              keyword: "type",
              params: { type: "object" },
              message: "must be object",
            };
            if (vErrors === null) {
              vErrors = [err8];
            } else {
              vErrors.push(err8);
            }
            errors++;
          }
        }
        if (data0.tokenUrl !== undefined) {
          if (typeof data0.tokenUrl !== "string") {
            const err9 = {
              instancePath: instancePath + "/authorizationCode/tokenUrl",
              schemaPath: "#/definitions/Authorization CodeO Auth Flow/properties/tokenUrl/type",
              keyword: "type",
              params: { type: "string" },
              message: "must be string",
            };
            if (vErrors === null) {
              vErrors = [err9];
            } else {
              vErrors.push(err9);
            }
            errors++;
          }
        }
        for (const key4 in data0) {
          if (pattern26.test(key4)) {
            if (typeof data0[key4] !== "string") {
              const err10 = {
                instancePath: instancePath + "/authorizationCode/" +
                  key4.replace(/~/g, "~0").replace(/\//g, "~1"),
                schemaPath:
                  "#/definitions/Authorization CodeO Auth Flow/patternProperties/%5E(authorization_url)%24/type",
                keyword: "type",
                params: { type: "string" },
                message: "must be string",
              };
              if (vErrors === null) {
                vErrors = [err10];
              } else {
                vErrors.push(err10);
              }
              errors++;
            }
          }
        }
        for (const key5 in data0) {
          if (pattern27.test(key5)) {
            if (typeof data0[key5] !== "boolean") {
              const err11 = {
                instancePath: instancePath + "/authorizationCode/" +
                  key5.replace(/~/g, "~0").replace(/\//g, "~1"),
                schemaPath:
                  "#/definitions/Authorization CodeO Auth Flow/patternProperties/%5E(pkce_required)%24/type",
                keyword: "type",
                params: { type: "boolean" },
                message: "must be boolean",
              };
              if (vErrors === null) {
                vErrors = [err11];
              } else {
                vErrors.push(err11);
              }
              errors++;
            }
          }
        }
        for (const key6 in data0) {
          if (pattern28.test(key6)) {
            if (typeof data0[key6] !== "string") {
              const err12 = {
                instancePath: instancePath + "/authorizationCode/" +
                  key6.replace(/~/g, "~0").replace(/\//g, "~1"),
                schemaPath:
                  "#/definitions/Authorization CodeO Auth Flow/patternProperties/%5E(refresh_url)%24/type",
                keyword: "type",
                params: { type: "string" },
                message: "must be string",
              };
              if (vErrors === null) {
                vErrors = [err12];
              } else {
                vErrors.push(err12);
              }
              errors++;
            }
          }
        }
        for (const key7 in data0) {
          if (pattern29.test(key7)) {
            if (typeof data0[key7] !== "string") {
              const err13 = {
                instancePath: instancePath + "/authorizationCode/" +
                  key7.replace(/~/g, "~0").replace(/\//g, "~1"),
                schemaPath:
                  "#/definitions/Authorization CodeO Auth Flow/patternProperties/%5E(token_url)%24/type",
                keyword: "type",
                params: { type: "string" },
                message: "must be string",
              };
              if (vErrors === null) {
                vErrors = [err13];
              } else {
                vErrors.push(err13);
              }
              errors++;
            }
          }
        }
      } else {
        const err14 = {
          instancePath: instancePath + "/authorizationCode",
          schemaPath: "#/definitions/Authorization CodeO Auth Flow/type",
          keyword: "type",
          params: { type: "object" },
          message: "must be object",
        };
        if (vErrors === null) {
          vErrors = [err14];
        } else {
          vErrors.push(err14);
        }
        errors++;
      }
    }
    if (data.clientCredentials !== undefined) {
      let data11 = data.clientCredentials;
      if (data11 && typeof data11 == "object" && !Array.isArray(data11)) {
        for (const key8 in data11) {
          if (
            !(((((key8 === "refreshUrl") || (key8 === "scopes")) || (key8 === "tokenUrl")) ||
              (pattern28.test(key8))) || (pattern29.test(key8)))
          ) {
            const err15 = {
              instancePath: instancePath + "/clientCredentials",
              schemaPath: "#/definitions/Client CredentialsO Auth Flow/additionalProperties",
              keyword: "additionalProperties",
              params: { additionalProperty: key8 },
              message: "must NOT have additional properties",
            };
            if (vErrors === null) {
              vErrors = [err15];
            } else {
              vErrors.push(err15);
            }
            errors++;
          }
        }
        if (data11.refreshUrl !== undefined) {
          if (typeof data11.refreshUrl !== "string") {
            const err16 = {
              instancePath: instancePath + "/clientCredentials/refreshUrl",
              schemaPath: "#/definitions/Client CredentialsO Auth Flow/properties/refreshUrl/type",
              keyword: "type",
              params: { type: "string" },
              message: "must be string",
            };
            if (vErrors === null) {
              vErrors = [err16];
            } else {
              vErrors.push(err16);
            }
            errors++;
          }
        }
        if (data11.scopes !== undefined) {
          let data13 = data11.scopes;
          if (data13 && typeof data13 == "object" && !Array.isArray(data13)) {
            for (const key9 in data13) {
              const _errs37 = errors;
              if (typeof key9 !== "string") {
                const err17 = {
                  instancePath: instancePath + "/clientCredentials/scopes",
                  schemaPath:
                    "#/definitions/Client CredentialsO Auth Flow/properties/scopes/propertyNames/type",
                  keyword: "type",
                  params: { type: "string" },
                  message: "must be string",
                  propertyName: key9,
                };
                if (vErrors === null) {
                  vErrors = [err17];
                } else {
                  vErrors.push(err17);
                }
                errors++;
              }
              var valid8 = _errs37 === errors;
              if (!valid8) {
                const err18 = {
                  instancePath: instancePath + "/clientCredentials/scopes",
                  schemaPath:
                    "#/definitions/Client CredentialsO Auth Flow/properties/scopes/propertyNames",
                  keyword: "propertyNames",
                  params: { propertyName: key9 },
                  message: "property name must be valid",
                };
                if (vErrors === null) {
                  vErrors = [err18];
                } else {
                  vErrors.push(err18);
                }
                errors++;
              }
            }
            for (const key10 in data13) {
              if (typeof data13[key10] !== "string") {
                const err19 = {
                  instancePath: instancePath + "/clientCredentials/scopes/" +
                    key10.replace(/~/g, "~0").replace(/\//g, "~1"),
                  schemaPath:
                    "#/definitions/Client CredentialsO Auth Flow/properties/scopes/additionalProperties/type",
                  keyword: "type",
                  params: { type: "string" },
                  message: "must be string",
                };
                if (vErrors === null) {
                  vErrors = [err19];
                } else {
                  vErrors.push(err19);
                }
                errors++;
              }
            }
          } else {
            const err20 = {
              instancePath: instancePath + "/clientCredentials/scopes",
              schemaPath: "#/definitions/Client CredentialsO Auth Flow/properties/scopes/type",
              keyword: "type",
              params: { type: "object" },
              message: "must be object",
            };
            if (vErrors === null) {
              vErrors = [err20];
            } else {
              vErrors.push(err20);
            }
            errors++;
          }
        }
        if (data11.tokenUrl !== undefined) {
          if (typeof data11.tokenUrl !== "string") {
            const err21 = {
              instancePath: instancePath + "/clientCredentials/tokenUrl",
              schemaPath: "#/definitions/Client CredentialsO Auth Flow/properties/tokenUrl/type",
              keyword: "type",
              params: { type: "string" },
              message: "must be string",
            };
            if (vErrors === null) {
              vErrors = [err21];
            } else {
              vErrors.push(err21);
            }
            errors++;
          }
        }
        for (const key11 in data11) {
          if (pattern28.test(key11)) {
            if (typeof data11[key11] !== "string") {
              const err22 = {
                instancePath: instancePath + "/clientCredentials/" +
                  key11.replace(/~/g, "~0").replace(/\//g, "~1"),
                schemaPath:
                  "#/definitions/Client CredentialsO Auth Flow/patternProperties/%5E(refresh_url)%24/type",
                keyword: "type",
                params: { type: "string" },
                message: "must be string",
              };
              if (vErrors === null) {
                vErrors = [err22];
              } else {
                vErrors.push(err22);
              }
              errors++;
            }
          }
        }
        for (const key12 in data11) {
          if (pattern29.test(key12)) {
            if (typeof data11[key12] !== "string") {
              const err23 = {
                instancePath: instancePath + "/clientCredentials/" +
                  key12.replace(/~/g, "~0").replace(/\//g, "~1"),
                schemaPath:
                  "#/definitions/Client CredentialsO Auth Flow/patternProperties/%5E(token_url)%24/type",
                keyword: "type",
                params: { type: "string" },
                message: "must be string",
              };
              if (vErrors === null) {
                vErrors = [err23];
              } else {
                vErrors.push(err23);
              }
              errors++;
            }
          }
        }
      } else {
        const err24 = {
          instancePath: instancePath + "/clientCredentials",
          schemaPath: "#/definitions/Client CredentialsO Auth Flow/type",
          keyword: "type",
          params: { type: "object" },
          message: "must be object",
        };
        if (vErrors === null) {
          vErrors = [err24];
        } else {
          vErrors.push(err24);
        }
        errors++;
      }
    }
    if (data.deviceCode !== undefined) {
      let data18 = data.deviceCode;
      if (data18 && typeof data18 == "object" && !Array.isArray(data18)) {
        for (const key13 in data18) {
          if (
            !(((((((key13 === "deviceAuthorizationUrl") || (key13 === "refreshUrl")) ||
              (key13 === "scopes")) || (key13 === "tokenUrl")) || (pattern38.test(key13))) ||
              (pattern28.test(key13))) || (pattern29.test(key13)))
          ) {
            const err25 = {
              instancePath: instancePath + "/deviceCode",
              schemaPath: "#/definitions/Device CodeO Auth Flow/additionalProperties",
              keyword: "additionalProperties",
              params: { additionalProperty: key13 },
              message: "must NOT have additional properties",
            };
            if (vErrors === null) {
              vErrors = [err25];
            } else {
              vErrors.push(err25);
            }
            errors++;
          }
        }
        if (data18.deviceAuthorizationUrl !== undefined) {
          if (typeof data18.deviceAuthorizationUrl !== "string") {
            const err26 = {
              instancePath: instancePath + "/deviceCode/deviceAuthorizationUrl",
              schemaPath:
                "#/definitions/Device CodeO Auth Flow/properties/deviceAuthorizationUrl/type",
              keyword: "type",
              params: { type: "string" },
              message: "must be string",
            };
            if (vErrors === null) {
              vErrors = [err26];
            } else {
              vErrors.push(err26);
            }
            errors++;
          }
        }
        if (data18.refreshUrl !== undefined) {
          if (typeof data18.refreshUrl !== "string") {
            const err27 = {
              instancePath: instancePath + "/deviceCode/refreshUrl",
              schemaPath: "#/definitions/Device CodeO Auth Flow/properties/refreshUrl/type",
              keyword: "type",
              params: { type: "string" },
              message: "must be string",
            };
            if (vErrors === null) {
              vErrors = [err27];
            } else {
              vErrors.push(err27);
            }
            errors++;
          }
        }
        if (data18.scopes !== undefined) {
          let data21 = data18.scopes;
          if (data21 && typeof data21 == "object" && !Array.isArray(data21)) {
            for (const key14 in data21) {
              const _errs58 = errors;
              if (typeof key14 !== "string") {
                const err28 = {
                  instancePath: instancePath + "/deviceCode/scopes",
                  schemaPath:
                    "#/definitions/Device CodeO Auth Flow/properties/scopes/propertyNames/type",
                  keyword: "type",
                  params: { type: "string" },
                  message: "must be string",
                  propertyName: key14,
                };
                if (vErrors === null) {
                  vErrors = [err28];
                } else {
                  vErrors.push(err28);
                }
                errors++;
              }
              var valid13 = _errs58 === errors;
              if (!valid13) {
                const err29 = {
                  instancePath: instancePath + "/deviceCode/scopes",
                  schemaPath:
                    "#/definitions/Device CodeO Auth Flow/properties/scopes/propertyNames",
                  keyword: "propertyNames",
                  params: { propertyName: key14 },
                  message: "property name must be valid",
                };
                if (vErrors === null) {
                  vErrors = [err29];
                } else {
                  vErrors.push(err29);
                }
                errors++;
              }
            }
            for (const key15 in data21) {
              if (typeof data21[key15] !== "string") {
                const err30 = {
                  instancePath: instancePath + "/deviceCode/scopes/" +
                    key15.replace(/~/g, "~0").replace(/\//g, "~1"),
                  schemaPath:
                    "#/definitions/Device CodeO Auth Flow/properties/scopes/additionalProperties/type",
                  keyword: "type",
                  params: { type: "string" },
                  message: "must be string",
                };
                if (vErrors === null) {
                  vErrors = [err30];
                } else {
                  vErrors.push(err30);
                }
                errors++;
              }
            }
          } else {
            const err31 = {
              instancePath: instancePath + "/deviceCode/scopes",
              schemaPath: "#/definitions/Device CodeO Auth Flow/properties/scopes/type",
              keyword: "type",
              params: { type: "object" },
              message: "must be object",
            };
            if (vErrors === null) {
              vErrors = [err31];
            } else {
              vErrors.push(err31);
            }
            errors++;
          }
        }
        if (data18.tokenUrl !== undefined) {
          if (typeof data18.tokenUrl !== "string") {
            const err32 = {
              instancePath: instancePath + "/deviceCode/tokenUrl",
              schemaPath: "#/definitions/Device CodeO Auth Flow/properties/tokenUrl/type",
              keyword: "type",
              params: { type: "string" },
              message: "must be string",
            };
            if (vErrors === null) {
              vErrors = [err32];
            } else {
              vErrors.push(err32);
            }
            errors++;
          }
        }
        for (const key16 in data18) {
          if (pattern38.test(key16)) {
            if (typeof data18[key16] !== "string") {
              const err33 = {
                instancePath: instancePath + "/deviceCode/" +
                  key16.replace(/~/g, "~0").replace(/\//g, "~1"),
                schemaPath:
                  "#/definitions/Device CodeO Auth Flow/patternProperties/%5E(device_authorization_url)%24/type",
                keyword: "type",
                params: { type: "string" },
                message: "must be string",
              };
              if (vErrors === null) {
                vErrors = [err33];
              } else {
                vErrors.push(err33);
              }
              errors++;
            }
          }
        }
        for (const key17 in data18) {
          if (pattern28.test(key17)) {
            if (typeof data18[key17] !== "string") {
              const err34 = {
                instancePath: instancePath + "/deviceCode/" +
                  key17.replace(/~/g, "~0").replace(/\//g, "~1"),
                schemaPath:
                  "#/definitions/Device CodeO Auth Flow/patternProperties/%5E(refresh_url)%24/type",
                keyword: "type",
                params: { type: "string" },
                message: "must be string",
              };
              if (vErrors === null) {
                vErrors = [err34];
              } else {
                vErrors.push(err34);
              }
              errors++;
            }
          }
        }
        for (const key18 in data18) {
          if (pattern29.test(key18)) {
            if (typeof data18[key18] !== "string") {
              const err35 = {
                instancePath: instancePath + "/deviceCode/" +
                  key18.replace(/~/g, "~0").replace(/\//g, "~1"),
                schemaPath:
                  "#/definitions/Device CodeO Auth Flow/patternProperties/%5E(token_url)%24/type",
                keyword: "type",
                params: { type: "string" },
                message: "must be string",
              };
              if (vErrors === null) {
                vErrors = [err35];
              } else {
                vErrors.push(err35);
              }
              errors++;
            }
          }
        }
      } else {
        const err36 = {
          instancePath: instancePath + "/deviceCode",
          schemaPath: "#/definitions/Device CodeO Auth Flow/type",
          keyword: "type",
          params: { type: "object" },
          message: "must be object",
        };
        if (vErrors === null) {
          vErrors = [err36];
        } else {
          vErrors.push(err36);
        }
        errors++;
      }
    }
    if (data.implicit !== undefined) {
      let data27 = data.implicit;
      if (data27 && typeof data27 == "object" && !Array.isArray(data27)) {
        for (const key19 in data27) {
          if (
            !(((((key19 === "authorizationUrl") || (key19 === "refreshUrl")) ||
              (key19 === "scopes")) || (pattern26.test(key19))) || (pattern28.test(key19)))
          ) {
            const err37 = {
              instancePath: instancePath + "/implicit",
              schemaPath: "#/definitions/ImplicitO Auth Flow/additionalProperties",
              keyword: "additionalProperties",
              params: { additionalProperty: key19 },
              message: "must NOT have additional properties",
            };
            if (vErrors === null) {
              vErrors = [err37];
            } else {
              vErrors.push(err37);
            }
            errors++;
          }
        }
        if (data27.authorizationUrl !== undefined) {
          if (typeof data27.authorizationUrl !== "string") {
            const err38 = {
              instancePath: instancePath + "/implicit/authorizationUrl",
              schemaPath: "#/definitions/ImplicitO Auth Flow/properties/authorizationUrl/type",
              keyword: "type",
              params: { type: "string" },
              message: "must be string",
            };
            if (vErrors === null) {
              vErrors = [err38];
            } else {
              vErrors.push(err38);
            }
            errors++;
          }
        }
        if (data27.refreshUrl !== undefined) {
          if (typeof data27.refreshUrl !== "string") {
            const err39 = {
              instancePath: instancePath + "/implicit/refreshUrl",
              schemaPath: "#/definitions/ImplicitO Auth Flow/properties/refreshUrl/type",
              keyword: "type",
              params: { type: "string" },
              message: "must be string",
            };
            if (vErrors === null) {
              vErrors = [err39];
            } else {
              vErrors.push(err39);
            }
            errors++;
          }
        }
        if (data27.scopes !== undefined) {
          let data30 = data27.scopes;
          if (data30 && typeof data30 == "object" && !Array.isArray(data30)) {
            for (const key20 in data30) {
              const _errs81 = errors;
              if (typeof key20 !== "string") {
                const err40 = {
                  instancePath: instancePath + "/implicit/scopes",
                  schemaPath:
                    "#/definitions/ImplicitO Auth Flow/properties/scopes/propertyNames/type",
                  keyword: "type",
                  params: { type: "string" },
                  message: "must be string",
                  propertyName: key20,
                };
                if (vErrors === null) {
                  vErrors = [err40];
                } else {
                  vErrors.push(err40);
                }
                errors++;
              }
              var valid18 = _errs81 === errors;
              if (!valid18) {
                const err41 = {
                  instancePath: instancePath + "/implicit/scopes",
                  schemaPath: "#/definitions/ImplicitO Auth Flow/properties/scopes/propertyNames",
                  keyword: "propertyNames",
                  params: { propertyName: key20 },
                  message: "property name must be valid",
                };
                if (vErrors === null) {
                  vErrors = [err41];
                } else {
                  vErrors.push(err41);
                }
                errors++;
              }
            }
            for (const key21 in data30) {
              if (typeof data30[key21] !== "string") {
                const err42 = {
                  instancePath: instancePath + "/implicit/scopes/" +
                    key21.replace(/~/g, "~0").replace(/\//g, "~1"),
                  schemaPath:
                    "#/definitions/ImplicitO Auth Flow/properties/scopes/additionalProperties/type",
                  keyword: "type",
                  params: { type: "string" },
                  message: "must be string",
                };
                if (vErrors === null) {
                  vErrors = [err42];
                } else {
                  vErrors.push(err42);
                }
                errors++;
              }
            }
          } else {
            const err43 = {
              instancePath: instancePath + "/implicit/scopes",
              schemaPath: "#/definitions/ImplicitO Auth Flow/properties/scopes/type",
              keyword: "type",
              params: { type: "object" },
              message: "must be object",
            };
            if (vErrors === null) {
              vErrors = [err43];
            } else {
              vErrors.push(err43);
            }
            errors++;
          }
        }
        for (const key22 in data27) {
          if (pattern26.test(key22)) {
            if (typeof data27[key22] !== "string") {
              const err44 = {
                instancePath: instancePath + "/implicit/" +
                  key22.replace(/~/g, "~0").replace(/\//g, "~1"),
                schemaPath:
                  "#/definitions/ImplicitO Auth Flow/patternProperties/%5E(authorization_url)%24/type",
                keyword: "type",
                params: { type: "string" },
                message: "must be string",
              };
              if (vErrors === null) {
                vErrors = [err44];
              } else {
                vErrors.push(err44);
              }
              errors++;
            }
          }
        }
        for (const key23 in data27) {
          if (pattern28.test(key23)) {
            if (typeof data27[key23] !== "string") {
              const err45 = {
                instancePath: instancePath + "/implicit/" +
                  key23.replace(/~/g, "~0").replace(/\//g, "~1"),
                schemaPath:
                  "#/definitions/ImplicitO Auth Flow/patternProperties/%5E(refresh_url)%24/type",
                keyword: "type",
                params: { type: "string" },
                message: "must be string",
              };
              if (vErrors === null) {
                vErrors = [err45];
              } else {
                vErrors.push(err45);
              }
              errors++;
            }
          }
        }
      } else {
        const err46 = {
          instancePath: instancePath + "/implicit",
          schemaPath: "#/definitions/ImplicitO Auth Flow/type",
          keyword: "type",
          params: { type: "object" },
          message: "must be object",
        };
        if (vErrors === null) {
          vErrors = [err46];
        } else {
          vErrors.push(err46);
        }
        errors++;
      }
    }
    if (data.password !== undefined) {
      let data34 = data.password;
      if (data34 && typeof data34 == "object" && !Array.isArray(data34)) {
        for (const key24 in data34) {
          if (
            !(((((key24 === "refreshUrl") || (key24 === "scopes")) || (key24 === "tokenUrl")) ||
              (pattern28.test(key24))) || (pattern29.test(key24)))
          ) {
            const err47 = {
              instancePath: instancePath + "/password",
              schemaPath: "#/definitions/PasswordO Auth Flow/additionalProperties",
              keyword: "additionalProperties",
              params: { additionalProperty: key24 },
              message: "must NOT have additional properties",
            };
            if (vErrors === null) {
              vErrors = [err47];
            } else {
              vErrors.push(err47);
            }
            errors++;
          }
        }
        if (data34.refreshUrl !== undefined) {
          if (typeof data34.refreshUrl !== "string") {
            const err48 = {
              instancePath: instancePath + "/password/refreshUrl",
              schemaPath: "#/definitions/PasswordO Auth Flow/properties/refreshUrl/type",
              keyword: "type",
              params: { type: "string" },
              message: "must be string",
            };
            if (vErrors === null) {
              vErrors = [err48];
            } else {
              vErrors.push(err48);
            }
            errors++;
          }
        }
        if (data34.scopes !== undefined) {
          let data36 = data34.scopes;
          if (data36 && typeof data36 == "object" && !Array.isArray(data36)) {
            for (const key25 in data36) {
              const _errs98 = errors;
              if (typeof key25 !== "string") {
                const err49 = {
                  instancePath: instancePath + "/password/scopes",
                  schemaPath:
                    "#/definitions/PasswordO Auth Flow/properties/scopes/propertyNames/type",
                  keyword: "type",
                  params: { type: "string" },
                  message: "must be string",
                  propertyName: key25,
                };
                if (vErrors === null) {
                  vErrors = [err49];
                } else {
                  vErrors.push(err49);
                }
                errors++;
              }
              var valid23 = _errs98 === errors;
              if (!valid23) {
                const err50 = {
                  instancePath: instancePath + "/password/scopes",
                  schemaPath: "#/definitions/PasswordO Auth Flow/properties/scopes/propertyNames",
                  keyword: "propertyNames",
                  params: { propertyName: key25 },
                  message: "property name must be valid",
                };
                if (vErrors === null) {
                  vErrors = [err50];
                } else {
                  vErrors.push(err50);
                }
                errors++;
              }
            }
            for (const key26 in data36) {
              if (typeof data36[key26] !== "string") {
                const err51 = {
                  instancePath: instancePath + "/password/scopes/" +
                    key26.replace(/~/g, "~0").replace(/\//g, "~1"),
                  schemaPath:
                    "#/definitions/PasswordO Auth Flow/properties/scopes/additionalProperties/type",
                  keyword: "type",
                  params: { type: "string" },
                  message: "must be string",
                };
                if (vErrors === null) {
                  vErrors = [err51];
                } else {
                  vErrors.push(err51);
                }
                errors++;
              }
            }
          } else {
            const err52 = {
              instancePath: instancePath + "/password/scopes",
              schemaPath: "#/definitions/PasswordO Auth Flow/properties/scopes/type",
              keyword: "type",
              params: { type: "object" },
              message: "must be object",
            };
            if (vErrors === null) {
              vErrors = [err52];
            } else {
              vErrors.push(err52);
            }
            errors++;
          }
        }
        if (data34.tokenUrl !== undefined) {
          if (typeof data34.tokenUrl !== "string") {
            const err53 = {
              instancePath: instancePath + "/password/tokenUrl",
              schemaPath: "#/definitions/PasswordO Auth Flow/properties/tokenUrl/type",
              keyword: "type",
              params: { type: "string" },
              message: "must be string",
            };
            if (vErrors === null) {
              vErrors = [err53];
            } else {
              vErrors.push(err53);
            }
            errors++;
          }
        }
        for (const key27 in data34) {
          if (pattern28.test(key27)) {
            if (typeof data34[key27] !== "string") {
              const err54 = {
                instancePath: instancePath + "/password/" +
                  key27.replace(/~/g, "~0").replace(/\//g, "~1"),
                schemaPath:
                  "#/definitions/PasswordO Auth Flow/patternProperties/%5E(refresh_url)%24/type",
                keyword: "type",
                params: { type: "string" },
                message: "must be string",
              };
              if (vErrors === null) {
                vErrors = [err54];
              } else {
                vErrors.push(err54);
              }
              errors++;
            }
          }
        }
        for (const key28 in data34) {
          if (pattern29.test(key28)) {
            if (typeof data34[key28] !== "string") {
              const err55 = {
                instancePath: instancePath + "/password/" +
                  key28.replace(/~/g, "~0").replace(/\//g, "~1"),
                schemaPath:
                  "#/definitions/PasswordO Auth Flow/patternProperties/%5E(token_url)%24/type",
                keyword: "type",
                params: { type: "string" },
                message: "must be string",
              };
              if (vErrors === null) {
                vErrors = [err55];
              } else {
                vErrors.push(err55);
              }
              errors++;
            }
          }
        }
      } else {
        const err56 = {
          instancePath: instancePath + "/password",
          schemaPath: "#/definitions/PasswordO Auth Flow/type",
          keyword: "type",
          params: { type: "object" },
          message: "must be object",
        };
        if (vErrors === null) {
          vErrors = [err56];
        } else {
          vErrors.push(err56);
        }
        errors++;
      }
    }
    for (const key29 in data) {
      if (pattern23.test(key29)) {
        let data41 = data[key29];
        if (data41 && typeof data41 == "object" && !Array.isArray(data41)) {
          for (const key30 in data41) {
            if (
              !(((((((((key30 === "authorizationUrl") || (key30 === "pkceRequired")) ||
                (key30 === "refreshUrl")) || (key30 === "scopes")) || (key30 === "tokenUrl")) ||
                (pattern26.test(key30))) || (pattern27.test(key30))) || (pattern28.test(key30))) ||
                (pattern29.test(key30)))
            ) {
              const err57 = {
                instancePath: instancePath + "/" + key29.replace(/~/g, "~0").replace(/\//g, "~1"),
                schemaPath: "#/definitions/Authorization CodeO Auth Flow/additionalProperties",
                keyword: "additionalProperties",
                params: { additionalProperty: key30 },
                message: "must NOT have additional properties",
              };
              if (vErrors === null) {
                vErrors = [err57];
              } else {
                vErrors.push(err57);
              }
              errors++;
            }
          }
          if (data41.authorizationUrl !== undefined) {
            if (typeof data41.authorizationUrl !== "string") {
              const err58 = {
                instancePath: instancePath + "/" + key29.replace(/~/g, "~0").replace(/\//g, "~1") +
                  "/authorizationUrl",
                schemaPath:
                  "#/definitions/Authorization CodeO Auth Flow/properties/authorizationUrl/type",
                keyword: "type",
                params: { type: "string" },
                message: "must be string",
              };
              if (vErrors === null) {
                vErrors = [err58];
              } else {
                vErrors.push(err58);
              }
              errors++;
            }
          }
          if (data41.pkceRequired !== undefined) {
            if (typeof data41.pkceRequired !== "boolean") {
              const err59 = {
                instancePath: instancePath + "/" + key29.replace(/~/g, "~0").replace(/\//g, "~1") +
                  "/pkceRequired",
                schemaPath:
                  "#/definitions/Authorization CodeO Auth Flow/properties/pkceRequired/type",
                keyword: "type",
                params: { type: "boolean" },
                message: "must be boolean",
              };
              if (vErrors === null) {
                vErrors = [err59];
              } else {
                vErrors.push(err59);
              }
              errors++;
            }
          }
          if (data41.refreshUrl !== undefined) {
            if (typeof data41.refreshUrl !== "string") {
              const err60 = {
                instancePath: instancePath + "/" + key29.replace(/~/g, "~0").replace(/\//g, "~1") +
                  "/refreshUrl",
                schemaPath:
                  "#/definitions/Authorization CodeO Auth Flow/properties/refreshUrl/type",
                keyword: "type",
                params: { type: "string" },
                message: "must be string",
              };
              if (vErrors === null) {
                vErrors = [err60];
              } else {
                vErrors.push(err60);
              }
              errors++;
            }
          }
          if (data41.scopes !== undefined) {
            let data45 = data41.scopes;
            if (data45 && typeof data45 == "object" && !Array.isArray(data45)) {
              for (const key31 in data45) {
                const _errs121 = errors;
                if (typeof key31 !== "string") {
                  const err61 = {
                    instancePath: instancePath + "/" +
                      key29.replace(/~/g, "~0").replace(/\//g, "~1") + "/scopes",
                    schemaPath:
                      "#/definitions/Authorization CodeO Auth Flow/properties/scopes/propertyNames/type",
                    keyword: "type",
                    params: { type: "string" },
                    message: "must be string",
                    propertyName: key31,
                  };
                  if (vErrors === null) {
                    vErrors = [err61];
                  } else {
                    vErrors.push(err61);
                  }
                  errors++;
                }
                var valid29 = _errs121 === errors;
                if (!valid29) {
                  const err62 = {
                    instancePath: instancePath + "/" +
                      key29.replace(/~/g, "~0").replace(/\//g, "~1") + "/scopes",
                    schemaPath:
                      "#/definitions/Authorization CodeO Auth Flow/properties/scopes/propertyNames",
                    keyword: "propertyNames",
                    params: { propertyName: key31 },
                    message: "property name must be valid",
                  };
                  if (vErrors === null) {
                    vErrors = [err62];
                  } else {
                    vErrors.push(err62);
                  }
                  errors++;
                }
              }
              for (const key32 in data45) {
                if (typeof data45[key32] !== "string") {
                  const err63 = {
                    instancePath: instancePath + "/" +
                      key29.replace(/~/g, "~0").replace(/\//g, "~1") + "/scopes/" +
                      key32.replace(/~/g, "~0").replace(/\//g, "~1"),
                    schemaPath:
                      "#/definitions/Authorization CodeO Auth Flow/properties/scopes/additionalProperties/type",
                    keyword: "type",
                    params: { type: "string" },
                    message: "must be string",
                  };
                  if (vErrors === null) {
                    vErrors = [err63];
                  } else {
                    vErrors.push(err63);
                  }
                  errors++;
                }
              }
            } else {
              const err64 = {
                instancePath: instancePath + "/" + key29.replace(/~/g, "~0").replace(/\//g, "~1") +
                  "/scopes",
                schemaPath: "#/definitions/Authorization CodeO Auth Flow/properties/scopes/type",
                keyword: "type",
                params: { type: "object" },
                message: "must be object",
              };
              if (vErrors === null) {
                vErrors = [err64];
              } else {
                vErrors.push(err64);
              }
              errors++;
            }
          }
          if (data41.tokenUrl !== undefined) {
            if (typeof data41.tokenUrl !== "string") {
              const err65 = {
                instancePath: instancePath + "/" + key29.replace(/~/g, "~0").replace(/\//g, "~1") +
                  "/tokenUrl",
                schemaPath: "#/definitions/Authorization CodeO Auth Flow/properties/tokenUrl/type",
                keyword: "type",
                params: { type: "string" },
                message: "must be string",
              };
              if (vErrors === null) {
                vErrors = [err65];
              } else {
                vErrors.push(err65);
              }
              errors++;
            }
          }
          for (const key33 in data41) {
            if (pattern26.test(key33)) {
              if (typeof data41[key33] !== "string") {
                const err66 = {
                  instancePath: instancePath + "/" +
                    key29.replace(/~/g, "~0").replace(/\//g, "~1") + "/" +
                    key33.replace(/~/g, "~0").replace(/\//g, "~1"),
                  schemaPath:
                    "#/definitions/Authorization CodeO Auth Flow/patternProperties/%5E(authorization_url)%24/type",
                  keyword: "type",
                  params: { type: "string" },
                  message: "must be string",
                };
                if (vErrors === null) {
                  vErrors = [err66];
                } else {
                  vErrors.push(err66);
                }
                errors++;
              }
            }
          }
          for (const key34 in data41) {
            if (pattern27.test(key34)) {
              if (typeof data41[key34] !== "boolean") {
                const err67 = {
                  instancePath: instancePath + "/" +
                    key29.replace(/~/g, "~0").replace(/\//g, "~1") + "/" +
                    key34.replace(/~/g, "~0").replace(/\//g, "~1"),
                  schemaPath:
                    "#/definitions/Authorization CodeO Auth Flow/patternProperties/%5E(pkce_required)%24/type",
                  keyword: "type",
                  params: { type: "boolean" },
                  message: "must be boolean",
                };
                if (vErrors === null) {
                  vErrors = [err67];
                } else {
                  vErrors.push(err67);
                }
                errors++;
              }
            }
          }
          for (const key35 in data41) {
            if (pattern28.test(key35)) {
              if (typeof data41[key35] !== "string") {
                const err68 = {
                  instancePath: instancePath + "/" +
                    key29.replace(/~/g, "~0").replace(/\//g, "~1") + "/" +
                    key35.replace(/~/g, "~0").replace(/\//g, "~1"),
                  schemaPath:
                    "#/definitions/Authorization CodeO Auth Flow/patternProperties/%5E(refresh_url)%24/type",
                  keyword: "type",
                  params: { type: "string" },
                  message: "must be string",
                };
                if (vErrors === null) {
                  vErrors = [err68];
                } else {
                  vErrors.push(err68);
                }
                errors++;
              }
            }
          }
          for (const key36 in data41) {
            if (pattern29.test(key36)) {
              if (typeof data41[key36] !== "string") {
                const err69 = {
                  instancePath: instancePath + "/" +
                    key29.replace(/~/g, "~0").replace(/\//g, "~1") + "/" +
                    key36.replace(/~/g, "~0").replace(/\//g, "~1"),
                  schemaPath:
                    "#/definitions/Authorization CodeO Auth Flow/patternProperties/%5E(token_url)%24/type",
                  keyword: "type",
                  params: { type: "string" },
                  message: "must be string",
                };
                if (vErrors === null) {
                  vErrors = [err69];
                } else {
                  vErrors.push(err69);
                }
                errors++;
              }
            }
          }
        } else {
          const err70 = {
            instancePath: instancePath + "/" + key29.replace(/~/g, "~0").replace(/\//g, "~1"),
            schemaPath: "#/definitions/Authorization CodeO Auth Flow/type",
            keyword: "type",
            params: { type: "object" },
            message: "must be object",
          };
          if (vErrors === null) {
            vErrors = [err70];
          } else {
            vErrors.push(err70);
          }
          errors++;
        }
      }
    }
    for (const key37 in data) {
      if (pattern24.test(key37)) {
        let data52 = data[key37];
        if (data52 && typeof data52 == "object" && !Array.isArray(data52)) {
          for (const key38 in data52) {
            if (
              !(((((key38 === "refreshUrl") || (key38 === "scopes")) || (key38 === "tokenUrl")) ||
                (pattern28.test(key38))) || (pattern29.test(key38)))
            ) {
              const err71 = {
                instancePath: instancePath + "/" + key37.replace(/~/g, "~0").replace(/\//g, "~1"),
                schemaPath: "#/definitions/Client CredentialsO Auth Flow/additionalProperties",
                keyword: "additionalProperties",
                params: { additionalProperty: key38 },
                message: "must NOT have additional properties",
              };
              if (vErrors === null) {
                vErrors = [err71];
              } else {
                vErrors.push(err71);
              }
              errors++;
            }
          }
          if (data52.refreshUrl !== undefined) {
            if (typeof data52.refreshUrl !== "string") {
              const err72 = {
                instancePath: instancePath + "/" + key37.replace(/~/g, "~0").replace(/\//g, "~1") +
                  "/refreshUrl",
                schemaPath:
                  "#/definitions/Client CredentialsO Auth Flow/properties/refreshUrl/type",
                keyword: "type",
                params: { type: "string" },
                message: "must be string",
              };
              if (vErrors === null) {
                vErrors = [err72];
              } else {
                vErrors.push(err72);
              }
              errors++;
            }
          }
          if (data52.scopes !== undefined) {
            let data54 = data52.scopes;
            if (data54 && typeof data54 == "object" && !Array.isArray(data54)) {
              for (const key39 in data54) {
                const _errs144 = errors;
                if (typeof key39 !== "string") {
                  const err73 = {
                    instancePath: instancePath + "/" +
                      key37.replace(/~/g, "~0").replace(/\//g, "~1") + "/scopes",
                    schemaPath:
                      "#/definitions/Client CredentialsO Auth Flow/properties/scopes/propertyNames/type",
                    keyword: "type",
                    params: { type: "string" },
                    message: "must be string",
                    propertyName: key39,
                  };
                  if (vErrors === null) {
                    vErrors = [err73];
                  } else {
                    vErrors.push(err73);
                  }
                  errors++;
                }
                var valid34 = _errs144 === errors;
                if (!valid34) {
                  const err74 = {
                    instancePath: instancePath + "/" +
                      key37.replace(/~/g, "~0").replace(/\//g, "~1") + "/scopes",
                    schemaPath:
                      "#/definitions/Client CredentialsO Auth Flow/properties/scopes/propertyNames",
                    keyword: "propertyNames",
                    params: { propertyName: key39 },
                    message: "property name must be valid",
                  };
                  if (vErrors === null) {
                    vErrors = [err74];
                  } else {
                    vErrors.push(err74);
                  }
                  errors++;
                }
              }
              for (const key40 in data54) {
                if (typeof data54[key40] !== "string") {
                  const err75 = {
                    instancePath: instancePath + "/" +
                      key37.replace(/~/g, "~0").replace(/\//g, "~1") + "/scopes/" +
                      key40.replace(/~/g, "~0").replace(/\//g, "~1"),
                    schemaPath:
                      "#/definitions/Client CredentialsO Auth Flow/properties/scopes/additionalProperties/type",
                    keyword: "type",
                    params: { type: "string" },
                    message: "must be string",
                  };
                  if (vErrors === null) {
                    vErrors = [err75];
                  } else {
                    vErrors.push(err75);
                  }
                  errors++;
                }
              }
            } else {
              const err76 = {
                instancePath: instancePath + "/" + key37.replace(/~/g, "~0").replace(/\//g, "~1") +
                  "/scopes",
                schemaPath: "#/definitions/Client CredentialsO Auth Flow/properties/scopes/type",
                keyword: "type",
                params: { type: "object" },
                message: "must be object",
              };
              if (vErrors === null) {
                vErrors = [err76];
              } else {
                vErrors.push(err76);
              }
              errors++;
            }
          }
          if (data52.tokenUrl !== undefined) {
            if (typeof data52.tokenUrl !== "string") {
              const err77 = {
                instancePath: instancePath + "/" + key37.replace(/~/g, "~0").replace(/\//g, "~1") +
                  "/tokenUrl",
                schemaPath: "#/definitions/Client CredentialsO Auth Flow/properties/tokenUrl/type",
                keyword: "type",
                params: { type: "string" },
                message: "must be string",
              };
              if (vErrors === null) {
                vErrors = [err77];
              } else {
                vErrors.push(err77);
              }
              errors++;
            }
          }
          for (const key41 in data52) {
            if (pattern28.test(key41)) {
              if (typeof data52[key41] !== "string") {
                const err78 = {
                  instancePath: instancePath + "/" +
                    key37.replace(/~/g, "~0").replace(/\//g, "~1") + "/" +
                    key41.replace(/~/g, "~0").replace(/\//g, "~1"),
                  schemaPath:
                    "#/definitions/Client CredentialsO Auth Flow/patternProperties/%5E(refresh_url)%24/type",
                  keyword: "type",
                  params: { type: "string" },
                  message: "must be string",
                };
                if (vErrors === null) {
                  vErrors = [err78];
                } else {
                  vErrors.push(err78);
                }
                errors++;
              }
            }
          }
          for (const key42 in data52) {
            if (pattern29.test(key42)) {
              if (typeof data52[key42] !== "string") {
                const err79 = {
                  instancePath: instancePath + "/" +
                    key37.replace(/~/g, "~0").replace(/\//g, "~1") + "/" +
                    key42.replace(/~/g, "~0").replace(/\//g, "~1"),
                  schemaPath:
                    "#/definitions/Client CredentialsO Auth Flow/patternProperties/%5E(token_url)%24/type",
                  keyword: "type",
                  params: { type: "string" },
                  message: "must be string",
                };
                if (vErrors === null) {
                  vErrors = [err79];
                } else {
                  vErrors.push(err79);
                }
                errors++;
              }
            }
          }
        } else {
          const err80 = {
            instancePath: instancePath + "/" + key37.replace(/~/g, "~0").replace(/\//g, "~1"),
            schemaPath: "#/definitions/Client CredentialsO Auth Flow/type",
            keyword: "type",
            params: { type: "object" },
            message: "must be object",
          };
          if (vErrors === null) {
            vErrors = [err80];
          } else {
            vErrors.push(err80);
          }
          errors++;
        }
      }
    }
    for (const key43 in data) {
      if (pattern25.test(key43)) {
        let data59 = data[key43];
        if (data59 && typeof data59 == "object" && !Array.isArray(data59)) {
          for (const key44 in data59) {
            if (
              !(((((((key44 === "deviceAuthorizationUrl") || (key44 === "refreshUrl")) ||
                (key44 === "scopes")) || (key44 === "tokenUrl")) || (pattern38.test(key44))) ||
                (pattern28.test(key44))) || (pattern29.test(key44)))
            ) {
              const err81 = {
                instancePath: instancePath + "/" + key43.replace(/~/g, "~0").replace(/\//g, "~1"),
                schemaPath: "#/definitions/Device CodeO Auth Flow/additionalProperties",
                keyword: "additionalProperties",
                params: { additionalProperty: key44 },
                message: "must NOT have additional properties",
              };
              if (vErrors === null) {
                vErrors = [err81];
              } else {
                vErrors.push(err81);
              }
              errors++;
            }
          }
          if (data59.deviceAuthorizationUrl !== undefined) {
            if (typeof data59.deviceAuthorizationUrl !== "string") {
              const err82 = {
                instancePath: instancePath + "/" + key43.replace(/~/g, "~0").replace(/\//g, "~1") +
                  "/deviceAuthorizationUrl",
                schemaPath:
                  "#/definitions/Device CodeO Auth Flow/properties/deviceAuthorizationUrl/type",
                keyword: "type",
                params: { type: "string" },
                message: "must be string",
              };
              if (vErrors === null) {
                vErrors = [err82];
              } else {
                vErrors.push(err82);
              }
              errors++;
            }
          }
          if (data59.refreshUrl !== undefined) {
            if (typeof data59.refreshUrl !== "string") {
              const err83 = {
                instancePath: instancePath + "/" + key43.replace(/~/g, "~0").replace(/\//g, "~1") +
                  "/refreshUrl",
                schemaPath: "#/definitions/Device CodeO Auth Flow/properties/refreshUrl/type",
                keyword: "type",
                params: { type: "string" },
                message: "must be string",
              };
              if (vErrors === null) {
                vErrors = [err83];
              } else {
                vErrors.push(err83);
              }
              errors++;
            }
          }
          if (data59.scopes !== undefined) {
            let data62 = data59.scopes;
            if (data62 && typeof data62 == "object" && !Array.isArray(data62)) {
              for (const key45 in data62) {
                const _errs165 = errors;
                if (typeof key45 !== "string") {
                  const err84 = {
                    instancePath: instancePath + "/" +
                      key43.replace(/~/g, "~0").replace(/\//g, "~1") + "/scopes",
                    schemaPath:
                      "#/definitions/Device CodeO Auth Flow/properties/scopes/propertyNames/type",
                    keyword: "type",
                    params: { type: "string" },
                    message: "must be string",
                    propertyName: key45,
                  };
                  if (vErrors === null) {
                    vErrors = [err84];
                  } else {
                    vErrors.push(err84);
                  }
                  errors++;
                }
                var valid39 = _errs165 === errors;
                if (!valid39) {
                  const err85 = {
                    instancePath: instancePath + "/" +
                      key43.replace(/~/g, "~0").replace(/\//g, "~1") + "/scopes",
                    schemaPath:
                      "#/definitions/Device CodeO Auth Flow/properties/scopes/propertyNames",
                    keyword: "propertyNames",
                    params: { propertyName: key45 },
                    message: "property name must be valid",
                  };
                  if (vErrors === null) {
                    vErrors = [err85];
                  } else {
                    vErrors.push(err85);
                  }
                  errors++;
                }
              }
              for (const key46 in data62) {
                if (typeof data62[key46] !== "string") {
                  const err86 = {
                    instancePath: instancePath + "/" +
                      key43.replace(/~/g, "~0").replace(/\//g, "~1") + "/scopes/" +
                      key46.replace(/~/g, "~0").replace(/\//g, "~1"),
                    schemaPath:
                      "#/definitions/Device CodeO Auth Flow/properties/scopes/additionalProperties/type",
                    keyword: "type",
                    params: { type: "string" },
                    message: "must be string",
                  };
                  if (vErrors === null) {
                    vErrors = [err86];
                  } else {
                    vErrors.push(err86);
                  }
                  errors++;
                }
              }
            } else {
              const err87 = {
                instancePath: instancePath + "/" + key43.replace(/~/g, "~0").replace(/\//g, "~1") +
                  "/scopes",
                schemaPath: "#/definitions/Device CodeO Auth Flow/properties/scopes/type",
                keyword: "type",
                params: { type: "object" },
                message: "must be object",
              };
              if (vErrors === null) {
                vErrors = [err87];
              } else {
                vErrors.push(err87);
              }
              errors++;
            }
          }
          if (data59.tokenUrl !== undefined) {
            if (typeof data59.tokenUrl !== "string") {
              const err88 = {
                instancePath: instancePath + "/" + key43.replace(/~/g, "~0").replace(/\//g, "~1") +
                  "/tokenUrl",
                schemaPath: "#/definitions/Device CodeO Auth Flow/properties/tokenUrl/type",
                keyword: "type",
                params: { type: "string" },
                message: "must be string",
              };
              if (vErrors === null) {
                vErrors = [err88];
              } else {
                vErrors.push(err88);
              }
              errors++;
            }
          }
          for (const key47 in data59) {
            if (pattern38.test(key47)) {
              if (typeof data59[key47] !== "string") {
                const err89 = {
                  instancePath: instancePath + "/" +
                    key43.replace(/~/g, "~0").replace(/\//g, "~1") + "/" +
                    key47.replace(/~/g, "~0").replace(/\//g, "~1"),
                  schemaPath:
                    "#/definitions/Device CodeO Auth Flow/patternProperties/%5E(device_authorization_url)%24/type",
                  keyword: "type",
                  params: { type: "string" },
                  message: "must be string",
                };
                if (vErrors === null) {
                  vErrors = [err89];
                } else {
                  vErrors.push(err89);
                }
                errors++;
              }
            }
          }
          for (const key48 in data59) {
            if (pattern28.test(key48)) {
              if (typeof data59[key48] !== "string") {
                const err90 = {
                  instancePath: instancePath + "/" +
                    key43.replace(/~/g, "~0").replace(/\//g, "~1") + "/" +
                    key48.replace(/~/g, "~0").replace(/\//g, "~1"),
                  schemaPath:
                    "#/definitions/Device CodeO Auth Flow/patternProperties/%5E(refresh_url)%24/type",
                  keyword: "type",
                  params: { type: "string" },
                  message: "must be string",
                };
                if (vErrors === null) {
                  vErrors = [err90];
                } else {
                  vErrors.push(err90);
                }
                errors++;
              }
            }
          }
          for (const key49 in data59) {
            if (pattern29.test(key49)) {
              if (typeof data59[key49] !== "string") {
                const err91 = {
                  instancePath: instancePath + "/" +
                    key43.replace(/~/g, "~0").replace(/\//g, "~1") + "/" +
                    key49.replace(/~/g, "~0").replace(/\//g, "~1"),
                  schemaPath:
                    "#/definitions/Device CodeO Auth Flow/patternProperties/%5E(token_url)%24/type",
                  keyword: "type",
                  params: { type: "string" },
                  message: "must be string",
                };
                if (vErrors === null) {
                  vErrors = [err91];
                } else {
                  vErrors.push(err91);
                }
                errors++;
              }
            }
          }
        } else {
          const err92 = {
            instancePath: instancePath + "/" + key43.replace(/~/g, "~0").replace(/\//g, "~1"),
            schemaPath: "#/definitions/Device CodeO Auth Flow/type",
            keyword: "type",
            params: { type: "object" },
            message: "must be object",
          };
          if (vErrors === null) {
            vErrors = [err92];
          } else {
            vErrors.push(err92);
          }
          errors++;
        }
      }
    }
  } else {
    const err93 = {
      instancePath,
      schemaPath: "#/type",
      keyword: "type",
      params: { type: "object" },
      message: "must be object",
    };
    if (vErrors === null) {
      vErrors = [err93];
    } else {
      vErrors.push(err93);
    }
    errors++;
  }
  validate31.errors = vErrors;
  return errors === 0;
}
validate31.evaluated = { "props": true, "dynamicProps": false, "dynamicItems": false };

function validate30(
  data,
  { instancePath = "", parentData, parentDataProperty, rootData = data, dynamicAnchors = {} } = {},
) {
  let vErrors = null;
  let errors = 0;
  const evaluated0 = validate30.evaluated;
  if (evaluated0.dynamicProps) {
    evaluated0.props = undefined;
  }
  if (evaluated0.dynamicItems) {
    evaluated0.items = undefined;
  }
  if (data && typeof data == "object" && !Array.isArray(data)) {
    for (const key0 in data) {
      if (
        !((((key0 === "description") || (key0 === "flows")) || (key0 === "oauth2MetadataUrl")) ||
          (pattern22.test(key0)))
      ) {
        const err0 = {
          instancePath,
          schemaPath: "#/additionalProperties",
          keyword: "additionalProperties",
          params: { additionalProperty: key0 },
          message: "must NOT have additional properties",
        };
        if (vErrors === null) {
          vErrors = [err0];
        } else {
          vErrors.push(err0);
        }
        errors++;
      }
    }
    if (data.description !== undefined) {
      if (typeof data.description !== "string") {
        const err1 = {
          instancePath: instancePath + "/description",
          schemaPath: "#/properties/description/type",
          keyword: "type",
          params: { type: "string" },
          message: "must be string",
        };
        if (vErrors === null) {
          vErrors = [err1];
        } else {
          vErrors.push(err1);
        }
        errors++;
      }
    }
    if (data.flows !== undefined) {
      if (
        !(validate31(data.flows, {
          instancePath: instancePath + "/flows",
          parentData: data,
          parentDataProperty: "flows",
          rootData,
          dynamicAnchors,
        }))
      ) {
        vErrors = vErrors === null ? validate31.errors : vErrors.concat(validate31.errors);
        errors = vErrors.length;
      }
    }
    if (data.oauth2MetadataUrl !== undefined) {
      if (typeof data.oauth2MetadataUrl !== "string") {
        const err2 = {
          instancePath: instancePath + "/oauth2MetadataUrl",
          schemaPath: "#/properties/oauth2MetadataUrl/type",
          keyword: "type",
          params: { type: "string" },
          message: "must be string",
        };
        if (vErrors === null) {
          vErrors = [err2];
        } else {
          vErrors.push(err2);
        }
        errors++;
      }
    }
    for (const key1 in data) {
      if (pattern22.test(key1)) {
        if (typeof data[key1] !== "string") {
          const err3 = {
            instancePath: instancePath + "/" + key1.replace(/~/g, "~0").replace(/\//g, "~1"),
            schemaPath: "#/patternProperties/%5E(oauth2_metadata_url)%24/type",
            keyword: "type",
            params: { type: "string" },
            message: "must be string",
          };
          if (vErrors === null) {
            vErrors = [err3];
          } else {
            vErrors.push(err3);
          }
          errors++;
        }
      }
    }
  } else {
    const err4 = {
      instancePath,
      schemaPath: "#/type",
      keyword: "type",
      params: { type: "object" },
      message: "must be object",
    };
    if (vErrors === null) {
      vErrors = [err4];
    } else {
      vErrors.push(err4);
    }
    errors++;
  }
  validate30.errors = vErrors;
  return errors === 0;
}
validate30.evaluated = { "props": true, "dynamicProps": false, "dynamicItems": false };

function validate29(
  data,
  { instancePath = "", parentData, parentDataProperty, rootData = data, dynamicAnchors = {} } = {},
) {
  let vErrors = null;
  let errors = 0;
  const evaluated0 = validate29.evaluated;
  if (evaluated0.dynamicProps) {
    evaluated0.props = undefined;
  }
  if (evaluated0.dynamicItems) {
    evaluated0.items = undefined;
  }
  if (data && typeof data == "object" && !Array.isArray(data)) {
    for (const key0 in data) {
      if (
        !((((((((((key0 === "apiKeySecurityScheme") || (key0 === "httpAuthSecurityScheme")) ||
          (key0 === "mtlsSecurityScheme")) || (key0 === "oauth2SecurityScheme")) ||
          (key0 === "openIdConnectSecurityScheme")) || (pattern15.test(key0))) ||
          (pattern16.test(key0))) || (pattern17.test(key0))) || (pattern18.test(key0))) ||
          (pattern19.test(key0)))
      ) {
        const err0 = {
          instancePath,
          schemaPath: "#/additionalProperties",
          keyword: "additionalProperties",
          params: { additionalProperty: key0 },
          message: "must NOT have additional properties",
        };
        if (vErrors === null) {
          vErrors = [err0];
        } else {
          vErrors.push(err0);
        }
        errors++;
      }
    }
    if (data.apiKeySecurityScheme !== undefined) {
      let data0 = data.apiKeySecurityScheme;
      if (data0 && typeof data0 == "object" && !Array.isArray(data0)) {
        for (const key1 in data0) {
          if (!(((key1 === "description") || (key1 === "location")) || (key1 === "name"))) {
            const err1 = {
              instancePath: instancePath + "/apiKeySecurityScheme",
              schemaPath: "#/definitions/API Key Security Scheme/additionalProperties",
              keyword: "additionalProperties",
              params: { additionalProperty: key1 },
              message: "must NOT have additional properties",
            };
            if (vErrors === null) {
              vErrors = [err1];
            } else {
              vErrors.push(err1);
            }
            errors++;
          }
        }
        if (data0.description !== undefined) {
          if (typeof data0.description !== "string") {
            const err2 = {
              instancePath: instancePath + "/apiKeySecurityScheme/description",
              schemaPath: "#/definitions/API Key Security Scheme/properties/description/type",
              keyword: "type",
              params: { type: "string" },
              message: "must be string",
            };
            if (vErrors === null) {
              vErrors = [err2];
            } else {
              vErrors.push(err2);
            }
            errors++;
          }
        }
        if (data0.location !== undefined) {
          if (typeof data0.location !== "string") {
            const err3 = {
              instancePath: instancePath + "/apiKeySecurityScheme/location",
              schemaPath: "#/definitions/API Key Security Scheme/properties/location/type",
              keyword: "type",
              params: { type: "string" },
              message: "must be string",
            };
            if (vErrors === null) {
              vErrors = [err3];
            } else {
              vErrors.push(err3);
            }
            errors++;
          }
        }
        if (data0.name !== undefined) {
          if (typeof data0.name !== "string") {
            const err4 = {
              instancePath: instancePath + "/apiKeySecurityScheme/name",
              schemaPath: "#/definitions/API Key Security Scheme/properties/name/type",
              keyword: "type",
              params: { type: "string" },
              message: "must be string",
            };
            if (vErrors === null) {
              vErrors = [err4];
            } else {
              vErrors.push(err4);
            }
            errors++;
          }
        }
      } else {
        const err5 = {
          instancePath: instancePath + "/apiKeySecurityScheme",
          schemaPath: "#/definitions/API Key Security Scheme/type",
          keyword: "type",
          params: { type: "object" },
          message: "must be object",
        };
        if (vErrors === null) {
          vErrors = [err5];
        } else {
          vErrors.push(err5);
        }
        errors++;
      }
    }
    if (data.httpAuthSecurityScheme !== undefined) {
      let data4 = data.httpAuthSecurityScheme;
      if (data4 && typeof data4 == "object" && !Array.isArray(data4)) {
        for (const key2 in data4) {
          if (
            !((((key2 === "bearerFormat") || (key2 === "description")) || (key2 === "scheme")) ||
              (pattern20.test(key2)))
          ) {
            const err6 = {
              instancePath: instancePath + "/httpAuthSecurityScheme",
              schemaPath: "#/definitions/HTTP Auth Security Scheme/additionalProperties",
              keyword: "additionalProperties",
              params: { additionalProperty: key2 },
              message: "must NOT have additional properties",
            };
            if (vErrors === null) {
              vErrors = [err6];
            } else {
              vErrors.push(err6);
            }
            errors++;
          }
        }
        if (data4.bearerFormat !== undefined) {
          if (typeof data4.bearerFormat !== "string") {
            const err7 = {
              instancePath: instancePath + "/httpAuthSecurityScheme/bearerFormat",
              schemaPath: "#/definitions/HTTP Auth Security Scheme/properties/bearerFormat/type",
              keyword: "type",
              params: { type: "string" },
              message: "must be string",
            };
            if (vErrors === null) {
              vErrors = [err7];
            } else {
              vErrors.push(err7);
            }
            errors++;
          }
        }
        if (data4.description !== undefined) {
          if (typeof data4.description !== "string") {
            const err8 = {
              instancePath: instancePath + "/httpAuthSecurityScheme/description",
              schemaPath: "#/definitions/HTTP Auth Security Scheme/properties/description/type",
              keyword: "type",
              params: { type: "string" },
              message: "must be string",
            };
            if (vErrors === null) {
              vErrors = [err8];
            } else {
              vErrors.push(err8);
            }
            errors++;
          }
        }
        if (data4.scheme !== undefined) {
          if (typeof data4.scheme !== "string") {
            const err9 = {
              instancePath: instancePath + "/httpAuthSecurityScheme/scheme",
              schemaPath: "#/definitions/HTTP Auth Security Scheme/properties/scheme/type",
              keyword: "type",
              params: { type: "string" },
              message: "must be string",
            };
            if (vErrors === null) {
              vErrors = [err9];
            } else {
              vErrors.push(err9);
            }
            errors++;
          }
        }
        for (const key3 in data4) {
          if (pattern20.test(key3)) {
            if (typeof data4[key3] !== "string") {
              const err10 = {
                instancePath: instancePath + "/httpAuthSecurityScheme/" +
                  key3.replace(/~/g, "~0").replace(/\//g, "~1"),
                schemaPath:
                  "#/definitions/HTTP Auth Security Scheme/patternProperties/%5E(bearer_format)%24/type",
                keyword: "type",
                params: { type: "string" },
                message: "must be string",
              };
              if (vErrors === null) {
                vErrors = [err10];
              } else {
                vErrors.push(err10);
              }
              errors++;
            }
          }
        }
      } else {
        const err11 = {
          instancePath: instancePath + "/httpAuthSecurityScheme",
          schemaPath: "#/definitions/HTTP Auth Security Scheme/type",
          keyword: "type",
          params: { type: "object" },
          message: "must be object",
        };
        if (vErrors === null) {
          vErrors = [err11];
        } else {
          vErrors.push(err11);
        }
        errors++;
      }
    }
    if (data.mtlsSecurityScheme !== undefined) {
      let data9 = data.mtlsSecurityScheme;
      if (data9 && typeof data9 == "object" && !Array.isArray(data9)) {
        for (const key4 in data9) {
          if (!(key4 === "description")) {
            const err12 = {
              instancePath: instancePath + "/mtlsSecurityScheme",
              schemaPath: "#/definitions/Mutual Tls Security Scheme/additionalProperties",
              keyword: "additionalProperties",
              params: { additionalProperty: key4 },
              message: "must NOT have additional properties",
            };
            if (vErrors === null) {
              vErrors = [err12];
            } else {
              vErrors.push(err12);
            }
            errors++;
          }
        }
        if (data9.description !== undefined) {
          if (typeof data9.description !== "string") {
            const err13 = {
              instancePath: instancePath + "/mtlsSecurityScheme/description",
              schemaPath: "#/definitions/Mutual Tls Security Scheme/properties/description/type",
              keyword: "type",
              params: { type: "string" },
              message: "must be string",
            };
            if (vErrors === null) {
              vErrors = [err13];
            } else {
              vErrors.push(err13);
            }
            errors++;
          }
        }
      } else {
        const err14 = {
          instancePath: instancePath + "/mtlsSecurityScheme",
          schemaPath: "#/definitions/Mutual Tls Security Scheme/type",
          keyword: "type",
          params: { type: "object" },
          message: "must be object",
        };
        if (vErrors === null) {
          vErrors = [err14];
        } else {
          vErrors.push(err14);
        }
        errors++;
      }
    }
    if (data.oauth2SecurityScheme !== undefined) {
      if (
        !(validate30(data.oauth2SecurityScheme, {
          instancePath: instancePath + "/oauth2SecurityScheme",
          parentData: data,
          parentDataProperty: "oauth2SecurityScheme",
          rootData,
          dynamicAnchors,
        }))
      ) {
        vErrors = vErrors === null ? validate30.errors : vErrors.concat(validate30.errors);
        errors = vErrors.length;
      }
    }
    if (data.openIdConnectSecurityScheme !== undefined) {
      let data12 = data.openIdConnectSecurityScheme;
      if (data12 && typeof data12 == "object" && !Array.isArray(data12)) {
        for (const key5 in data12) {
          if (
            !(((key5 === "description") || (key5 === "openIdConnectUrl")) || (pattern74.test(key5)))
          ) {
            const err15 = {
              instancePath: instancePath + "/openIdConnectSecurityScheme",
              schemaPath: "#/definitions/Open Id Connect Security Scheme/additionalProperties",
              keyword: "additionalProperties",
              params: { additionalProperty: key5 },
              message: "must NOT have additional properties",
            };
            if (vErrors === null) {
              vErrors = [err15];
            } else {
              vErrors.push(err15);
            }
            errors++;
          }
        }
        if (data12.description !== undefined) {
          if (typeof data12.description !== "string") {
            const err16 = {
              instancePath: instancePath + "/openIdConnectSecurityScheme/description",
              schemaPath:
                "#/definitions/Open Id Connect Security Scheme/properties/description/type",
              keyword: "type",
              params: { type: "string" },
              message: "must be string",
            };
            if (vErrors === null) {
              vErrors = [err16];
            } else {
              vErrors.push(err16);
            }
            errors++;
          }
        }
        if (data12.openIdConnectUrl !== undefined) {
          if (typeof data12.openIdConnectUrl !== "string") {
            const err17 = {
              instancePath: instancePath + "/openIdConnectSecurityScheme/openIdConnectUrl",
              schemaPath:
                "#/definitions/Open Id Connect Security Scheme/properties/openIdConnectUrl/type",
              keyword: "type",
              params: { type: "string" },
              message: "must be string",
            };
            if (vErrors === null) {
              vErrors = [err17];
            } else {
              vErrors.push(err17);
            }
            errors++;
          }
        }
        for (const key6 in data12) {
          if (pattern74.test(key6)) {
            if (typeof data12[key6] !== "string") {
              const err18 = {
                instancePath: instancePath + "/openIdConnectSecurityScheme/" +
                  key6.replace(/~/g, "~0").replace(/\//g, "~1"),
                schemaPath:
                  "#/definitions/Open Id Connect Security Scheme/patternProperties/%5E(open_id_connect_url)%24/type",
                keyword: "type",
                params: { type: "string" },
                message: "must be string",
              };
              if (vErrors === null) {
                vErrors = [err18];
              } else {
                vErrors.push(err18);
              }
              errors++;
            }
          }
        }
      } else {
        const err19 = {
          instancePath: instancePath + "/openIdConnectSecurityScheme",
          schemaPath: "#/definitions/Open Id Connect Security Scheme/type",
          keyword: "type",
          params: { type: "object" },
          message: "must be object",
        };
        if (vErrors === null) {
          vErrors = [err19];
        } else {
          vErrors.push(err19);
        }
        errors++;
      }
    }
    for (const key7 in data) {
      if (pattern15.test(key7)) {
        let data16 = data[key7];
        if (data16 && typeof data16 == "object" && !Array.isArray(data16)) {
          for (const key8 in data16) {
            if (!(((key8 === "description") || (key8 === "location")) || (key8 === "name"))) {
              const err20 = {
                instancePath: instancePath + "/" + key7.replace(/~/g, "~0").replace(/\//g, "~1"),
                schemaPath: "#/definitions/API Key Security Scheme/additionalProperties",
                keyword: "additionalProperties",
                params: { additionalProperty: key8 },
                message: "must NOT have additional properties",
              };
              if (vErrors === null) {
                vErrors = [err20];
              } else {
                vErrors.push(err20);
              }
              errors++;
            }
          }
          if (data16.description !== undefined) {
            if (typeof data16.description !== "string") {
              const err21 = {
                instancePath: instancePath + "/" + key7.replace(/~/g, "~0").replace(/\//g, "~1") +
                  "/description",
                schemaPath: "#/definitions/API Key Security Scheme/properties/description/type",
                keyword: "type",
                params: { type: "string" },
                message: "must be string",
              };
              if (vErrors === null) {
                vErrors = [err21];
              } else {
                vErrors.push(err21);
              }
              errors++;
            }
          }
          if (data16.location !== undefined) {
            if (typeof data16.location !== "string") {
              const err22 = {
                instancePath: instancePath + "/" + key7.replace(/~/g, "~0").replace(/\//g, "~1") +
                  "/location",
                schemaPath: "#/definitions/API Key Security Scheme/properties/location/type",
                keyword: "type",
                params: { type: "string" },
                message: "must be string",
              };
              if (vErrors === null) {
                vErrors = [err22];
              } else {
                vErrors.push(err22);
              }
              errors++;
            }
          }
          if (data16.name !== undefined) {
            if (typeof data16.name !== "string") {
              const err23 = {
                instancePath: instancePath + "/" + key7.replace(/~/g, "~0").replace(/\//g, "~1") +
                  "/name",
                schemaPath: "#/definitions/API Key Security Scheme/properties/name/type",
                keyword: "type",
                params: { type: "string" },
                message: "must be string",
              };
              if (vErrors === null) {
                vErrors = [err23];
              } else {
                vErrors.push(err23);
              }
              errors++;
            }
          }
        } else {
          const err24 = {
            instancePath: instancePath + "/" + key7.replace(/~/g, "~0").replace(/\//g, "~1"),
            schemaPath: "#/definitions/API Key Security Scheme/type",
            keyword: "type",
            params: { type: "object" },
            message: "must be object",
          };
          if (vErrors === null) {
            vErrors = [err24];
          } else {
            vErrors.push(err24);
          }
          errors++;
        }
      }
    }
    for (const key9 in data) {
      if (pattern16.test(key9)) {
        let data20 = data[key9];
        if (data20 && typeof data20 == "object" && !Array.isArray(data20)) {
          for (const key10 in data20) {
            if (
              !((((key10 === "bearerFormat") || (key10 === "description")) ||
                (key10 === "scheme")) || (pattern20.test(key10)))
            ) {
              const err25 = {
                instancePath: instancePath + "/" + key9.replace(/~/g, "~0").replace(/\//g, "~1"),
                schemaPath: "#/definitions/HTTP Auth Security Scheme/additionalProperties",
                keyword: "additionalProperties",
                params: { additionalProperty: key10 },
                message: "must NOT have additional properties",
              };
              if (vErrors === null) {
                vErrors = [err25];
              } else {
                vErrors.push(err25);
              }
              errors++;
            }
          }
          if (data20.bearerFormat !== undefined) {
            if (typeof data20.bearerFormat !== "string") {
              const err26 = {
                instancePath: instancePath + "/" + key9.replace(/~/g, "~0").replace(/\//g, "~1") +
                  "/bearerFormat",
                schemaPath: "#/definitions/HTTP Auth Security Scheme/properties/bearerFormat/type",
                keyword: "type",
                params: { type: "string" },
                message: "must be string",
              };
              if (vErrors === null) {
                vErrors = [err26];
              } else {
                vErrors.push(err26);
              }
              errors++;
            }
          }
          if (data20.description !== undefined) {
            if (typeof data20.description !== "string") {
              const err27 = {
                instancePath: instancePath + "/" + key9.replace(/~/g, "~0").replace(/\//g, "~1") +
                  "/description",
                schemaPath: "#/definitions/HTTP Auth Security Scheme/properties/description/type",
                keyword: "type",
                params: { type: "string" },
                message: "must be string",
              };
              if (vErrors === null) {
                vErrors = [err27];
              } else {
                vErrors.push(err27);
              }
              errors++;
            }
          }
          if (data20.scheme !== undefined) {
            if (typeof data20.scheme !== "string") {
              const err28 = {
                instancePath: instancePath + "/" + key9.replace(/~/g, "~0").replace(/\//g, "~1") +
                  "/scheme",
                schemaPath: "#/definitions/HTTP Auth Security Scheme/properties/scheme/type",
                keyword: "type",
                params: { type: "string" },
                message: "must be string",
              };
              if (vErrors === null) {
                vErrors = [err28];
              } else {
                vErrors.push(err28);
              }
              errors++;
            }
          }
          for (const key11 in data20) {
            if (pattern20.test(key11)) {
              if (typeof data20[key11] !== "string") {
                const err29 = {
                  instancePath: instancePath + "/" + key9.replace(/~/g, "~0").replace(/\//g, "~1") +
                    "/" + key11.replace(/~/g, "~0").replace(/\//g, "~1"),
                  schemaPath:
                    "#/definitions/HTTP Auth Security Scheme/patternProperties/%5E(bearer_format)%24/type",
                  keyword: "type",
                  params: { type: "string" },
                  message: "must be string",
                };
                if (vErrors === null) {
                  vErrors = [err29];
                } else {
                  vErrors.push(err29);
                }
                errors++;
              }
            }
          }
        } else {
          const err30 = {
            instancePath: instancePath + "/" + key9.replace(/~/g, "~0").replace(/\//g, "~1"),
            schemaPath: "#/definitions/HTTP Auth Security Scheme/type",
            keyword: "type",
            params: { type: "object" },
            message: "must be object",
          };
          if (vErrors === null) {
            vErrors = [err30];
          } else {
            vErrors.push(err30);
          }
          errors++;
        }
      }
    }
    for (const key12 in data) {
      if (pattern17.test(key12)) {
        let data25 = data[key12];
        if (data25 && typeof data25 == "object" && !Array.isArray(data25)) {
          for (const key13 in data25) {
            if (!(key13 === "description")) {
              const err31 = {
                instancePath: instancePath + "/" + key12.replace(/~/g, "~0").replace(/\//g, "~1"),
                schemaPath: "#/definitions/Mutual Tls Security Scheme/additionalProperties",
                keyword: "additionalProperties",
                params: { additionalProperty: key13 },
                message: "must NOT have additional properties",
              };
              if (vErrors === null) {
                vErrors = [err31];
              } else {
                vErrors.push(err31);
              }
              errors++;
            }
          }
          if (data25.description !== undefined) {
            if (typeof data25.description !== "string") {
              const err32 = {
                instancePath: instancePath + "/" + key12.replace(/~/g, "~0").replace(/\//g, "~1") +
                  "/description",
                schemaPath: "#/definitions/Mutual Tls Security Scheme/properties/description/type",
                keyword: "type",
                params: { type: "string" },
                message: "must be string",
              };
              if (vErrors === null) {
                vErrors = [err32];
              } else {
                vErrors.push(err32);
              }
              errors++;
            }
          }
        } else {
          const err33 = {
            instancePath: instancePath + "/" + key12.replace(/~/g, "~0").replace(/\//g, "~1"),
            schemaPath: "#/definitions/Mutual Tls Security Scheme/type",
            keyword: "type",
            params: { type: "object" },
            message: "must be object",
          };
          if (vErrors === null) {
            vErrors = [err33];
          } else {
            vErrors.push(err33);
          }
          errors++;
        }
      }
    }
    for (const key14 in data) {
      if (pattern18.test(key14)) {
        if (
          !(validate30(data[key14], {
            instancePath: instancePath + "/" + key14.replace(/~/g, "~0").replace(/\//g, "~1"),
            parentData: data,
            parentDataProperty: key14,
            rootData,
            dynamicAnchors,
          }))
        ) {
          vErrors = vErrors === null ? validate30.errors : vErrors.concat(validate30.errors);
          errors = vErrors.length;
        }
      }
    }
    for (const key15 in data) {
      if (pattern19.test(key15)) {
        let data28 = data[key15];
        if (data28 && typeof data28 == "object" && !Array.isArray(data28)) {
          for (const key16 in data28) {
            if (
              !(((key16 === "description") || (key16 === "openIdConnectUrl")) ||
                (pattern74.test(key16)))
            ) {
              const err34 = {
                instancePath: instancePath + "/" + key15.replace(/~/g, "~0").replace(/\//g, "~1"),
                schemaPath: "#/definitions/Open Id Connect Security Scheme/additionalProperties",
                keyword: "additionalProperties",
                params: { additionalProperty: key16 },
                message: "must NOT have additional properties",
              };
              if (vErrors === null) {
                vErrors = [err34];
              } else {
                vErrors.push(err34);
              }
              errors++;
            }
          }
          if (data28.description !== undefined) {
            if (typeof data28.description !== "string") {
              const err35 = {
                instancePath: instancePath + "/" + key15.replace(/~/g, "~0").replace(/\//g, "~1") +
                  "/description",
                schemaPath:
                  "#/definitions/Open Id Connect Security Scheme/properties/description/type",
                keyword: "type",
                params: { type: "string" },
                message: "must be string",
              };
              if (vErrors === null) {
                vErrors = [err35];
              } else {
                vErrors.push(err35);
              }
              errors++;
            }
          }
          if (data28.openIdConnectUrl !== undefined) {
            if (typeof data28.openIdConnectUrl !== "string") {
              const err36 = {
                instancePath: instancePath + "/" + key15.replace(/~/g, "~0").replace(/\//g, "~1") +
                  "/openIdConnectUrl",
                schemaPath:
                  "#/definitions/Open Id Connect Security Scheme/properties/openIdConnectUrl/type",
                keyword: "type",
                params: { type: "string" },
                message: "must be string",
              };
              if (vErrors === null) {
                vErrors = [err36];
              } else {
                vErrors.push(err36);
              }
              errors++;
            }
          }
          for (const key17 in data28) {
            if (pattern74.test(key17)) {
              if (typeof data28[key17] !== "string") {
                const err37 = {
                  instancePath: instancePath + "/" +
                    key15.replace(/~/g, "~0").replace(/\//g, "~1") + "/" +
                    key17.replace(/~/g, "~0").replace(/\//g, "~1"),
                  schemaPath:
                    "#/definitions/Open Id Connect Security Scheme/patternProperties/%5E(open_id_connect_url)%24/type",
                  keyword: "type",
                  params: { type: "string" },
                  message: "must be string",
                };
                if (vErrors === null) {
                  vErrors = [err37];
                } else {
                  vErrors.push(err37);
                }
                errors++;
              }
            }
          }
        } else {
          const err38 = {
            instancePath: instancePath + "/" + key15.replace(/~/g, "~0").replace(/\//g, "~1"),
            schemaPath: "#/definitions/Open Id Connect Security Scheme/type",
            keyword: "type",
            params: { type: "object" },
            message: "must be object",
          };
          if (vErrors === null) {
            vErrors = [err38];
          } else {
            vErrors.push(err38);
          }
          errors++;
        }
      }
    }
  } else {
    const err39 = {
      instancePath,
      schemaPath: "#/type",
      keyword: "type",
      params: { type: "object" },
      message: "must be object",
    };
    if (vErrors === null) {
      vErrors = [err39];
    } else {
      vErrors.push(err39);
    }
    errors++;
  }
  validate29.errors = vErrors;
  return errors === 0;
}
validate29.evaluated = { "props": true, "dynamicProps": false, "dynamicItems": false };

const schema59 = {
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "additionalProperties": false,
  "description":
    "AgentCardSignature represents a JWS signature of an AgentCard.\n This follows the JSON format of an RFC 7515 JSON Web Signature (JWS).",
  "properties": {
    "header": {
      "$ref": "#/definitions/Struct",
      "description": "The unprotected JWS header values.",
    },
    "protected": {
      "default": "",
      "description":
        "(-- api-linter: core::0140::reserved-words=disabled\n     aip.dev/not-precedent: Backwards compatibility --)\n Required. The protected JWS header for the signature. This is always a\n base64url-encoded JSON object.",
      "type": "string",
    },
    "signature": {
      "default": "",
      "description": "Required. The computed signature, base64url-encoded.",
      "type": "string",
    },
  },
  "title": "Agent Card Signature",
  "type": "object",
};

function validate36(
  data,
  { instancePath = "", parentData, parentDataProperty, rootData = data, dynamicAnchors = {} } = {},
) {
  let vErrors = null;
  let errors = 0;
  const evaluated0 = validate36.evaluated;
  if (evaluated0.dynamicProps) {
    evaluated0.props = undefined;
  }
  if (evaluated0.dynamicItems) {
    evaluated0.items = undefined;
  }
  if (data && typeof data == "object" && !Array.isArray(data)) {
    for (const key0 in data) {
      if (!(((key0 === "header") || (key0 === "protected")) || (key0 === "signature"))) {
        const err0 = {
          instancePath,
          schemaPath: "#/additionalProperties",
          keyword: "additionalProperties",
          params: { additionalProperty: key0 },
          message: "must NOT have additional properties",
        };
        if (vErrors === null) {
          vErrors = [err0];
        } else {
          vErrors.push(err0);
        }
        errors++;
      }
    }
    if (data.header !== undefined) {
      let data0 = data.header;
      if (!(data0 && typeof data0 == "object" && !Array.isArray(data0))) {
        const err1 = {
          instancePath: instancePath + "/header",
          schemaPath: "#/definitions/Struct/type",
          keyword: "type",
          params: { type: "object" },
          message: "must be object",
        };
        if (vErrors === null) {
          vErrors = [err1];
        } else {
          vErrors.push(err1);
        }
        errors++;
      }
    }
    if (data.protected !== undefined) {
      if (typeof data.protected !== "string") {
        const err2 = {
          instancePath: instancePath + "/protected",
          schemaPath: "#/properties/protected/type",
          keyword: "type",
          params: { type: "string" },
          message: "must be string",
        };
        if (vErrors === null) {
          vErrors = [err2];
        } else {
          vErrors.push(err2);
        }
        errors++;
      }
    }
    if (data.signature !== undefined) {
      if (typeof data.signature !== "string") {
        const err3 = {
          instancePath: instancePath + "/signature",
          schemaPath: "#/properties/signature/type",
          keyword: "type",
          params: { type: "string" },
          message: "must be string",
        };
        if (vErrors === null) {
          vErrors = [err3];
        } else {
          vErrors.push(err3);
        }
        errors++;
      }
    }
  } else {
    const err4 = {
      instancePath,
      schemaPath: "#/type",
      keyword: "type",
      params: { type: "object" },
      message: "must be object",
    };
    if (vErrors === null) {
      vErrors = [err4];
    } else {
      vErrors.push(err4);
    }
    errors++;
  }
  validate36.errors = vErrors;
  return errors === 0;
}
validate36.evaluated = { "props": true, "dynamicProps": false, "dynamicItems": false };

const schema61 = {
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "additionalProperties": false,
  "description": "Represents a distinct capability or function that an agent can perform.",
  "patternProperties": {
    "^(input_modes)$": {
      "description":
        "The set of supported input media types for this skill, overriding the agent's defaults.",
      "items": { "type": "string" },
      "type": "array",
    },
    "^(output_modes)$": {
      "description":
        "The set of supported output media types for this skill, overriding the agent's defaults.",
      "items": { "type": "string" },
      "type": "array",
    },
    "^(security_requirements)$": {
      "description": "Security schemes necessary for this skill.",
      "items": { "$ref": "#/definitions/Security Requirement" },
      "type": "array",
    },
  },
  "properties": {
    "description": {
      "default": "",
      "description": "A detailed description of the skill.",
      "type": "string",
    },
    "examples": {
      "description": "Example prompts or scenarios that this skill can handle.",
      "items": { "type": "string" },
      "type": "array",
    },
    "id": {
      "default": "",
      "description": "A unique identifier for the agent's skill.",
      "type": "string",
    },
    "inputModes": {
      "description":
        "The set of supported input media types for this skill, overriding the agent's defaults.",
      "items": { "type": "string" },
      "type": "array",
    },
    "name": {
      "default": "",
      "description": "A human-readable name for the skill.",
      "type": "string",
    },
    "outputModes": {
      "description":
        "The set of supported output media types for this skill, overriding the agent's defaults.",
      "items": { "type": "string" },
      "type": "array",
    },
    "securityRequirements": {
      "description": "Security schemes necessary for this skill.",
      "items": { "$ref": "#/definitions/Security Requirement" },
      "type": "array",
    },
    "tags": {
      "description": "A set of keywords describing the skill's capabilities.",
      "items": { "type": "string" },
      "type": "array",
    },
  },
  "title": "Agent Skill",
  "type": "object",
};
const pattern85 = new RegExp("^(input_modes)$", "u");
const pattern86 = new RegExp("^(output_modes)$", "u");

function validate38(
  data,
  { instancePath = "", parentData, parentDataProperty, rootData = data, dynamicAnchors = {} } = {},
) {
  let vErrors = null;
  let errors = 0;
  const evaluated0 = validate38.evaluated;
  if (evaluated0.dynamicProps) {
    evaluated0.props = undefined;
  }
  if (evaluated0.dynamicItems) {
    evaluated0.items = undefined;
  }
  if (data && typeof data == "object" && !Array.isArray(data)) {
    for (const key0 in data) {
      if (
        !(((((((((((key0 === "description") || (key0 === "examples")) || (key0 === "id")) ||
          (key0 === "inputModes")) || (key0 === "name")) || (key0 === "outputModes")) ||
          (key0 === "securityRequirements")) || (key0 === "tags")) || (pattern85.test(key0))) ||
          (pattern86.test(key0))) || (pattern8.test(key0)))
      ) {
        const err0 = {
          instancePath,
          schemaPath: "#/additionalProperties",
          keyword: "additionalProperties",
          params: { additionalProperty: key0 },
          message: "must NOT have additional properties",
        };
        if (vErrors === null) {
          vErrors = [err0];
        } else {
          vErrors.push(err0);
        }
        errors++;
      }
    }
    if (data.description !== undefined) {
      if (typeof data.description !== "string") {
        const err1 = {
          instancePath: instancePath + "/description",
          schemaPath: "#/properties/description/type",
          keyword: "type",
          params: { type: "string" },
          message: "must be string",
        };
        if (vErrors === null) {
          vErrors = [err1];
        } else {
          vErrors.push(err1);
        }
        errors++;
      }
    }
    if (data.examples !== undefined) {
      let data1 = data.examples;
      if (Array.isArray(data1)) {
        const len0 = data1.length;
        for (let i0 = 0; i0 < len0; i0++) {
          if (typeof data1[i0] !== "string") {
            const err2 = {
              instancePath: instancePath + "/examples/" + i0,
              schemaPath: "#/properties/examples/items/type",
              keyword: "type",
              params: { type: "string" },
              message: "must be string",
            };
            if (vErrors === null) {
              vErrors = [err2];
            } else {
              vErrors.push(err2);
            }
            errors++;
          }
        }
      } else {
        const err3 = {
          instancePath: instancePath + "/examples",
          schemaPath: "#/properties/examples/type",
          keyword: "type",
          params: { type: "array" },
          message: "must be array",
        };
        if (vErrors === null) {
          vErrors = [err3];
        } else {
          vErrors.push(err3);
        }
        errors++;
      }
    }
    if (data.id !== undefined) {
      if (typeof data.id !== "string") {
        const err4 = {
          instancePath: instancePath + "/id",
          schemaPath: "#/properties/id/type",
          keyword: "type",
          params: { type: "string" },
          message: "must be string",
        };
        if (vErrors === null) {
          vErrors = [err4];
        } else {
          vErrors.push(err4);
        }
        errors++;
      }
    }
    if (data.inputModes !== undefined) {
      let data4 = data.inputModes;
      if (Array.isArray(data4)) {
        const len1 = data4.length;
        for (let i1 = 0; i1 < len1; i1++) {
          if (typeof data4[i1] !== "string") {
            const err5 = {
              instancePath: instancePath + "/inputModes/" + i1,
              schemaPath: "#/properties/inputModes/items/type",
              keyword: "type",
              params: { type: "string" },
              message: "must be string",
            };
            if (vErrors === null) {
              vErrors = [err5];
            } else {
              vErrors.push(err5);
            }
            errors++;
          }
        }
      } else {
        const err6 = {
          instancePath: instancePath + "/inputModes",
          schemaPath: "#/properties/inputModes/type",
          keyword: "type",
          params: { type: "array" },
          message: "must be array",
        };
        if (vErrors === null) {
          vErrors = [err6];
        } else {
          vErrors.push(err6);
        }
        errors++;
      }
    }
    if (data.name !== undefined) {
      if (typeof data.name !== "string") {
        const err7 = {
          instancePath: instancePath + "/name",
          schemaPath: "#/properties/name/type",
          keyword: "type",
          params: { type: "string" },
          message: "must be string",
        };
        if (vErrors === null) {
          vErrors = [err7];
        } else {
          vErrors.push(err7);
        }
        errors++;
      }
    }
    if (data.outputModes !== undefined) {
      let data7 = data.outputModes;
      if (Array.isArray(data7)) {
        const len2 = data7.length;
        for (let i2 = 0; i2 < len2; i2++) {
          if (typeof data7[i2] !== "string") {
            const err8 = {
              instancePath: instancePath + "/outputModes/" + i2,
              schemaPath: "#/properties/outputModes/items/type",
              keyword: "type",
              params: { type: "string" },
              message: "must be string",
            };
            if (vErrors === null) {
              vErrors = [err8];
            } else {
              vErrors.push(err8);
            }
            errors++;
          }
        }
      } else {
        const err9 = {
          instancePath: instancePath + "/outputModes",
          schemaPath: "#/properties/outputModes/type",
          keyword: "type",
          params: { type: "array" },
          message: "must be array",
        };
        if (vErrors === null) {
          vErrors = [err9];
        } else {
          vErrors.push(err9);
        }
        errors++;
      }
    }
    if (data.securityRequirements !== undefined) {
      let data9 = data.securityRequirements;
      if (Array.isArray(data9)) {
        const len3 = data9.length;
        for (let i3 = 0; i3 < len3; i3++) {
          if (
            !(validate27(data9[i3], {
              instancePath: instancePath + "/securityRequirements/" + i3,
              parentData: data9,
              parentDataProperty: i3,
              rootData,
              dynamicAnchors,
            }))
          ) {
            vErrors = vErrors === null ? validate27.errors : vErrors.concat(validate27.errors);
            errors = vErrors.length;
          }
        }
      } else {
        const err10 = {
          instancePath: instancePath + "/securityRequirements",
          schemaPath: "#/properties/securityRequirements/type",
          keyword: "type",
          params: { type: "array" },
          message: "must be array",
        };
        if (vErrors === null) {
          vErrors = [err10];
        } else {
          vErrors.push(err10);
        }
        errors++;
      }
    }
    if (data.tags !== undefined) {
      let data11 = data.tags;
      if (Array.isArray(data11)) {
        const len4 = data11.length;
        for (let i4 = 0; i4 < len4; i4++) {
          if (typeof data11[i4] !== "string") {
            const err11 = {
              instancePath: instancePath + "/tags/" + i4,
              schemaPath: "#/properties/tags/items/type",
              keyword: "type",
              params: { type: "string" },
              message: "must be string",
            };
            if (vErrors === null) {
              vErrors = [err11];
            } else {
              vErrors.push(err11);
            }
            errors++;
          }
        }
      } else {
        const err12 = {
          instancePath: instancePath + "/tags",
          schemaPath: "#/properties/tags/type",
          keyword: "type",
          params: { type: "array" },
          message: "must be array",
        };
        if (vErrors === null) {
          vErrors = [err12];
        } else {
          vErrors.push(err12);
        }
        errors++;
      }
    }
    for (const key1 in data) {
      if (pattern85.test(key1)) {
        let data13 = data[key1];
        if (Array.isArray(data13)) {
          const len5 = data13.length;
          for (let i5 = 0; i5 < len5; i5++) {
            if (typeof data13[i5] !== "string") {
              const err13 = {
                instancePath: instancePath + "/" + key1.replace(/~/g, "~0").replace(/\//g, "~1") +
                  "/" + i5,
                schemaPath: "#/patternProperties/%5E(input_modes)%24/items/type",
                keyword: "type",
                params: { type: "string" },
                message: "must be string",
              };
              if (vErrors === null) {
                vErrors = [err13];
              } else {
                vErrors.push(err13);
              }
              errors++;
            }
          }
        } else {
          const err14 = {
            instancePath: instancePath + "/" + key1.replace(/~/g, "~0").replace(/\//g, "~1"),
            schemaPath: "#/patternProperties/%5E(input_modes)%24/type",
            keyword: "type",
            params: { type: "array" },
            message: "must be array",
          };
          if (vErrors === null) {
            vErrors = [err14];
          } else {
            vErrors.push(err14);
          }
          errors++;
        }
      }
    }
    for (const key2 in data) {
      if (pattern86.test(key2)) {
        let data15 = data[key2];
        if (Array.isArray(data15)) {
          const len6 = data15.length;
          for (let i6 = 0; i6 < len6; i6++) {
            if (typeof data15[i6] !== "string") {
              const err15 = {
                instancePath: instancePath + "/" + key2.replace(/~/g, "~0").replace(/\//g, "~1") +
                  "/" + i6,
                schemaPath: "#/patternProperties/%5E(output_modes)%24/items/type",
                keyword: "type",
                params: { type: "string" },
                message: "must be string",
              };
              if (vErrors === null) {
                vErrors = [err15];
              } else {
                vErrors.push(err15);
              }
              errors++;
            }
          }
        } else {
          const err16 = {
            instancePath: instancePath + "/" + key2.replace(/~/g, "~0").replace(/\//g, "~1"),
            schemaPath: "#/patternProperties/%5E(output_modes)%24/type",
            keyword: "type",
            params: { type: "array" },
            message: "must be array",
          };
          if (vErrors === null) {
            vErrors = [err16];
          } else {
            vErrors.push(err16);
          }
          errors++;
        }
      }
    }
    for (const key3 in data) {
      if (pattern8.test(key3)) {
        let data17 = data[key3];
        if (Array.isArray(data17)) {
          const len7 = data17.length;
          for (let i7 = 0; i7 < len7; i7++) {
            if (
              !(validate27(data17[i7], {
                instancePath: instancePath + "/" + key3.replace(/~/g, "~0").replace(/\//g, "~1") +
                  "/" + i7,
                parentData: data17,
                parentDataProperty: i7,
                rootData,
                dynamicAnchors,
              }))
            ) {
              vErrors = vErrors === null ? validate27.errors : vErrors.concat(validate27.errors);
              errors = vErrors.length;
            }
          }
        } else {
          const err17 = {
            instancePath: instancePath + "/" + key3.replace(/~/g, "~0").replace(/\//g, "~1"),
            schemaPath: "#/patternProperties/%5E(security_requirements)%24/type",
            keyword: "type",
            params: { type: "array" },
            message: "must be array",
          };
          if (vErrors === null) {
            vErrors = [err17];
          } else {
            vErrors.push(err17);
          }
          errors++;
        }
      }
    }
  } else {
    const err18 = {
      instancePath,
      schemaPath: "#/type",
      keyword: "type",
      params: { type: "object" },
      message: "must be object",
    };
    if (vErrors === null) {
      vErrors = [err18];
    } else {
      vErrors.push(err18);
    }
    errors++;
  }
  validate38.errors = vErrors;
  return errors === 0;
}
validate38.evaluated = { "props": true, "dynamicProps": false, "dynamicItems": false };

function validate22(
  data,
  { instancePath = "", parentData, parentDataProperty, rootData = data, dynamicAnchors = {} } = {},
) {
  let vErrors = null;
  let errors = 0;
  const evaluated0 = validate22.evaluated;
  if (evaluated0.dynamicProps) {
    evaluated0.props = undefined;
  }
  if (evaluated0.dynamicItems) {
    evaluated0.items = undefined;
  }
  if (data && typeof data == "object" && !Array.isArray(data)) {
    for (const key0 in data) {
      if (
        !((((((((func1.call(schema33.properties, key0)) || (pattern4.test(key0))) ||
          (pattern5.test(key0))) || (pattern6.test(key0))) || (pattern7.test(key0))) ||
          (pattern8.test(key0))) || (pattern9.test(key0))) || (pattern10.test(key0)))
      ) {
        const err0 = {
          instancePath,
          schemaPath: "#/additionalProperties",
          keyword: "additionalProperties",
          params: { additionalProperty: key0 },
          message: "must NOT have additional properties",
        };
        if (vErrors === null) {
          vErrors = [err0];
        } else {
          vErrors.push(err0);
        }
        errors++;
      }
    }
    if (data.capabilities !== undefined) {
      if (
        !(validate23(data.capabilities, {
          instancePath: instancePath + "/capabilities",
          parentData: data,
          parentDataProperty: "capabilities",
          rootData,
          dynamicAnchors,
        }))
      ) {
        vErrors = vErrors === null ? validate23.errors : vErrors.concat(validate23.errors);
        errors = vErrors.length;
      }
    }
    if (data.defaultInputModes !== undefined) {
      let data1 = data.defaultInputModes;
      if (Array.isArray(data1)) {
        const len0 = data1.length;
        for (let i0 = 0; i0 < len0; i0++) {
          if (typeof data1[i0] !== "string") {
            const err1 = {
              instancePath: instancePath + "/defaultInputModes/" + i0,
              schemaPath: "#/properties/defaultInputModes/items/type",
              keyword: "type",
              params: { type: "string" },
              message: "must be string",
            };
            if (vErrors === null) {
              vErrors = [err1];
            } else {
              vErrors.push(err1);
            }
            errors++;
          }
        }
      } else {
        const err2 = {
          instancePath: instancePath + "/defaultInputModes",
          schemaPath: "#/properties/defaultInputModes/type",
          keyword: "type",
          params: { type: "array" },
          message: "must be array",
        };
        if (vErrors === null) {
          vErrors = [err2];
        } else {
          vErrors.push(err2);
        }
        errors++;
      }
    }
    if (data.defaultOutputModes !== undefined) {
      let data3 = data.defaultOutputModes;
      if (Array.isArray(data3)) {
        const len1 = data3.length;
        for (let i1 = 0; i1 < len1; i1++) {
          if (typeof data3[i1] !== "string") {
            const err3 = {
              instancePath: instancePath + "/defaultOutputModes/" + i1,
              schemaPath: "#/properties/defaultOutputModes/items/type",
              keyword: "type",
              params: { type: "string" },
              message: "must be string",
            };
            if (vErrors === null) {
              vErrors = [err3];
            } else {
              vErrors.push(err3);
            }
            errors++;
          }
        }
      } else {
        const err4 = {
          instancePath: instancePath + "/defaultOutputModes",
          schemaPath: "#/properties/defaultOutputModes/type",
          keyword: "type",
          params: { type: "array" },
          message: "must be array",
        };
        if (vErrors === null) {
          vErrors = [err4];
        } else {
          vErrors.push(err4);
        }
        errors++;
      }
    }
    if (data.description !== undefined) {
      if (typeof data.description !== "string") {
        const err5 = {
          instancePath: instancePath + "/description",
          schemaPath: "#/properties/description/type",
          keyword: "type",
          params: { type: "string" },
          message: "must be string",
        };
        if (vErrors === null) {
          vErrors = [err5];
        } else {
          vErrors.push(err5);
        }
        errors++;
      }
    }
    if (data.documentationUrl !== undefined) {
      if (typeof data.documentationUrl !== "string") {
        const err6 = {
          instancePath: instancePath + "/documentationUrl",
          schemaPath: "#/properties/documentationUrl/type",
          keyword: "type",
          params: { type: "string" },
          message: "must be string",
        };
        if (vErrors === null) {
          vErrors = [err6];
        } else {
          vErrors.push(err6);
        }
        errors++;
      }
    }
    if (data.iconUrl !== undefined) {
      if (typeof data.iconUrl !== "string") {
        const err7 = {
          instancePath: instancePath + "/iconUrl",
          schemaPath: "#/properties/iconUrl/type",
          keyword: "type",
          params: { type: "string" },
          message: "must be string",
        };
        if (vErrors === null) {
          vErrors = [err7];
        } else {
          vErrors.push(err7);
        }
        errors++;
      }
    }
    if (data.name !== undefined) {
      if (typeof data.name !== "string") {
        const err8 = {
          instancePath: instancePath + "/name",
          schemaPath: "#/properties/name/type",
          keyword: "type",
          params: { type: "string" },
          message: "must be string",
        };
        if (vErrors === null) {
          vErrors = [err8];
        } else {
          vErrors.push(err8);
        }
        errors++;
      }
    }
    if (data.provider !== undefined) {
      let data9 = data.provider;
      if (data9 && typeof data9 == "object" && !Array.isArray(data9)) {
        for (const key1 in data9) {
          if (!((key1 === "organization") || (key1 === "url"))) {
            const err9 = {
              instancePath: instancePath + "/provider",
              schemaPath: "#/definitions/Agent Provider/additionalProperties",
              keyword: "additionalProperties",
              params: { additionalProperty: key1 },
              message: "must NOT have additional properties",
            };
            if (vErrors === null) {
              vErrors = [err9];
            } else {
              vErrors.push(err9);
            }
            errors++;
          }
        }
        if (data9.organization !== undefined) {
          if (typeof data9.organization !== "string") {
            const err10 = {
              instancePath: instancePath + "/provider/organization",
              schemaPath: "#/definitions/Agent Provider/properties/organization/type",
              keyword: "type",
              params: { type: "string" },
              message: "must be string",
            };
            if (vErrors === null) {
              vErrors = [err10];
            } else {
              vErrors.push(err10);
            }
            errors++;
          }
        }
        if (data9.url !== undefined) {
          if (typeof data9.url !== "string") {
            const err11 = {
              instancePath: instancePath + "/provider/url",
              schemaPath: "#/definitions/Agent Provider/properties/url/type",
              keyword: "type",
              params: { type: "string" },
              message: "must be string",
            };
            if (vErrors === null) {
              vErrors = [err11];
            } else {
              vErrors.push(err11);
            }
            errors++;
          }
        }
      } else {
        const err12 = {
          instancePath: instancePath + "/provider",
          schemaPath: "#/definitions/Agent Provider/type",
          keyword: "type",
          params: { type: "object" },
          message: "must be object",
        };
        if (vErrors === null) {
          vErrors = [err12];
        } else {
          vErrors.push(err12);
        }
        errors++;
      }
    }
    if (data.securityRequirements !== undefined) {
      let data12 = data.securityRequirements;
      if (Array.isArray(data12)) {
        const len2 = data12.length;
        for (let i2 = 0; i2 < len2; i2++) {
          if (
            !(validate27(data12[i2], {
              instancePath: instancePath + "/securityRequirements/" + i2,
              parentData: data12,
              parentDataProperty: i2,
              rootData,
              dynamicAnchors,
            }))
          ) {
            vErrors = vErrors === null ? validate27.errors : vErrors.concat(validate27.errors);
            errors = vErrors.length;
          }
        }
      } else {
        const err13 = {
          instancePath: instancePath + "/securityRequirements",
          schemaPath: "#/properties/securityRequirements/type",
          keyword: "type",
          params: { type: "array" },
          message: "must be array",
        };
        if (vErrors === null) {
          vErrors = [err13];
        } else {
          vErrors.push(err13);
        }
        errors++;
      }
    }
    if (data.securitySchemes !== undefined) {
      let data14 = data.securitySchemes;
      if (data14 && typeof data14 == "object" && !Array.isArray(data14)) {
        for (const key2 in data14) {
          const _errs32 = errors;
          if (typeof key2 !== "string") {
            const err14 = {
              instancePath: instancePath + "/securitySchemes",
              schemaPath: "#/properties/securitySchemes/propertyNames/type",
              keyword: "type",
              params: { type: "string" },
              message: "must be string",
              propertyName: key2,
            };
            if (vErrors === null) {
              vErrors = [err14];
            } else {
              vErrors.push(err14);
            }
            errors++;
          }
          var valid9 = _errs32 === errors;
          if (!valid9) {
            const err15 = {
              instancePath: instancePath + "/securitySchemes",
              schemaPath: "#/properties/securitySchemes/propertyNames",
              keyword: "propertyNames",
              params: { propertyName: key2 },
              message: "property name must be valid",
            };
            if (vErrors === null) {
              vErrors = [err15];
            } else {
              vErrors.push(err15);
            }
            errors++;
          }
        }
        for (const key3 in data14) {
          if (
            !(validate29(data14[key3], {
              instancePath: instancePath + "/securitySchemes/" +
                key3.replace(/~/g, "~0").replace(/\//g, "~1"),
              parentData: data14,
              parentDataProperty: key3,
              rootData,
              dynamicAnchors,
            }))
          ) {
            vErrors = vErrors === null ? validate29.errors : vErrors.concat(validate29.errors);
            errors = vErrors.length;
          }
        }
      } else {
        const err16 = {
          instancePath: instancePath + "/securitySchemes",
          schemaPath: "#/properties/securitySchemes/type",
          keyword: "type",
          params: { type: "object" },
          message: "must be object",
        };
        if (vErrors === null) {
          vErrors = [err16];
        } else {
          vErrors.push(err16);
        }
        errors++;
      }
    }
    if (data.signatures !== undefined) {
      let data16 = data.signatures;
      if (Array.isArray(data16)) {
        const len3 = data16.length;
        for (let i3 = 0; i3 < len3; i3++) {
          if (
            !(validate36(data16[i3], {
              instancePath: instancePath + "/signatures/" + i3,
              parentData: data16,
              parentDataProperty: i3,
              rootData,
              dynamicAnchors,
            }))
          ) {
            vErrors = vErrors === null ? validate36.errors : vErrors.concat(validate36.errors);
            errors = vErrors.length;
          }
        }
      } else {
        const err17 = {
          instancePath: instancePath + "/signatures",
          schemaPath: "#/properties/signatures/type",
          keyword: "type",
          params: { type: "array" },
          message: "must be array",
        };
        if (vErrors === null) {
          vErrors = [err17];
        } else {
          vErrors.push(err17);
        }
        errors++;
      }
    }
    if (data.skills !== undefined) {
      let data18 = data.skills;
      if (Array.isArray(data18)) {
        const len4 = data18.length;
        for (let i4 = 0; i4 < len4; i4++) {
          if (
            !(validate38(data18[i4], {
              instancePath: instancePath + "/skills/" + i4,
              parentData: data18,
              parentDataProperty: i4,
              rootData,
              dynamicAnchors,
            }))
          ) {
            vErrors = vErrors === null ? validate38.errors : vErrors.concat(validate38.errors);
            errors = vErrors.length;
          }
        }
      } else {
        const err18 = {
          instancePath: instancePath + "/skills",
          schemaPath: "#/properties/skills/type",
          keyword: "type",
          params: { type: "array" },
          message: "must be array",
        };
        if (vErrors === null) {
          vErrors = [err18];
        } else {
          vErrors.push(err18);
        }
        errors++;
      }
    }
    if (data.supportedInterfaces !== undefined) {
      let data20 = data.supportedInterfaces;
      if (Array.isArray(data20)) {
        const len5 = data20.length;
        for (let i5 = 0; i5 < len5; i5++) {
          let data21 = data20[i5];
          if (data21 && typeof data21 == "object" && !Array.isArray(data21)) {
            for (const key4 in data21) {
              if (
                !((((((key4 === "protocolBinding") || (key4 === "protocolVersion")) ||
                  (key4 === "tenant")) || (key4 === "url")) || (pattern91.test(key4))) ||
                  (pattern92.test(key4)))
              ) {
                const err19 = {
                  instancePath: instancePath + "/supportedInterfaces/" + i5,
                  schemaPath: "#/definitions/Agent Interface/additionalProperties",
                  keyword: "additionalProperties",
                  params: { additionalProperty: key4 },
                  message: "must NOT have additional properties",
                };
                if (vErrors === null) {
                  vErrors = [err19];
                } else {
                  vErrors.push(err19);
                }
                errors++;
              }
            }
            if (data21.protocolBinding !== undefined) {
              if (typeof data21.protocolBinding !== "string") {
                const err20 = {
                  instancePath: instancePath + "/supportedInterfaces/" + i5 + "/protocolBinding",
                  schemaPath: "#/definitions/Agent Interface/properties/protocolBinding/type",
                  keyword: "type",
                  params: { type: "string" },
                  message: "must be string",
                };
                if (vErrors === null) {
                  vErrors = [err20];
                } else {
                  vErrors.push(err20);
                }
                errors++;
              }
            }
            if (data21.protocolVersion !== undefined) {
              if (typeof data21.protocolVersion !== "string") {
                const err21 = {
                  instancePath: instancePath + "/supportedInterfaces/" + i5 + "/protocolVersion",
                  schemaPath: "#/definitions/Agent Interface/properties/protocolVersion/type",
                  keyword: "type",
                  params: { type: "string" },
                  message: "must be string",
                };
                if (vErrors === null) {
                  vErrors = [err21];
                } else {
                  vErrors.push(err21);
                }
                errors++;
              }
            }
            if (data21.tenant !== undefined) {
              if (typeof data21.tenant !== "string") {
                const err22 = {
                  instancePath: instancePath + "/supportedInterfaces/" + i5 + "/tenant",
                  schemaPath: "#/definitions/Agent Interface/properties/tenant/type",
                  keyword: "type",
                  params: { type: "string" },
                  message: "must be string",
                };
                if (vErrors === null) {
                  vErrors = [err22];
                } else {
                  vErrors.push(err22);
                }
                errors++;
              }
            }
            if (data21.url !== undefined) {
              if (typeof data21.url !== "string") {
                const err23 = {
                  instancePath: instancePath + "/supportedInterfaces/" + i5 + "/url",
                  schemaPath: "#/definitions/Agent Interface/properties/url/type",
                  keyword: "type",
                  params: { type: "string" },
                  message: "must be string",
                };
                if (vErrors === null) {
                  vErrors = [err23];
                } else {
                  vErrors.push(err23);
                }
                errors++;
              }
            }
            for (const key5 in data21) {
              if (pattern91.test(key5)) {
                if (typeof data21[key5] !== "string") {
                  const err24 = {
                    instancePath: instancePath + "/supportedInterfaces/" + i5 + "/" +
                      key5.replace(/~/g, "~0").replace(/\//g, "~1"),
                    schemaPath:
                      "#/definitions/Agent Interface/patternProperties/%5E(protocol_binding)%24/type",
                    keyword: "type",
                    params: { type: "string" },
                    message: "must be string",
                  };
                  if (vErrors === null) {
                    vErrors = [err24];
                  } else {
                    vErrors.push(err24);
                  }
                  errors++;
                }
              }
            }
            for (const key6 in data21) {
              if (pattern92.test(key6)) {
                if (typeof data21[key6] !== "string") {
                  const err25 = {
                    instancePath: instancePath + "/supportedInterfaces/" + i5 + "/" +
                      key6.replace(/~/g, "~0").replace(/\//g, "~1"),
                    schemaPath:
                      "#/definitions/Agent Interface/patternProperties/%5E(protocol_version)%24/type",
                    keyword: "type",
                    params: { type: "string" },
                    message: "must be string",
                  };
                  if (vErrors === null) {
                    vErrors = [err25];
                  } else {
                    vErrors.push(err25);
                  }
                  errors++;
                }
              }
            }
          } else {
            const err26 = {
              instancePath: instancePath + "/supportedInterfaces/" + i5,
              schemaPath: "#/definitions/Agent Interface/type",
              keyword: "type",
              params: { type: "object" },
              message: "must be object",
            };
            if (vErrors === null) {
              vErrors = [err26];
            } else {
              vErrors.push(err26);
            }
            errors++;
          }
        }
      } else {
        const err27 = {
          instancePath: instancePath + "/supportedInterfaces",
          schemaPath: "#/properties/supportedInterfaces/type",
          keyword: "type",
          params: { type: "array" },
          message: "must be array",
        };
        if (vErrors === null) {
          vErrors = [err27];
        } else {
          vErrors.push(err27);
        }
        errors++;
      }
    }
    if (data.version !== undefined) {
      if (typeof data.version !== "string") {
        const err28 = {
          instancePath: instancePath + "/version",
          schemaPath: "#/properties/version/type",
          keyword: "type",
          params: { type: "string" },
          message: "must be string",
        };
        if (vErrors === null) {
          vErrors = [err28];
        } else {
          vErrors.push(err28);
        }
        errors++;
      }
    }
    for (const key7 in data) {
      if (pattern4.test(key7)) {
        let data29 = data[key7];
        if (Array.isArray(data29)) {
          const len6 = data29.length;
          for (let i6 = 0; i6 < len6; i6++) {
            if (typeof data29[i6] !== "string") {
              const err29 = {
                instancePath: instancePath + "/" + key7.replace(/~/g, "~0").replace(/\//g, "~1") +
                  "/" + i6,
                schemaPath: "#/patternProperties/%5E(default_input_modes)%24/items/type",
                keyword: "type",
                params: { type: "string" },
                message: "must be string",
              };
              if (vErrors === null) {
                vErrors = [err29];
              } else {
                vErrors.push(err29);
              }
              errors++;
            }
          }
        } else {
          const err30 = {
            instancePath: instancePath + "/" + key7.replace(/~/g, "~0").replace(/\//g, "~1"),
            schemaPath: "#/patternProperties/%5E(default_input_modes)%24/type",
            keyword: "type",
            params: { type: "array" },
            message: "must be array",
          };
          if (vErrors === null) {
            vErrors = [err30];
          } else {
            vErrors.push(err30);
          }
          errors++;
        }
      }
    }
    for (const key8 in data) {
      if (pattern5.test(key8)) {
        let data31 = data[key8];
        if (Array.isArray(data31)) {
          const len7 = data31.length;
          for (let i7 = 0; i7 < len7; i7++) {
            if (typeof data31[i7] !== "string") {
              const err31 = {
                instancePath: instancePath + "/" + key8.replace(/~/g, "~0").replace(/\//g, "~1") +
                  "/" + i7,
                schemaPath: "#/patternProperties/%5E(default_output_modes)%24/items/type",
                keyword: "type",
                params: { type: "string" },
                message: "must be string",
              };
              if (vErrors === null) {
                vErrors = [err31];
              } else {
                vErrors.push(err31);
              }
              errors++;
            }
          }
        } else {
          const err32 = {
            instancePath: instancePath + "/" + key8.replace(/~/g, "~0").replace(/\//g, "~1"),
            schemaPath: "#/patternProperties/%5E(default_output_modes)%24/type",
            keyword: "type",
            params: { type: "array" },
            message: "must be array",
          };
          if (vErrors === null) {
            vErrors = [err32];
          } else {
            vErrors.push(err32);
          }
          errors++;
        }
      }
    }
    for (const key9 in data) {
      if (pattern6.test(key9)) {
        if (typeof data[key9] !== "string") {
          const err33 = {
            instancePath: instancePath + "/" + key9.replace(/~/g, "~0").replace(/\//g, "~1"),
            schemaPath: "#/patternProperties/%5E(documentation_url)%24/type",
            keyword: "type",
            params: { type: "string" },
            message: "must be string",
          };
          if (vErrors === null) {
            vErrors = [err33];
          } else {
            vErrors.push(err33);
          }
          errors++;
        }
      }
    }
    for (const key10 in data) {
      if (pattern7.test(key10)) {
        if (typeof data[key10] !== "string") {
          const err34 = {
            instancePath: instancePath + "/" + key10.replace(/~/g, "~0").replace(/\//g, "~1"),
            schemaPath: "#/patternProperties/%5E(icon_url)%24/type",
            keyword: "type",
            params: { type: "string" },
            message: "must be string",
          };
          if (vErrors === null) {
            vErrors = [err34];
          } else {
            vErrors.push(err34);
          }
          errors++;
        }
      }
    }
    for (const key11 in data) {
      if (pattern8.test(key11)) {
        let data35 = data[key11];
        if (Array.isArray(data35)) {
          const len8 = data35.length;
          for (let i8 = 0; i8 < len8; i8++) {
            if (
              !(validate27(data35[i8], {
                instancePath: instancePath + "/" + key11.replace(/~/g, "~0").replace(/\//g, "~1") +
                  "/" + i8,
                parentData: data35,
                parentDataProperty: i8,
                rootData,
                dynamicAnchors,
              }))
            ) {
              vErrors = vErrors === null ? validate27.errors : vErrors.concat(validate27.errors);
              errors = vErrors.length;
            }
          }
        } else {
          const err35 = {
            instancePath: instancePath + "/" + key11.replace(/~/g, "~0").replace(/\//g, "~1"),
            schemaPath: "#/patternProperties/%5E(security_requirements)%24/type",
            keyword: "type",
            params: { type: "array" },
            message: "must be array",
          };
          if (vErrors === null) {
            vErrors = [err35];
          } else {
            vErrors.push(err35);
          }
          errors++;
        }
      }
    }
    for (const key12 in data) {
      if (pattern9.test(key12)) {
        let data37 = data[key12];
        if (data37 && typeof data37 == "object" && !Array.isArray(data37)) {
          for (const key13 in data37) {
            const _errs79 = errors;
            if (typeof key13 !== "string") {
              const err36 = {
                instancePath: instancePath + "/" + key12.replace(/~/g, "~0").replace(/\//g, "~1"),
                schemaPath: "#/patternProperties/%5E(security_schemes)%24/propertyNames/type",
                keyword: "type",
                params: { type: "string" },
                message: "must be string",
                propertyName: key13,
              };
              if (vErrors === null) {
                vErrors = [err36];
              } else {
                vErrors.push(err36);
              }
              errors++;
            }
            var valid27 = _errs79 === errors;
            if (!valid27) {
              const err37 = {
                instancePath: instancePath + "/" + key12.replace(/~/g, "~0").replace(/\//g, "~1"),
                schemaPath: "#/patternProperties/%5E(security_schemes)%24/propertyNames",
                keyword: "propertyNames",
                params: { propertyName: key13 },
                message: "property name must be valid",
              };
              if (vErrors === null) {
                vErrors = [err37];
              } else {
                vErrors.push(err37);
              }
              errors++;
            }
          }
          for (const key14 in data37) {
            if (
              !(validate29(data37[key14], {
                instancePath: instancePath + "/" + key12.replace(/~/g, "~0").replace(/\//g, "~1") +
                  "/" + key14.replace(/~/g, "~0").replace(/\//g, "~1"),
                parentData: data37,
                parentDataProperty: key14,
                rootData,
                dynamicAnchors,
              }))
            ) {
              vErrors = vErrors === null ? validate29.errors : vErrors.concat(validate29.errors);
              errors = vErrors.length;
            }
          }
        } else {
          const err38 = {
            instancePath: instancePath + "/" + key12.replace(/~/g, "~0").replace(/\//g, "~1"),
            schemaPath: "#/patternProperties/%5E(security_schemes)%24/type",
            keyword: "type",
            params: { type: "object" },
            message: "must be object",
          };
          if (vErrors === null) {
            vErrors = [err38];
          } else {
            vErrors.push(err38);
          }
          errors++;
        }
      }
    }
    for (const key15 in data) {
      if (pattern10.test(key15)) {
        let data39 = data[key15];
        if (Array.isArray(data39)) {
          const len9 = data39.length;
          for (let i9 = 0; i9 < len9; i9++) {
            let data40 = data39[i9];
            if (data40 && typeof data40 == "object" && !Array.isArray(data40)) {
              for (const key16 in data40) {
                if (
                  !((((((key16 === "protocolBinding") || (key16 === "protocolVersion")) ||
                    (key16 === "tenant")) || (key16 === "url")) || (pattern91.test(key16))) ||
                    (pattern92.test(key16)))
                ) {
                  const err39 = {
                    instancePath: instancePath + "/" +
                      key15.replace(/~/g, "~0").replace(/\//g, "~1") + "/" + i9,
                    schemaPath: "#/definitions/Agent Interface/additionalProperties",
                    keyword: "additionalProperties",
                    params: { additionalProperty: key16 },
                    message: "must NOT have additional properties",
                  };
                  if (vErrors === null) {
                    vErrors = [err39];
                  } else {
                    vErrors.push(err39);
                  }
                  errors++;
                }
              }
              if (data40.protocolBinding !== undefined) {
                if (typeof data40.protocolBinding !== "string") {
                  const err40 = {
                    instancePath: instancePath + "/" +
                      key15.replace(/~/g, "~0").replace(/\//g, "~1") + "/" + i9 +
                      "/protocolBinding",
                    schemaPath: "#/definitions/Agent Interface/properties/protocolBinding/type",
                    keyword: "type",
                    params: { type: "string" },
                    message: "must be string",
                  };
                  if (vErrors === null) {
                    vErrors = [err40];
                  } else {
                    vErrors.push(err40);
                  }
                  errors++;
                }
              }
              if (data40.protocolVersion !== undefined) {
                if (typeof data40.protocolVersion !== "string") {
                  const err41 = {
                    instancePath: instancePath + "/" +
                      key15.replace(/~/g, "~0").replace(/\//g, "~1") + "/" + i9 +
                      "/protocolVersion",
                    schemaPath: "#/definitions/Agent Interface/properties/protocolVersion/type",
                    keyword: "type",
                    params: { type: "string" },
                    message: "must be string",
                  };
                  if (vErrors === null) {
                    vErrors = [err41];
                  } else {
                    vErrors.push(err41);
                  }
                  errors++;
                }
              }
              if (data40.tenant !== undefined) {
                if (typeof data40.tenant !== "string") {
                  const err42 = {
                    instancePath: instancePath + "/" +
                      key15.replace(/~/g, "~0").replace(/\//g, "~1") + "/" + i9 + "/tenant",
                    schemaPath: "#/definitions/Agent Interface/properties/tenant/type",
                    keyword: "type",
                    params: { type: "string" },
                    message: "must be string",
                  };
                  if (vErrors === null) {
                    vErrors = [err42];
                  } else {
                    vErrors.push(err42);
                  }
                  errors++;
                }
              }
              if (data40.url !== undefined) {
                if (typeof data40.url !== "string") {
                  const err43 = {
                    instancePath: instancePath + "/" +
                      key15.replace(/~/g, "~0").replace(/\//g, "~1") + "/" + i9 + "/url",
                    schemaPath: "#/definitions/Agent Interface/properties/url/type",
                    keyword: "type",
                    params: { type: "string" },
                    message: "must be string",
                  };
                  if (vErrors === null) {
                    vErrors = [err43];
                  } else {
                    vErrors.push(err43);
                  }
                  errors++;
                }
              }
              for (const key17 in data40) {
                if (pattern91.test(key17)) {
                  if (typeof data40[key17] !== "string") {
                    const err44 = {
                      instancePath: instancePath + "/" +
                        key15.replace(/~/g, "~0").replace(/\//g, "~1") + "/" + i9 + "/" +
                        key17.replace(/~/g, "~0").replace(/\//g, "~1"),
                      schemaPath:
                        "#/definitions/Agent Interface/patternProperties/%5E(protocol_binding)%24/type",
                      keyword: "type",
                      params: { type: "string" },
                      message: "must be string",
                    };
                    if (vErrors === null) {
                      vErrors = [err44];
                    } else {
                      vErrors.push(err44);
                    }
                    errors++;
                  }
                }
              }
              for (const key18 in data40) {
                if (pattern92.test(key18)) {
                  if (typeof data40[key18] !== "string") {
                    const err45 = {
                      instancePath: instancePath + "/" +
                        key15.replace(/~/g, "~0").replace(/\//g, "~1") + "/" + i9 + "/" +
                        key18.replace(/~/g, "~0").replace(/\//g, "~1"),
                      schemaPath:
                        "#/definitions/Agent Interface/patternProperties/%5E(protocol_version)%24/type",
                      keyword: "type",
                      params: { type: "string" },
                      message: "must be string",
                    };
                    if (vErrors === null) {
                      vErrors = [err45];
                    } else {
                      vErrors.push(err45);
                    }
                    errors++;
                  }
                }
              }
            } else {
              const err46 = {
                instancePath: instancePath + "/" + key15.replace(/~/g, "~0").replace(/\//g, "~1") +
                  "/" + i9,
                schemaPath: "#/definitions/Agent Interface/type",
                keyword: "type",
                params: { type: "object" },
                message: "must be object",
              };
              if (vErrors === null) {
                vErrors = [err46];
              } else {
                vErrors.push(err46);
              }
              errors++;
            }
          }
        } else {
          const err47 = {
            instancePath: instancePath + "/" + key15.replace(/~/g, "~0").replace(/\//g, "~1"),
            schemaPath: "#/patternProperties/%5E(supported_interfaces)%24/type",
            keyword: "type",
            params: { type: "array" },
            message: "must be array",
          };
          if (vErrors === null) {
            vErrors = [err47];
          } else {
            vErrors.push(err47);
          }
          errors++;
        }
      }
    }
  } else {
    const err48 = {
      instancePath,
      schemaPath: "#/type",
      keyword: "type",
      params: { type: "object" },
      message: "must be object",
    };
    if (vErrors === null) {
      vErrors = [err48];
    } else {
      vErrors.push(err48);
    }
    errors++;
  }
  validate22.errors = vErrors;
  return errors === 0;
}
validate22.evaluated = { "props": true, "dynamicProps": false, "dynamicItems": false };

function validate20(
  data,
  { instancePath = "", parentData, parentDataProperty, rootData = data, dynamicAnchors = {} } = {},
) {
  /*# sourceURL="https://point-and-shoot.invalid/schemas/a2a/v1/validateAgentCard" */
  let vErrors = null;
  let errors = 0;
  const evaluated0 = validate20.evaluated;
  if (evaluated0.dynamicProps) {
    evaluated0.props = undefined;
  }
  if (evaluated0.dynamicItems) {
    evaluated0.items = undefined;
  }
  if (
    !(validate22(data, { instancePath, parentData, parentDataProperty, rootData, dynamicAnchors }))
  ) {
    vErrors = vErrors === null ? validate22.errors : vErrors.concat(validate22.errors);
    errors = vErrors.length;
  }
  validate20.errors = vErrors;
  return errors === 0;
}
validate20.evaluated = { "props": true, "dynamicProps": false, "dynamicItems": false };

export const validateArtifact = validate45;
const schema64 = {
  "$id": "https://point-and-shoot.invalid/schemas/a2a/v1/validateArtifact",
  "$ref": "https://point-and-shoot.invalid/schemas/a2a/v1#/definitions/Artifact",
};
const schema65 = {
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "additionalProperties": false,
  "description": "Artifacts represent task outputs.",
  "patternProperties": {
    "^(artifact_id)$": {
      "default": "",
      "description":
        "Unique identifier (e.g. UUID) for the artifact. It must be unique within a task.",
      "type": "string",
    },
  },
  "properties": {
    "artifactId": {
      "default": "",
      "description":
        "Unique identifier (e.g. UUID) for the artifact. It must be unique within a task.",
      "type": "string",
    },
    "description": {
      "default": "",
      "description": "Optional. A human readable description of the artifact.",
      "type": "string",
    },
    "extensions": {
      "description": "The URIs of extensions that are present or contributed to this Artifact.",
      "items": { "type": "string" },
      "type": "array",
    },
    "metadata": {
      "$ref": "#/definitions/Struct",
      "description": "Optional. Metadata included with the artifact.",
    },
    "name": {
      "default": "",
      "description": "A human readable name for the artifact.",
      "type": "string",
    },
    "parts": {
      "description": "The content of the artifact. Must contain at least one part.",
      "items": { "$ref": "#/definitions/Part" },
      "type": "array",
    },
  },
  "title": "Artifact",
  "type": "object",
};
const pattern106 = new RegExp("^(artifact_id)$", "u");
const schema67 = {
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "additionalProperties": false,
  "description":
    "`Part` represents a container for a section of communication content.\n Parts can be purely textual, some sort of file (image, video, etc) or\n a structured data blob (i.e. JSON).",
  "patternProperties": {
    "^(media_type)$": {
      "default": "",
      "description":
        'The `media_type` (MIME type) of the part content (e.g., "text/plain", "application/json", "image/png").\n This field is available for all part types.',
      "type": "string",
    },
  },
  "properties": {
    "data": {
      "$ref": "#/definitions/Value",
      "description":
        "Arbitrary structured `data` as a JSON value (object, array, string, number, boolean, or null).",
    },
    "filename": {
      "default": "",
      "description": 'An optional `filename` for the file (e.g., "document.pdf").',
      "type": "string",
    },
    "mediaType": {
      "default": "",
      "description":
        'The `media_type` (MIME type) of the part content (e.g., "text/plain", "application/json", "image/png").\n This field is available for all part types.',
      "type": "string",
    },
    "metadata": {
      "$ref": "#/definitions/Struct",
      "description": "Optional. metadata associated with this part.",
    },
    "raw": {
      "description":
        "The `raw` byte content of a file. In JSON serialization, this is encoded as a base64 string.",
      "pattern": "^[A-Za-z0-9+/]*={0,2}$",
      "type": "string",
    },
    "text": { "description": "The string content of the `text` part.", "type": "string" },
    "url": { "description": "A `url` pointing to the file's content.", "type": "string" },
  },
  "title": "Part",
  "type": "object",
};
const schema68 = { "$schema": "https://json-schema.org/draft/2020-12/schema", "title": "Value" };
const pattern107 = new RegExp("^(media_type)$", "u");
const pattern108 = new RegExp("^[A-Za-z0-9+/]*={0,2}$", "u");

function validate47(
  data,
  { instancePath = "", parentData, parentDataProperty, rootData = data, dynamicAnchors = {} } = {},
) {
  let vErrors = null;
  let errors = 0;
  const evaluated0 = validate47.evaluated;
  if (evaluated0.dynamicProps) {
    evaluated0.props = undefined;
  }
  if (evaluated0.dynamicItems) {
    evaluated0.items = undefined;
  }
  if (data && typeof data == "object" && !Array.isArray(data)) {
    for (const key0 in data) {
      if (
        !((((((((key0 === "data") || (key0 === "filename")) || (key0 === "mediaType")) ||
          (key0 === "metadata")) || (key0 === "raw")) || (key0 === "text")) || (key0 === "url")) ||
          (pattern107.test(key0)))
      ) {
        const err0 = {
          instancePath,
          schemaPath: "#/additionalProperties",
          keyword: "additionalProperties",
          params: { additionalProperty: key0 },
          message: "must NOT have additional properties",
        };
        if (vErrors === null) {
          vErrors = [err0];
        } else {
          vErrors.push(err0);
        }
        errors++;
      }
    }
    if (data.filename !== undefined) {
      if (typeof data.filename !== "string") {
        const err1 = {
          instancePath: instancePath + "/filename",
          schemaPath: "#/properties/filename/type",
          keyword: "type",
          params: { type: "string" },
          message: "must be string",
        };
        if (vErrors === null) {
          vErrors = [err1];
        } else {
          vErrors.push(err1);
        }
        errors++;
      }
    }
    if (data.mediaType !== undefined) {
      if (typeof data.mediaType !== "string") {
        const err2 = {
          instancePath: instancePath + "/mediaType",
          schemaPath: "#/properties/mediaType/type",
          keyword: "type",
          params: { type: "string" },
          message: "must be string",
        };
        if (vErrors === null) {
          vErrors = [err2];
        } else {
          vErrors.push(err2);
        }
        errors++;
      }
    }
    if (data.metadata !== undefined) {
      let data3 = data.metadata;
      if (!(data3 && typeof data3 == "object" && !Array.isArray(data3))) {
        const err3 = {
          instancePath: instancePath + "/metadata",
          schemaPath: "#/definitions/Struct/type",
          keyword: "type",
          params: { type: "object" },
          message: "must be object",
        };
        if (vErrors === null) {
          vErrors = [err3];
        } else {
          vErrors.push(err3);
        }
        errors++;
      }
    }
    if (data.raw !== undefined) {
      let data4 = data.raw;
      if (typeof data4 === "string") {
        if (!pattern108.test(data4)) {
          const err4 = {
            instancePath: instancePath + "/raw",
            schemaPath: "#/properties/raw/pattern",
            keyword: "pattern",
            params: { pattern: "^[A-Za-z0-9+/]*={0,2}$" },
            message: 'must match pattern "' + "^[A-Za-z0-9+/]*={0,2}$" + '"',
          };
          if (vErrors === null) {
            vErrors = [err4];
          } else {
            vErrors.push(err4);
          }
          errors++;
        }
      } else {
        const err5 = {
          instancePath: instancePath + "/raw",
          schemaPath: "#/properties/raw/type",
          keyword: "type",
          params: { type: "string" },
          message: "must be string",
        };
        if (vErrors === null) {
          vErrors = [err5];
        } else {
          vErrors.push(err5);
        }
        errors++;
      }
    }
    if (data.text !== undefined) {
      if (typeof data.text !== "string") {
        const err6 = {
          instancePath: instancePath + "/text",
          schemaPath: "#/properties/text/type",
          keyword: "type",
          params: { type: "string" },
          message: "must be string",
        };
        if (vErrors === null) {
          vErrors = [err6];
        } else {
          vErrors.push(err6);
        }
        errors++;
      }
    }
    if (data.url !== undefined) {
      if (typeof data.url !== "string") {
        const err7 = {
          instancePath: instancePath + "/url",
          schemaPath: "#/properties/url/type",
          keyword: "type",
          params: { type: "string" },
          message: "must be string",
        };
        if (vErrors === null) {
          vErrors = [err7];
        } else {
          vErrors.push(err7);
        }
        errors++;
      }
    }
    for (const key1 in data) {
      if (pattern107.test(key1)) {
        if (typeof data[key1] !== "string") {
          const err8 = {
            instancePath: instancePath + "/" + key1.replace(/~/g, "~0").replace(/\//g, "~1"),
            schemaPath: "#/patternProperties/%5E(media_type)%24/type",
            keyword: "type",
            params: { type: "string" },
            message: "must be string",
          };
          if (vErrors === null) {
            vErrors = [err8];
          } else {
            vErrors.push(err8);
          }
          errors++;
        }
      }
    }
  } else {
    const err9 = {
      instancePath,
      schemaPath: "#/type",
      keyword: "type",
      params: { type: "object" },
      message: "must be object",
    };
    if (vErrors === null) {
      vErrors = [err9];
    } else {
      vErrors.push(err9);
    }
    errors++;
  }
  validate47.errors = vErrors;
  return errors === 0;
}
validate47.evaluated = { "props": true, "dynamicProps": false, "dynamicItems": false };

function validate46(
  data,
  { instancePath = "", parentData, parentDataProperty, rootData = data, dynamicAnchors = {} } = {},
) {
  let vErrors = null;
  let errors = 0;
  const evaluated0 = validate46.evaluated;
  if (evaluated0.dynamicProps) {
    evaluated0.props = undefined;
  }
  if (evaluated0.dynamicItems) {
    evaluated0.items = undefined;
  }
  if (data && typeof data == "object" && !Array.isArray(data)) {
    for (const key0 in data) {
      if (
        !(((((((key0 === "artifactId") || (key0 === "description")) || (key0 === "extensions")) ||
          (key0 === "metadata")) || (key0 === "name")) || (key0 === "parts")) ||
          (pattern106.test(key0)))
      ) {
        const err0 = {
          instancePath,
          schemaPath: "#/additionalProperties",
          keyword: "additionalProperties",
          params: { additionalProperty: key0 },
          message: "must NOT have additional properties",
        };
        if (vErrors === null) {
          vErrors = [err0];
        } else {
          vErrors.push(err0);
        }
        errors++;
      }
    }
    if (data.artifactId !== undefined) {
      if (typeof data.artifactId !== "string") {
        const err1 = {
          instancePath: instancePath + "/artifactId",
          schemaPath: "#/properties/artifactId/type",
          keyword: "type",
          params: { type: "string" },
          message: "must be string",
        };
        if (vErrors === null) {
          vErrors = [err1];
        } else {
          vErrors.push(err1);
        }
        errors++;
      }
    }
    if (data.description !== undefined) {
      if (typeof data.description !== "string") {
        const err2 = {
          instancePath: instancePath + "/description",
          schemaPath: "#/properties/description/type",
          keyword: "type",
          params: { type: "string" },
          message: "must be string",
        };
        if (vErrors === null) {
          vErrors = [err2];
        } else {
          vErrors.push(err2);
        }
        errors++;
      }
    }
    if (data.extensions !== undefined) {
      let data2 = data.extensions;
      if (Array.isArray(data2)) {
        const len0 = data2.length;
        for (let i0 = 0; i0 < len0; i0++) {
          if (typeof data2[i0] !== "string") {
            const err3 = {
              instancePath: instancePath + "/extensions/" + i0,
              schemaPath: "#/properties/extensions/items/type",
              keyword: "type",
              params: { type: "string" },
              message: "must be string",
            };
            if (vErrors === null) {
              vErrors = [err3];
            } else {
              vErrors.push(err3);
            }
            errors++;
          }
        }
      } else {
        const err4 = {
          instancePath: instancePath + "/extensions",
          schemaPath: "#/properties/extensions/type",
          keyword: "type",
          params: { type: "array" },
          message: "must be array",
        };
        if (vErrors === null) {
          vErrors = [err4];
        } else {
          vErrors.push(err4);
        }
        errors++;
      }
    }
    if (data.metadata !== undefined) {
      let data4 = data.metadata;
      if (!(data4 && typeof data4 == "object" && !Array.isArray(data4))) {
        const err5 = {
          instancePath: instancePath + "/metadata",
          schemaPath: "#/definitions/Struct/type",
          keyword: "type",
          params: { type: "object" },
          message: "must be object",
        };
        if (vErrors === null) {
          vErrors = [err5];
        } else {
          vErrors.push(err5);
        }
        errors++;
      }
    }
    if (data.name !== undefined) {
      if (typeof data.name !== "string") {
        const err6 = {
          instancePath: instancePath + "/name",
          schemaPath: "#/properties/name/type",
          keyword: "type",
          params: { type: "string" },
          message: "must be string",
        };
        if (vErrors === null) {
          vErrors = [err6];
        } else {
          vErrors.push(err6);
        }
        errors++;
      }
    }
    if (data.parts !== undefined) {
      let data6 = data.parts;
      if (Array.isArray(data6)) {
        const len1 = data6.length;
        for (let i1 = 0; i1 < len1; i1++) {
          if (
            !(validate47(data6[i1], {
              instancePath: instancePath + "/parts/" + i1,
              parentData: data6,
              parentDataProperty: i1,
              rootData,
              dynamicAnchors,
            }))
          ) {
            vErrors = vErrors === null ? validate47.errors : vErrors.concat(validate47.errors);
            errors = vErrors.length;
          }
        }
      } else {
        const err7 = {
          instancePath: instancePath + "/parts",
          schemaPath: "#/properties/parts/type",
          keyword: "type",
          params: { type: "array" },
          message: "must be array",
        };
        if (vErrors === null) {
          vErrors = [err7];
        } else {
          vErrors.push(err7);
        }
        errors++;
      }
    }
    for (const key1 in data) {
      if (pattern106.test(key1)) {
        if (typeof data[key1] !== "string") {
          const err8 = {
            instancePath: instancePath + "/" + key1.replace(/~/g, "~0").replace(/\//g, "~1"),
            schemaPath: "#/patternProperties/%5E(artifact_id)%24/type",
            keyword: "type",
            params: { type: "string" },
            message: "must be string",
          };
          if (vErrors === null) {
            vErrors = [err8];
          } else {
            vErrors.push(err8);
          }
          errors++;
        }
      }
    }
  } else {
    const err9 = {
      instancePath,
      schemaPath: "#/type",
      keyword: "type",
      params: { type: "object" },
      message: "must be object",
    };
    if (vErrors === null) {
      vErrors = [err9];
    } else {
      vErrors.push(err9);
    }
    errors++;
  }
  validate46.errors = vErrors;
  return errors === 0;
}
validate46.evaluated = { "props": true, "dynamicProps": false, "dynamicItems": false };

function validate45(
  data,
  { instancePath = "", parentData, parentDataProperty, rootData = data, dynamicAnchors = {} } = {},
) {
  /*# sourceURL="https://point-and-shoot.invalid/schemas/a2a/v1/validateArtifact" */
  let vErrors = null;
  let errors = 0;
  const evaluated0 = validate45.evaluated;
  if (evaluated0.dynamicProps) {
    evaluated0.props = undefined;
  }
  if (evaluated0.dynamicItems) {
    evaluated0.items = undefined;
  }
  if (
    !(validate46(data, { instancePath, parentData, parentDataProperty, rootData, dynamicAnchors }))
  ) {
    vErrors = vErrors === null ? validate46.errors : vErrors.concat(validate46.errors);
    errors = vErrors.length;
  }
  validate45.errors = vErrors;
  return errors === 0;
}
validate45.evaluated = { "props": true, "dynamicProps": false, "dynamicItems": false };

export const validateMessage = validate50;
const schema70 = {
  "$id": "https://point-and-shoot.invalid/schemas/a2a/v1/validateMessage",
  "$ref": "https://point-and-shoot.invalid/schemas/a2a/v1#/definitions/Message",
};
const schema71 = {
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "additionalProperties": false,
  "description":
    "`Message` is one unit of communication between client and server. It can be\n associated with a context and/or a task. For server messages, `context_id` must\n be provided, and `task_id` only if a task was created. For client messages, both\n fields are optional, with the caveat that if both are provided, they have to\n match (the `context_id` has to be the one that is set on the task). If only\n `task_id` is provided, the server will infer `context_id` from it.",
  "patternProperties": {
    "^(context_id)$": {
      "default": "",
      "description":
        "Optional. The context id of the message. If set, the message will be associated with the given context.",
      "type": "string",
    },
    "^(message_id)$": {
      "default": "",
      "description":
        "The unique identifier (e.g. UUID) of the message. This is created by the message creator.",
      "type": "string",
    },
    "^(reference_task_ids)$": {
      "description": "A list of task IDs that this message references for additional context.",
      "items": { "type": "string" },
      "type": "array",
    },
    "^(task_id)$": {
      "default": "",
      "description":
        "Optional. The task id of the message. If set, the message will be associated with the given task.",
      "type": "string",
    },
  },
  "properties": {
    "contextId": {
      "default": "",
      "description":
        "Optional. The context id of the message. If set, the message will be associated with the given context.",
      "type": "string",
    },
    "extensions": {
      "description": "The URIs of extensions that are present or contributed to this Message.",
      "items": { "type": "string" },
      "type": "array",
    },
    "messageId": {
      "default": "",
      "description":
        "The unique identifier (e.g. UUID) of the message. This is created by the message creator.",
      "type": "string",
    },
    "metadata": {
      "$ref": "#/definitions/Struct",
      "description": "Optional. Any metadata to provide along with the message.",
    },
    "parts": {
      "description": "Parts is the container of the message content.",
      "items": { "$ref": "#/definitions/Part" },
      "type": "array",
    },
    "referenceTaskIds": {
      "description": "A list of task IDs that this message references for additional context.",
      "items": { "type": "string" },
      "type": "array",
    },
    "role": {
      "anyOf": [{ "pattern": "^ROLE_UNSPECIFIED$", "type": "string" }, {
        "enum": ["ROLE_USER", "ROLE_AGENT"],
        "type": "string",
      }, { "maximum": 2147483647, "minimum": -2147483648, "type": "integer" }],
      "default": 0,
      "description": "Identifies the sender of the message.",
      "title": "Role",
    },
    "taskId": {
      "default": "",
      "description":
        "Optional. The task id of the message. If set, the message will be associated with the given task.",
      "type": "string",
    },
  },
  "title": "Message",
  "type": "object",
};
const pattern111 = new RegExp("^(context_id)$", "u");
const pattern112 = new RegExp("^(message_id)$", "u");
const pattern113 = new RegExp("^(reference_task_ids)$", "u");
const pattern114 = new RegExp("^(task_id)$", "u");
const pattern115 = new RegExp("^ROLE_UNSPECIFIED$", "u");

function validate51(
  data,
  { instancePath = "", parentData, parentDataProperty, rootData = data, dynamicAnchors = {} } = {},
) {
  let vErrors = null;
  let errors = 0;
  const evaluated0 = validate51.evaluated;
  if (evaluated0.dynamicProps) {
    evaluated0.props = undefined;
  }
  if (evaluated0.dynamicItems) {
    evaluated0.items = undefined;
  }
  if (data && typeof data == "object" && !Array.isArray(data)) {
    for (const key0 in data) {
      if (
        !((((((((((((key0 === "contextId") || (key0 === "extensions")) || (key0 === "messageId")) ||
          (key0 === "metadata")) || (key0 === "parts")) || (key0 === "referenceTaskIds")) ||
          (key0 === "role")) || (key0 === "taskId")) || (pattern111.test(key0))) ||
          (pattern112.test(key0))) || (pattern113.test(key0))) || (pattern114.test(key0)))
      ) {
        const err0 = {
          instancePath,
          schemaPath: "#/additionalProperties",
          keyword: "additionalProperties",
          params: { additionalProperty: key0 },
          message: "must NOT have additional properties",
        };
        if (vErrors === null) {
          vErrors = [err0];
        } else {
          vErrors.push(err0);
        }
        errors++;
      }
    }
    if (data.contextId !== undefined) {
      if (typeof data.contextId !== "string") {
        const err1 = {
          instancePath: instancePath + "/contextId",
          schemaPath: "#/properties/contextId/type",
          keyword: "type",
          params: { type: "string" },
          message: "must be string",
        };
        if (vErrors === null) {
          vErrors = [err1];
        } else {
          vErrors.push(err1);
        }
        errors++;
      }
    }
    if (data.extensions !== undefined) {
      let data1 = data.extensions;
      if (Array.isArray(data1)) {
        const len0 = data1.length;
        for (let i0 = 0; i0 < len0; i0++) {
          if (typeof data1[i0] !== "string") {
            const err2 = {
              instancePath: instancePath + "/extensions/" + i0,
              schemaPath: "#/properties/extensions/items/type",
              keyword: "type",
              params: { type: "string" },
              message: "must be string",
            };
            if (vErrors === null) {
              vErrors = [err2];
            } else {
              vErrors.push(err2);
            }
            errors++;
          }
        }
      } else {
        const err3 = {
          instancePath: instancePath + "/extensions",
          schemaPath: "#/properties/extensions/type",
          keyword: "type",
          params: { type: "array" },
          message: "must be array",
        };
        if (vErrors === null) {
          vErrors = [err3];
        } else {
          vErrors.push(err3);
        }
        errors++;
      }
    }
    if (data.messageId !== undefined) {
      if (typeof data.messageId !== "string") {
        const err4 = {
          instancePath: instancePath + "/messageId",
          schemaPath: "#/properties/messageId/type",
          keyword: "type",
          params: { type: "string" },
          message: "must be string",
        };
        if (vErrors === null) {
          vErrors = [err4];
        } else {
          vErrors.push(err4);
        }
        errors++;
      }
    }
    if (data.metadata !== undefined) {
      let data4 = data.metadata;
      if (!(data4 && typeof data4 == "object" && !Array.isArray(data4))) {
        const err5 = {
          instancePath: instancePath + "/metadata",
          schemaPath: "#/definitions/Struct/type",
          keyword: "type",
          params: { type: "object" },
          message: "must be object",
        };
        if (vErrors === null) {
          vErrors = [err5];
        } else {
          vErrors.push(err5);
        }
        errors++;
      }
    }
    if (data.parts !== undefined) {
      let data5 = data.parts;
      if (Array.isArray(data5)) {
        const len1 = data5.length;
        for (let i1 = 0; i1 < len1; i1++) {
          if (
            !(validate47(data5[i1], {
              instancePath: instancePath + "/parts/" + i1,
              parentData: data5,
              parentDataProperty: i1,
              rootData,
              dynamicAnchors,
            }))
          ) {
            vErrors = vErrors === null ? validate47.errors : vErrors.concat(validate47.errors);
            errors = vErrors.length;
          }
        }
      } else {
        const err6 = {
          instancePath: instancePath + "/parts",
          schemaPath: "#/properties/parts/type",
          keyword: "type",
          params: { type: "array" },
          message: "must be array",
        };
        if (vErrors === null) {
          vErrors = [err6];
        } else {
          vErrors.push(err6);
        }
        errors++;
      }
    }
    if (data.referenceTaskIds !== undefined) {
      let data7 = data.referenceTaskIds;
      if (Array.isArray(data7)) {
        const len2 = data7.length;
        for (let i2 = 0; i2 < len2; i2++) {
          if (typeof data7[i2] !== "string") {
            const err7 = {
              instancePath: instancePath + "/referenceTaskIds/" + i2,
              schemaPath: "#/properties/referenceTaskIds/items/type",
              keyword: "type",
              params: { type: "string" },
              message: "must be string",
            };
            if (vErrors === null) {
              vErrors = [err7];
            } else {
              vErrors.push(err7);
            }
            errors++;
          }
        }
      } else {
        const err8 = {
          instancePath: instancePath + "/referenceTaskIds",
          schemaPath: "#/properties/referenceTaskIds/type",
          keyword: "type",
          params: { type: "array" },
          message: "must be array",
        };
        if (vErrors === null) {
          vErrors = [err8];
        } else {
          vErrors.push(err8);
        }
        errors++;
      }
    }
    if (data.role !== undefined) {
      let data9 = data.role;
      const _errs21 = errors;
      let valid8 = false;
      const _errs22 = errors;
      if (typeof data9 === "string") {
        if (!pattern115.test(data9)) {
          const err9 = {
            instancePath: instancePath + "/role",
            schemaPath: "#/properties/role/anyOf/0/pattern",
            keyword: "pattern",
            params: { pattern: "^ROLE_UNSPECIFIED$" },
            message: 'must match pattern "' + "^ROLE_UNSPECIFIED$" + '"',
          };
          if (vErrors === null) {
            vErrors = [err9];
          } else {
            vErrors.push(err9);
          }
          errors++;
        }
      } else {
        const err10 = {
          instancePath: instancePath + "/role",
          schemaPath: "#/properties/role/anyOf/0/type",
          keyword: "type",
          params: { type: "string" },
          message: "must be string",
        };
        if (vErrors === null) {
          vErrors = [err10];
        } else {
          vErrors.push(err10);
        }
        errors++;
      }
      var _valid0 = _errs22 === errors;
      valid8 = valid8 || _valid0;
      const _errs24 = errors;
      if (typeof data9 !== "string") {
        const err11 = {
          instancePath: instancePath + "/role",
          schemaPath: "#/properties/role/anyOf/1/type",
          keyword: "type",
          params: { type: "string" },
          message: "must be string",
        };
        if (vErrors === null) {
          vErrors = [err11];
        } else {
          vErrors.push(err11);
        }
        errors++;
      }
      if (!((data9 === "ROLE_USER") || (data9 === "ROLE_AGENT"))) {
        const err12 = {
          instancePath: instancePath + "/role",
          schemaPath: "#/properties/role/anyOf/1/enum",
          keyword: "enum",
          params: { allowedValues: schema71.properties.role.anyOf[1].enum },
          message: "must be equal to one of the allowed values",
        };
        if (vErrors === null) {
          vErrors = [err12];
        } else {
          vErrors.push(err12);
        }
        errors++;
      }
      var _valid0 = _errs24 === errors;
      valid8 = valid8 || _valid0;
      const _errs26 = errors;
      if (!((typeof data9 == "number") && (!(data9 % 1) && !isNaN(data9)))) {
        const err13 = {
          instancePath: instancePath + "/role",
          schemaPath: "#/properties/role/anyOf/2/type",
          keyword: "type",
          params: { type: "integer" },
          message: "must be integer",
        };
        if (vErrors === null) {
          vErrors = [err13];
        } else {
          vErrors.push(err13);
        }
        errors++;
      }
      if (typeof data9 == "number") {
        if (data9 > 2147483647 || isNaN(data9)) {
          const err14 = {
            instancePath: instancePath + "/role",
            schemaPath: "#/properties/role/anyOf/2/maximum",
            keyword: "maximum",
            params: { comparison: "<=", limit: 2147483647 },
            message: "must be <= 2147483647",
          };
          if (vErrors === null) {
            vErrors = [err14];
          } else {
            vErrors.push(err14);
          }
          errors++;
        }
        if (data9 < -2147483648 || isNaN(data9)) {
          const err15 = {
            instancePath: instancePath + "/role",
            schemaPath: "#/properties/role/anyOf/2/minimum",
            keyword: "minimum",
            params: { comparison: ">=", limit: -2147483648 },
            message: "must be >= -2147483648",
          };
          if (vErrors === null) {
            vErrors = [err15];
          } else {
            vErrors.push(err15);
          }
          errors++;
        }
      }
      var _valid0 = _errs26 === errors;
      valid8 = valid8 || _valid0;
      if (!valid8) {
        const err16 = {
          instancePath: instancePath + "/role",
          schemaPath: "#/properties/role/anyOf",
          keyword: "anyOf",
          params: {},
          message: "must match a schema in anyOf",
        };
        if (vErrors === null) {
          vErrors = [err16];
        } else {
          vErrors.push(err16);
        }
        errors++;
      } else {
        errors = _errs21;
        if (vErrors !== null) {
          if (_errs21) {
            vErrors.length = _errs21;
          } else {
            vErrors = null;
          }
        }
      }
    }
    if (data.taskId !== undefined) {
      if (typeof data.taskId !== "string") {
        const err17 = {
          instancePath: instancePath + "/taskId",
          schemaPath: "#/properties/taskId/type",
          keyword: "type",
          params: { type: "string" },
          message: "must be string",
        };
        if (vErrors === null) {
          vErrors = [err17];
        } else {
          vErrors.push(err17);
        }
        errors++;
      }
    }
    for (const key1 in data) {
      if (pattern111.test(key1)) {
        if (typeof data[key1] !== "string") {
          const err18 = {
            instancePath: instancePath + "/" + key1.replace(/~/g, "~0").replace(/\//g, "~1"),
            schemaPath: "#/patternProperties/%5E(context_id)%24/type",
            keyword: "type",
            params: { type: "string" },
            message: "must be string",
          };
          if (vErrors === null) {
            vErrors = [err18];
          } else {
            vErrors.push(err18);
          }
          errors++;
        }
      }
    }
    for (const key2 in data) {
      if (pattern112.test(key2)) {
        if (typeof data[key2] !== "string") {
          const err19 = {
            instancePath: instancePath + "/" + key2.replace(/~/g, "~0").replace(/\//g, "~1"),
            schemaPath: "#/patternProperties/%5E(message_id)%24/type",
            keyword: "type",
            params: { type: "string" },
            message: "must be string",
          };
          if (vErrors === null) {
            vErrors = [err19];
          } else {
            vErrors.push(err19);
          }
          errors++;
        }
      }
    }
    for (const key3 in data) {
      if (pattern113.test(key3)) {
        let data13 = data[key3];
        if (Array.isArray(data13)) {
          const len3 = data13.length;
          for (let i3 = 0; i3 < len3; i3++) {
            if (typeof data13[i3] !== "string") {
              const err20 = {
                instancePath: instancePath + "/" + key3.replace(/~/g, "~0").replace(/\//g, "~1") +
                  "/" + i3,
                schemaPath: "#/patternProperties/%5E(reference_task_ids)%24/items/type",
                keyword: "type",
                params: { type: "string" },
                message: "must be string",
              };
              if (vErrors === null) {
                vErrors = [err20];
              } else {
                vErrors.push(err20);
              }
              errors++;
            }
          }
        } else {
          const err21 = {
            instancePath: instancePath + "/" + key3.replace(/~/g, "~0").replace(/\//g, "~1"),
            schemaPath: "#/patternProperties/%5E(reference_task_ids)%24/type",
            keyword: "type",
            params: { type: "array" },
            message: "must be array",
          };
          if (vErrors === null) {
            vErrors = [err21];
          } else {
            vErrors.push(err21);
          }
          errors++;
        }
      }
    }
    for (const key4 in data) {
      if (pattern114.test(key4)) {
        if (typeof data[key4] !== "string") {
          const err22 = {
            instancePath: instancePath + "/" + key4.replace(/~/g, "~0").replace(/\//g, "~1"),
            schemaPath: "#/patternProperties/%5E(task_id)%24/type",
            keyword: "type",
            params: { type: "string" },
            message: "must be string",
          };
          if (vErrors === null) {
            vErrors = [err22];
          } else {
            vErrors.push(err22);
          }
          errors++;
        }
      }
    }
  } else {
    const err23 = {
      instancePath,
      schemaPath: "#/type",
      keyword: "type",
      params: { type: "object" },
      message: "must be object",
    };
    if (vErrors === null) {
      vErrors = [err23];
    } else {
      vErrors.push(err23);
    }
    errors++;
  }
  validate51.errors = vErrors;
  return errors === 0;
}
validate51.evaluated = { "props": true, "dynamicProps": false, "dynamicItems": false };

function validate50(
  data,
  { instancePath = "", parentData, parentDataProperty, rootData = data, dynamicAnchors = {} } = {},
) {
  /*# sourceURL="https://point-and-shoot.invalid/schemas/a2a/v1/validateMessage" */
  let vErrors = null;
  let errors = 0;
  const evaluated0 = validate50.evaluated;
  if (evaluated0.dynamicProps) {
    evaluated0.props = undefined;
  }
  if (evaluated0.dynamicItems) {
    evaluated0.items = undefined;
  }
  if (
    !(validate51(data, { instancePath, parentData, parentDataProperty, rootData, dynamicAnchors }))
  ) {
    vErrors = vErrors === null ? validate51.errors : vErrors.concat(validate51.errors);
    errors = vErrors.length;
  }
  validate50.errors = vErrors;
  return errors === 0;
}
validate50.evaluated = { "props": true, "dynamicProps": false, "dynamicItems": false };

export const validatePart = validate54;
const schema73 = {
  "$id": "https://point-and-shoot.invalid/schemas/a2a/v1/validatePart",
  "$ref": "https://point-and-shoot.invalid/schemas/a2a/v1#/definitions/Part",
};

function validate55(
  data,
  { instancePath = "", parentData, parentDataProperty, rootData = data, dynamicAnchors = {} } = {},
) {
  let vErrors = null;
  let errors = 0;
  const evaluated0 = validate55.evaluated;
  if (evaluated0.dynamicProps) {
    evaluated0.props = undefined;
  }
  if (evaluated0.dynamicItems) {
    evaluated0.items = undefined;
  }
  if (data && typeof data == "object" && !Array.isArray(data)) {
    for (const key0 in data) {
      if (
        !((((((((key0 === "data") || (key0 === "filename")) || (key0 === "mediaType")) ||
          (key0 === "metadata")) || (key0 === "raw")) || (key0 === "text")) || (key0 === "url")) ||
          (pattern107.test(key0)))
      ) {
        const err0 = {
          instancePath,
          schemaPath: "#/additionalProperties",
          keyword: "additionalProperties",
          params: { additionalProperty: key0 },
          message: "must NOT have additional properties",
        };
        if (vErrors === null) {
          vErrors = [err0];
        } else {
          vErrors.push(err0);
        }
        errors++;
      }
    }
    if (data.filename !== undefined) {
      if (typeof data.filename !== "string") {
        const err1 = {
          instancePath: instancePath + "/filename",
          schemaPath: "#/properties/filename/type",
          keyword: "type",
          params: { type: "string" },
          message: "must be string",
        };
        if (vErrors === null) {
          vErrors = [err1];
        } else {
          vErrors.push(err1);
        }
        errors++;
      }
    }
    if (data.mediaType !== undefined) {
      if (typeof data.mediaType !== "string") {
        const err2 = {
          instancePath: instancePath + "/mediaType",
          schemaPath: "#/properties/mediaType/type",
          keyword: "type",
          params: { type: "string" },
          message: "must be string",
        };
        if (vErrors === null) {
          vErrors = [err2];
        } else {
          vErrors.push(err2);
        }
        errors++;
      }
    }
    if (data.metadata !== undefined) {
      let data3 = data.metadata;
      if (!(data3 && typeof data3 == "object" && !Array.isArray(data3))) {
        const err3 = {
          instancePath: instancePath + "/metadata",
          schemaPath: "#/definitions/Struct/type",
          keyword: "type",
          params: { type: "object" },
          message: "must be object",
        };
        if (vErrors === null) {
          vErrors = [err3];
        } else {
          vErrors.push(err3);
        }
        errors++;
      }
    }
    if (data.raw !== undefined) {
      let data4 = data.raw;
      if (typeof data4 === "string") {
        if (!pattern108.test(data4)) {
          const err4 = {
            instancePath: instancePath + "/raw",
            schemaPath: "#/properties/raw/pattern",
            keyword: "pattern",
            params: { pattern: "^[A-Za-z0-9+/]*={0,2}$" },
            message: 'must match pattern "' + "^[A-Za-z0-9+/]*={0,2}$" + '"',
          };
          if (vErrors === null) {
            vErrors = [err4];
          } else {
            vErrors.push(err4);
          }
          errors++;
        }
      } else {
        const err5 = {
          instancePath: instancePath + "/raw",
          schemaPath: "#/properties/raw/type",
          keyword: "type",
          params: { type: "string" },
          message: "must be string",
        };
        if (vErrors === null) {
          vErrors = [err5];
        } else {
          vErrors.push(err5);
        }
        errors++;
      }
    }
    if (data.text !== undefined) {
      if (typeof data.text !== "string") {
        const err6 = {
          instancePath: instancePath + "/text",
          schemaPath: "#/properties/text/type",
          keyword: "type",
          params: { type: "string" },
          message: "must be string",
        };
        if (vErrors === null) {
          vErrors = [err6];
        } else {
          vErrors.push(err6);
        }
        errors++;
      }
    }
    if (data.url !== undefined) {
      if (typeof data.url !== "string") {
        const err7 = {
          instancePath: instancePath + "/url",
          schemaPath: "#/properties/url/type",
          keyword: "type",
          params: { type: "string" },
          message: "must be string",
        };
        if (vErrors === null) {
          vErrors = [err7];
        } else {
          vErrors.push(err7);
        }
        errors++;
      }
    }
    for (const key1 in data) {
      if (pattern107.test(key1)) {
        if (typeof data[key1] !== "string") {
          const err8 = {
            instancePath: instancePath + "/" + key1.replace(/~/g, "~0").replace(/\//g, "~1"),
            schemaPath: "#/patternProperties/%5E(media_type)%24/type",
            keyword: "type",
            params: { type: "string" },
            message: "must be string",
          };
          if (vErrors === null) {
            vErrors = [err8];
          } else {
            vErrors.push(err8);
          }
          errors++;
        }
      }
    }
  } else {
    const err9 = {
      instancePath,
      schemaPath: "#/type",
      keyword: "type",
      params: { type: "object" },
      message: "must be object",
    };
    if (vErrors === null) {
      vErrors = [err9];
    } else {
      vErrors.push(err9);
    }
    errors++;
  }
  validate55.errors = vErrors;
  return errors === 0;
}
validate55.evaluated = { "props": true, "dynamicProps": false, "dynamicItems": false };

function validate54(
  data,
  { instancePath = "", parentData, parentDataProperty, rootData = data, dynamicAnchors = {} } = {},
) {
  /*# sourceURL="https://point-and-shoot.invalid/schemas/a2a/v1/validatePart" */
  let vErrors = null;
  let errors = 0;
  const evaluated0 = validate54.evaluated;
  if (evaluated0.dynamicProps) {
    evaluated0.props = undefined;
  }
  if (evaluated0.dynamicItems) {
    evaluated0.items = undefined;
  }
  if (
    !(validate55(data, { instancePath, parentData, parentDataProperty, rootData, dynamicAnchors }))
  ) {
    vErrors = vErrors === null ? validate55.errors : vErrors.concat(validate55.errors);
    errors = vErrors.length;
  }
  validate54.errors = vErrors;
  return errors === 0;
}
validate54.evaluated = { "props": true, "dynamicProps": false, "dynamicItems": false };

export const validateSendMessageResponse = validate57;
const schema77 = {
  "$id": "https://point-and-shoot.invalid/schemas/a2a/v1/validateSendMessageResponse",
  "$ref": "https://point-and-shoot.invalid/schemas/a2a/v1#/definitions/Send Message Response",
};
const schema78 = {
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "additionalProperties": false,
  "description": "Represents the response for the `SendMessage` method.",
  "properties": {
    "message": { "$ref": "#/definitions/Message", "description": "A message from the agent." },
    "task": {
      "$ref": "#/definitions/Task",
      "description": "The task created or updated by the message.",
    },
  },
  "title": "Send Message Response",
  "type": "object",
};

function validate59(
  data,
  { instancePath = "", parentData, parentDataProperty, rootData = data, dynamicAnchors = {} } = {},
) {
  let vErrors = null;
  let errors = 0;
  const evaluated0 = validate59.evaluated;
  if (evaluated0.dynamicProps) {
    evaluated0.props = undefined;
  }
  if (evaluated0.dynamicItems) {
    evaluated0.items = undefined;
  }
  if (data && typeof data == "object" && !Array.isArray(data)) {
    for (const key0 in data) {
      if (
        !((((((((((((key0 === "contextId") || (key0 === "extensions")) || (key0 === "messageId")) ||
          (key0 === "metadata")) || (key0 === "parts")) || (key0 === "referenceTaskIds")) ||
          (key0 === "role")) || (key0 === "taskId")) || (pattern111.test(key0))) ||
          (pattern112.test(key0))) || (pattern113.test(key0))) || (pattern114.test(key0)))
      ) {
        const err0 = {
          instancePath,
          schemaPath: "#/additionalProperties",
          keyword: "additionalProperties",
          params: { additionalProperty: key0 },
          message: "must NOT have additional properties",
        };
        if (vErrors === null) {
          vErrors = [err0];
        } else {
          vErrors.push(err0);
        }
        errors++;
      }
    }
    if (data.contextId !== undefined) {
      if (typeof data.contextId !== "string") {
        const err1 = {
          instancePath: instancePath + "/contextId",
          schemaPath: "#/properties/contextId/type",
          keyword: "type",
          params: { type: "string" },
          message: "must be string",
        };
        if (vErrors === null) {
          vErrors = [err1];
        } else {
          vErrors.push(err1);
        }
        errors++;
      }
    }
    if (data.extensions !== undefined) {
      let data1 = data.extensions;
      if (Array.isArray(data1)) {
        const len0 = data1.length;
        for (let i0 = 0; i0 < len0; i0++) {
          if (typeof data1[i0] !== "string") {
            const err2 = {
              instancePath: instancePath + "/extensions/" + i0,
              schemaPath: "#/properties/extensions/items/type",
              keyword: "type",
              params: { type: "string" },
              message: "must be string",
            };
            if (vErrors === null) {
              vErrors = [err2];
            } else {
              vErrors.push(err2);
            }
            errors++;
          }
        }
      } else {
        const err3 = {
          instancePath: instancePath + "/extensions",
          schemaPath: "#/properties/extensions/type",
          keyword: "type",
          params: { type: "array" },
          message: "must be array",
        };
        if (vErrors === null) {
          vErrors = [err3];
        } else {
          vErrors.push(err3);
        }
        errors++;
      }
    }
    if (data.messageId !== undefined) {
      if (typeof data.messageId !== "string") {
        const err4 = {
          instancePath: instancePath + "/messageId",
          schemaPath: "#/properties/messageId/type",
          keyword: "type",
          params: { type: "string" },
          message: "must be string",
        };
        if (vErrors === null) {
          vErrors = [err4];
        } else {
          vErrors.push(err4);
        }
        errors++;
      }
    }
    if (data.metadata !== undefined) {
      let data4 = data.metadata;
      if (!(data4 && typeof data4 == "object" && !Array.isArray(data4))) {
        const err5 = {
          instancePath: instancePath + "/metadata",
          schemaPath: "#/definitions/Struct/type",
          keyword: "type",
          params: { type: "object" },
          message: "must be object",
        };
        if (vErrors === null) {
          vErrors = [err5];
        } else {
          vErrors.push(err5);
        }
        errors++;
      }
    }
    if (data.parts !== undefined) {
      let data5 = data.parts;
      if (Array.isArray(data5)) {
        const len1 = data5.length;
        for (let i1 = 0; i1 < len1; i1++) {
          if (
            !(validate47(data5[i1], {
              instancePath: instancePath + "/parts/" + i1,
              parentData: data5,
              parentDataProperty: i1,
              rootData,
              dynamicAnchors,
            }))
          ) {
            vErrors = vErrors === null ? validate47.errors : vErrors.concat(validate47.errors);
            errors = vErrors.length;
          }
        }
      } else {
        const err6 = {
          instancePath: instancePath + "/parts",
          schemaPath: "#/properties/parts/type",
          keyword: "type",
          params: { type: "array" },
          message: "must be array",
        };
        if (vErrors === null) {
          vErrors = [err6];
        } else {
          vErrors.push(err6);
        }
        errors++;
      }
    }
    if (data.referenceTaskIds !== undefined) {
      let data7 = data.referenceTaskIds;
      if (Array.isArray(data7)) {
        const len2 = data7.length;
        for (let i2 = 0; i2 < len2; i2++) {
          if (typeof data7[i2] !== "string") {
            const err7 = {
              instancePath: instancePath + "/referenceTaskIds/" + i2,
              schemaPath: "#/properties/referenceTaskIds/items/type",
              keyword: "type",
              params: { type: "string" },
              message: "must be string",
            };
            if (vErrors === null) {
              vErrors = [err7];
            } else {
              vErrors.push(err7);
            }
            errors++;
          }
        }
      } else {
        const err8 = {
          instancePath: instancePath + "/referenceTaskIds",
          schemaPath: "#/properties/referenceTaskIds/type",
          keyword: "type",
          params: { type: "array" },
          message: "must be array",
        };
        if (vErrors === null) {
          vErrors = [err8];
        } else {
          vErrors.push(err8);
        }
        errors++;
      }
    }
    if (data.role !== undefined) {
      let data9 = data.role;
      const _errs21 = errors;
      let valid8 = false;
      const _errs22 = errors;
      if (typeof data9 === "string") {
        if (!pattern115.test(data9)) {
          const err9 = {
            instancePath: instancePath + "/role",
            schemaPath: "#/properties/role/anyOf/0/pattern",
            keyword: "pattern",
            params: { pattern: "^ROLE_UNSPECIFIED$" },
            message: 'must match pattern "' + "^ROLE_UNSPECIFIED$" + '"',
          };
          if (vErrors === null) {
            vErrors = [err9];
          } else {
            vErrors.push(err9);
          }
          errors++;
        }
      } else {
        const err10 = {
          instancePath: instancePath + "/role",
          schemaPath: "#/properties/role/anyOf/0/type",
          keyword: "type",
          params: { type: "string" },
          message: "must be string",
        };
        if (vErrors === null) {
          vErrors = [err10];
        } else {
          vErrors.push(err10);
        }
        errors++;
      }
      var _valid0 = _errs22 === errors;
      valid8 = valid8 || _valid0;
      const _errs24 = errors;
      if (typeof data9 !== "string") {
        const err11 = {
          instancePath: instancePath + "/role",
          schemaPath: "#/properties/role/anyOf/1/type",
          keyword: "type",
          params: { type: "string" },
          message: "must be string",
        };
        if (vErrors === null) {
          vErrors = [err11];
        } else {
          vErrors.push(err11);
        }
        errors++;
      }
      if (!((data9 === "ROLE_USER") || (data9 === "ROLE_AGENT"))) {
        const err12 = {
          instancePath: instancePath + "/role",
          schemaPath: "#/properties/role/anyOf/1/enum",
          keyword: "enum",
          params: { allowedValues: schema71.properties.role.anyOf[1].enum },
          message: "must be equal to one of the allowed values",
        };
        if (vErrors === null) {
          vErrors = [err12];
        } else {
          vErrors.push(err12);
        }
        errors++;
      }
      var _valid0 = _errs24 === errors;
      valid8 = valid8 || _valid0;
      const _errs26 = errors;
      if (!((typeof data9 == "number") && (!(data9 % 1) && !isNaN(data9)))) {
        const err13 = {
          instancePath: instancePath + "/role",
          schemaPath: "#/properties/role/anyOf/2/type",
          keyword: "type",
          params: { type: "integer" },
          message: "must be integer",
        };
        if (vErrors === null) {
          vErrors = [err13];
        } else {
          vErrors.push(err13);
        }
        errors++;
      }
      if (typeof data9 == "number") {
        if (data9 > 2147483647 || isNaN(data9)) {
          const err14 = {
            instancePath: instancePath + "/role",
            schemaPath: "#/properties/role/anyOf/2/maximum",
            keyword: "maximum",
            params: { comparison: "<=", limit: 2147483647 },
            message: "must be <= 2147483647",
          };
          if (vErrors === null) {
            vErrors = [err14];
          } else {
            vErrors.push(err14);
          }
          errors++;
        }
        if (data9 < -2147483648 || isNaN(data9)) {
          const err15 = {
            instancePath: instancePath + "/role",
            schemaPath: "#/properties/role/anyOf/2/minimum",
            keyword: "minimum",
            params: { comparison: ">=", limit: -2147483648 },
            message: "must be >= -2147483648",
          };
          if (vErrors === null) {
            vErrors = [err15];
          } else {
            vErrors.push(err15);
          }
          errors++;
        }
      }
      var _valid0 = _errs26 === errors;
      valid8 = valid8 || _valid0;
      if (!valid8) {
        const err16 = {
          instancePath: instancePath + "/role",
          schemaPath: "#/properties/role/anyOf",
          keyword: "anyOf",
          params: {},
          message: "must match a schema in anyOf",
        };
        if (vErrors === null) {
          vErrors = [err16];
        } else {
          vErrors.push(err16);
        }
        errors++;
      } else {
        errors = _errs21;
        if (vErrors !== null) {
          if (_errs21) {
            vErrors.length = _errs21;
          } else {
            vErrors = null;
          }
        }
      }
    }
    if (data.taskId !== undefined) {
      if (typeof data.taskId !== "string") {
        const err17 = {
          instancePath: instancePath + "/taskId",
          schemaPath: "#/properties/taskId/type",
          keyword: "type",
          params: { type: "string" },
          message: "must be string",
        };
        if (vErrors === null) {
          vErrors = [err17];
        } else {
          vErrors.push(err17);
        }
        errors++;
      }
    }
    for (const key1 in data) {
      if (pattern111.test(key1)) {
        if (typeof data[key1] !== "string") {
          const err18 = {
            instancePath: instancePath + "/" + key1.replace(/~/g, "~0").replace(/\//g, "~1"),
            schemaPath: "#/patternProperties/%5E(context_id)%24/type",
            keyword: "type",
            params: { type: "string" },
            message: "must be string",
          };
          if (vErrors === null) {
            vErrors = [err18];
          } else {
            vErrors.push(err18);
          }
          errors++;
        }
      }
    }
    for (const key2 in data) {
      if (pattern112.test(key2)) {
        if (typeof data[key2] !== "string") {
          const err19 = {
            instancePath: instancePath + "/" + key2.replace(/~/g, "~0").replace(/\//g, "~1"),
            schemaPath: "#/patternProperties/%5E(message_id)%24/type",
            keyword: "type",
            params: { type: "string" },
            message: "must be string",
          };
          if (vErrors === null) {
            vErrors = [err19];
          } else {
            vErrors.push(err19);
          }
          errors++;
        }
      }
    }
    for (const key3 in data) {
      if (pattern113.test(key3)) {
        let data13 = data[key3];
        if (Array.isArray(data13)) {
          const len3 = data13.length;
          for (let i3 = 0; i3 < len3; i3++) {
            if (typeof data13[i3] !== "string") {
              const err20 = {
                instancePath: instancePath + "/" + key3.replace(/~/g, "~0").replace(/\//g, "~1") +
                  "/" + i3,
                schemaPath: "#/patternProperties/%5E(reference_task_ids)%24/items/type",
                keyword: "type",
                params: { type: "string" },
                message: "must be string",
              };
              if (vErrors === null) {
                vErrors = [err20];
              } else {
                vErrors.push(err20);
              }
              errors++;
            }
          }
        } else {
          const err21 = {
            instancePath: instancePath + "/" + key3.replace(/~/g, "~0").replace(/\//g, "~1"),
            schemaPath: "#/patternProperties/%5E(reference_task_ids)%24/type",
            keyword: "type",
            params: { type: "array" },
            message: "must be array",
          };
          if (vErrors === null) {
            vErrors = [err21];
          } else {
            vErrors.push(err21);
          }
          errors++;
        }
      }
    }
    for (const key4 in data) {
      if (pattern114.test(key4)) {
        if (typeof data[key4] !== "string") {
          const err22 = {
            instancePath: instancePath + "/" + key4.replace(/~/g, "~0").replace(/\//g, "~1"),
            schemaPath: "#/patternProperties/%5E(task_id)%24/type",
            keyword: "type",
            params: { type: "string" },
            message: "must be string",
          };
          if (vErrors === null) {
            vErrors = [err22];
          } else {
            vErrors.push(err22);
          }
          errors++;
        }
      }
    }
  } else {
    const err23 = {
      instancePath,
      schemaPath: "#/type",
      keyword: "type",
      params: { type: "object" },
      message: "must be object",
    };
    if (vErrors === null) {
      vErrors = [err23];
    } else {
      vErrors.push(err23);
    }
    errors++;
  }
  validate59.errors = vErrors;
  return errors === 0;
}
validate59.evaluated = { "props": true, "dynamicProps": false, "dynamicItems": false };

const schema81 = {
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "additionalProperties": false,
  "description":
    "`Task` is the core unit of action for A2A. It has a current status\n and when results are created for the task they are stored in the\n artifact. If there are multiple turns for a task, these are stored in\n history.",
  "patternProperties": {
    "^(context_id)$": {
      "default": "",
      "description":
        "Unique identifier (e.g. UUID) for the contextual collection of interactions\n (tasks and messages).",
      "type": "string",
    },
  },
  "properties": {
    "artifacts": {
      "description": "A set of output artifacts for a `Task`.",
      "items": { "$ref": "#/definitions/Artifact" },
      "type": "array",
    },
    "contextId": {
      "default": "",
      "description":
        "Unique identifier (e.g. UUID) for the contextual collection of interactions\n (tasks and messages).",
      "type": "string",
    },
    "history": {
      "description": "The history of interactions from a `Task`.",
      "items": { "$ref": "#/definitions/Message" },
      "type": "array",
    },
    "id": {
      "default": "",
      "description":
        "Unique identifier (e.g. UUID) for the task, generated by the server for a\n new task.",
      "type": "string",
    },
    "metadata": {
      "$ref": "#/definitions/Struct",
      "description": "A key/value object to store custom metadata about a task.",
    },
    "status": {
      "$ref": "#/definitions/Task Status",
      "description": "The current status of a `Task`, including `state` and a `message`.",
    },
  },
  "title": "Task",
  "type": "object",
};

function validate63(
  data,
  { instancePath = "", parentData, parentDataProperty, rootData = data, dynamicAnchors = {} } = {},
) {
  let vErrors = null;
  let errors = 0;
  const evaluated0 = validate63.evaluated;
  if (evaluated0.dynamicProps) {
    evaluated0.props = undefined;
  }
  if (evaluated0.dynamicItems) {
    evaluated0.items = undefined;
  }
  if (data && typeof data == "object" && !Array.isArray(data)) {
    for (const key0 in data) {
      if (
        !(((((((key0 === "artifactId") || (key0 === "description")) || (key0 === "extensions")) ||
          (key0 === "metadata")) || (key0 === "name")) || (key0 === "parts")) ||
          (pattern106.test(key0)))
      ) {
        const err0 = {
          instancePath,
          schemaPath: "#/additionalProperties",
          keyword: "additionalProperties",
          params: { additionalProperty: key0 },
          message: "must NOT have additional properties",
        };
        if (vErrors === null) {
          vErrors = [err0];
        } else {
          vErrors.push(err0);
        }
        errors++;
      }
    }
    if (data.artifactId !== undefined) {
      if (typeof data.artifactId !== "string") {
        const err1 = {
          instancePath: instancePath + "/artifactId",
          schemaPath: "#/properties/artifactId/type",
          keyword: "type",
          params: { type: "string" },
          message: "must be string",
        };
        if (vErrors === null) {
          vErrors = [err1];
        } else {
          vErrors.push(err1);
        }
        errors++;
      }
    }
    if (data.description !== undefined) {
      if (typeof data.description !== "string") {
        const err2 = {
          instancePath: instancePath + "/description",
          schemaPath: "#/properties/description/type",
          keyword: "type",
          params: { type: "string" },
          message: "must be string",
        };
        if (vErrors === null) {
          vErrors = [err2];
        } else {
          vErrors.push(err2);
        }
        errors++;
      }
    }
    if (data.extensions !== undefined) {
      let data2 = data.extensions;
      if (Array.isArray(data2)) {
        const len0 = data2.length;
        for (let i0 = 0; i0 < len0; i0++) {
          if (typeof data2[i0] !== "string") {
            const err3 = {
              instancePath: instancePath + "/extensions/" + i0,
              schemaPath: "#/properties/extensions/items/type",
              keyword: "type",
              params: { type: "string" },
              message: "must be string",
            };
            if (vErrors === null) {
              vErrors = [err3];
            } else {
              vErrors.push(err3);
            }
            errors++;
          }
        }
      } else {
        const err4 = {
          instancePath: instancePath + "/extensions",
          schemaPath: "#/properties/extensions/type",
          keyword: "type",
          params: { type: "array" },
          message: "must be array",
        };
        if (vErrors === null) {
          vErrors = [err4];
        } else {
          vErrors.push(err4);
        }
        errors++;
      }
    }
    if (data.metadata !== undefined) {
      let data4 = data.metadata;
      if (!(data4 && typeof data4 == "object" && !Array.isArray(data4))) {
        const err5 = {
          instancePath: instancePath + "/metadata",
          schemaPath: "#/definitions/Struct/type",
          keyword: "type",
          params: { type: "object" },
          message: "must be object",
        };
        if (vErrors === null) {
          vErrors = [err5];
        } else {
          vErrors.push(err5);
        }
        errors++;
      }
    }
    if (data.name !== undefined) {
      if (typeof data.name !== "string") {
        const err6 = {
          instancePath: instancePath + "/name",
          schemaPath: "#/properties/name/type",
          keyword: "type",
          params: { type: "string" },
          message: "must be string",
        };
        if (vErrors === null) {
          vErrors = [err6];
        } else {
          vErrors.push(err6);
        }
        errors++;
      }
    }
    if (data.parts !== undefined) {
      let data6 = data.parts;
      if (Array.isArray(data6)) {
        const len1 = data6.length;
        for (let i1 = 0; i1 < len1; i1++) {
          if (
            !(validate47(data6[i1], {
              instancePath: instancePath + "/parts/" + i1,
              parentData: data6,
              parentDataProperty: i1,
              rootData,
              dynamicAnchors,
            }))
          ) {
            vErrors = vErrors === null ? validate47.errors : vErrors.concat(validate47.errors);
            errors = vErrors.length;
          }
        }
      } else {
        const err7 = {
          instancePath: instancePath + "/parts",
          schemaPath: "#/properties/parts/type",
          keyword: "type",
          params: { type: "array" },
          message: "must be array",
        };
        if (vErrors === null) {
          vErrors = [err7];
        } else {
          vErrors.push(err7);
        }
        errors++;
      }
    }
    for (const key1 in data) {
      if (pattern106.test(key1)) {
        if (typeof data[key1] !== "string") {
          const err8 = {
            instancePath: instancePath + "/" + key1.replace(/~/g, "~0").replace(/\//g, "~1"),
            schemaPath: "#/patternProperties/%5E(artifact_id)%24/type",
            keyword: "type",
            params: { type: "string" },
            message: "must be string",
          };
          if (vErrors === null) {
            vErrors = [err8];
          } else {
            vErrors.push(err8);
          }
          errors++;
        }
      }
    }
  } else {
    const err9 = {
      instancePath,
      schemaPath: "#/type",
      keyword: "type",
      params: { type: "object" },
      message: "must be object",
    };
    if (vErrors === null) {
      vErrors = [err9];
    } else {
      vErrors.push(err9);
    }
    errors++;
  }
  validate63.errors = vErrors;
  return errors === 0;
}
validate63.evaluated = { "props": true, "dynamicProps": false, "dynamicItems": false };

const schema85 = {
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "additionalProperties": false,
  "description": "A container for the status of a task",
  "properties": {
    "message": {
      "$ref": "#/definitions/Message",
      "description": "A message associated with the status.",
    },
    "state": {
      "anyOf": [{ "pattern": "^TASK_STATE_UNSPECIFIED$", "type": "string" }, {
        "enum": [
          "TASK_STATE_SUBMITTED",
          "TASK_STATE_WORKING",
          "TASK_STATE_COMPLETED",
          "TASK_STATE_FAILED",
          "TASK_STATE_CANCELED",
          "TASK_STATE_INPUT_REQUIRED",
          "TASK_STATE_REJECTED",
          "TASK_STATE_AUTH_REQUIRED",
        ],
        "type": "string",
      }, { "maximum": 2147483647, "minimum": -2147483648, "type": "integer" }],
      "default": 0,
      "description": "The current state of this task.",
      "title": "Task State",
    },
    "timestamp": {
      "$ref": "#/definitions/Timestamp",
      "description":
        'ISO 8601 Timestamp when the status was recorded.\n Example: "2023-10-27T10:00:00Z"',
    },
  },
  "title": "Task Status",
  "type": "object",
};
const schema86 = {
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "format": "date-time",
  "title": "Timestamp",
  "type": "string",
};
const pattern135 = new RegExp("^TASK_STATE_UNSPECIFIED$", "u");

function validate67(
  data,
  { instancePath = "", parentData, parentDataProperty, rootData = data, dynamicAnchors = {} } = {},
) {
  let vErrors = null;
  let errors = 0;
  const evaluated0 = validate67.evaluated;
  if (evaluated0.dynamicProps) {
    evaluated0.props = undefined;
  }
  if (evaluated0.dynamicItems) {
    evaluated0.items = undefined;
  }
  if (data && typeof data == "object" && !Array.isArray(data)) {
    for (const key0 in data) {
      if (!(((key0 === "message") || (key0 === "state")) || (key0 === "timestamp"))) {
        const err0 = {
          instancePath,
          schemaPath: "#/additionalProperties",
          keyword: "additionalProperties",
          params: { additionalProperty: key0 },
          message: "must NOT have additional properties",
        };
        if (vErrors === null) {
          vErrors = [err0];
        } else {
          vErrors.push(err0);
        }
        errors++;
      }
    }
    if (data.message !== undefined) {
      if (
        !(validate59(data.message, {
          instancePath: instancePath + "/message",
          parentData: data,
          parentDataProperty: "message",
          rootData,
          dynamicAnchors,
        }))
      ) {
        vErrors = vErrors === null ? validate59.errors : vErrors.concat(validate59.errors);
        errors = vErrors.length;
      }
    }
    if (data.state !== undefined) {
      let data1 = data.state;
      const _errs4 = errors;
      let valid1 = false;
      const _errs5 = errors;
      if (typeof data1 === "string") {
        if (!pattern135.test(data1)) {
          const err1 = {
            instancePath: instancePath + "/state",
            schemaPath: "#/properties/state/anyOf/0/pattern",
            keyword: "pattern",
            params: { pattern: "^TASK_STATE_UNSPECIFIED$" },
            message: 'must match pattern "' + "^TASK_STATE_UNSPECIFIED$" + '"',
          };
          if (vErrors === null) {
            vErrors = [err1];
          } else {
            vErrors.push(err1);
          }
          errors++;
        }
      } else {
        const err2 = {
          instancePath: instancePath + "/state",
          schemaPath: "#/properties/state/anyOf/0/type",
          keyword: "type",
          params: { type: "string" },
          message: "must be string",
        };
        if (vErrors === null) {
          vErrors = [err2];
        } else {
          vErrors.push(err2);
        }
        errors++;
      }
      var _valid0 = _errs5 === errors;
      valid1 = valid1 || _valid0;
      const _errs7 = errors;
      if (typeof data1 !== "string") {
        const err3 = {
          instancePath: instancePath + "/state",
          schemaPath: "#/properties/state/anyOf/1/type",
          keyword: "type",
          params: { type: "string" },
          message: "must be string",
        };
        if (vErrors === null) {
          vErrors = [err3];
        } else {
          vErrors.push(err3);
        }
        errors++;
      }
      if (
        !((((((((data1 === "TASK_STATE_SUBMITTED") || (data1 === "TASK_STATE_WORKING")) ||
          (data1 === "TASK_STATE_COMPLETED")) || (data1 === "TASK_STATE_FAILED")) ||
          (data1 === "TASK_STATE_CANCELED")) || (data1 === "TASK_STATE_INPUT_REQUIRED")) ||
          (data1 === "TASK_STATE_REJECTED")) || (data1 === "TASK_STATE_AUTH_REQUIRED"))
      ) {
        const err4 = {
          instancePath: instancePath + "/state",
          schemaPath: "#/properties/state/anyOf/1/enum",
          keyword: "enum",
          params: { allowedValues: schema85.properties.state.anyOf[1].enum },
          message: "must be equal to one of the allowed values",
        };
        if (vErrors === null) {
          vErrors = [err4];
        } else {
          vErrors.push(err4);
        }
        errors++;
      }
      var _valid0 = _errs7 === errors;
      valid1 = valid1 || _valid0;
      const _errs9 = errors;
      if (!((typeof data1 == "number") && (!(data1 % 1) && !isNaN(data1)))) {
        const err5 = {
          instancePath: instancePath + "/state",
          schemaPath: "#/properties/state/anyOf/2/type",
          keyword: "type",
          params: { type: "integer" },
          message: "must be integer",
        };
        if (vErrors === null) {
          vErrors = [err5];
        } else {
          vErrors.push(err5);
        }
        errors++;
      }
      if (typeof data1 == "number") {
        if (data1 > 2147483647 || isNaN(data1)) {
          const err6 = {
            instancePath: instancePath + "/state",
            schemaPath: "#/properties/state/anyOf/2/maximum",
            keyword: "maximum",
            params: { comparison: "<=", limit: 2147483647 },
            message: "must be <= 2147483647",
          };
          if (vErrors === null) {
            vErrors = [err6];
          } else {
            vErrors.push(err6);
          }
          errors++;
        }
        if (data1 < -2147483648 || isNaN(data1)) {
          const err7 = {
            instancePath: instancePath + "/state",
            schemaPath: "#/properties/state/anyOf/2/minimum",
            keyword: "minimum",
            params: { comparison: ">=", limit: -2147483648 },
            message: "must be >= -2147483648",
          };
          if (vErrors === null) {
            vErrors = [err7];
          } else {
            vErrors.push(err7);
          }
          errors++;
        }
      }
      var _valid0 = _errs9 === errors;
      valid1 = valid1 || _valid0;
      if (!valid1) {
        const err8 = {
          instancePath: instancePath + "/state",
          schemaPath: "#/properties/state/anyOf",
          keyword: "anyOf",
          params: {},
          message: "must match a schema in anyOf",
        };
        if (vErrors === null) {
          vErrors = [err8];
        } else {
          vErrors.push(err8);
        }
        errors++;
      } else {
        errors = _errs4;
        if (vErrors !== null) {
          if (_errs4) {
            vErrors.length = _errs4;
          } else {
            vErrors = null;
          }
        }
      }
    }
    if (data.timestamp !== undefined) {
      if (!(typeof data.timestamp === "string")) {
        const err9 = {
          instancePath: instancePath + "/timestamp",
          schemaPath: "#/definitions/Timestamp/type",
          keyword: "type",
          params: { type: "string" },
          message: "must be string",
        };
        if (vErrors === null) {
          vErrors = [err9];
        } else {
          vErrors.push(err9);
        }
        errors++;
      }
    }
  } else {
    const err10 = {
      instancePath,
      schemaPath: "#/type",
      keyword: "type",
      params: { type: "object" },
      message: "must be object",
    };
    if (vErrors === null) {
      vErrors = [err10];
    } else {
      vErrors.push(err10);
    }
    errors++;
  }
  validate67.errors = vErrors;
  return errors === 0;
}
validate67.evaluated = { "props": true, "dynamicProps": false, "dynamicItems": false };

function validate62(
  data,
  { instancePath = "", parentData, parentDataProperty, rootData = data, dynamicAnchors = {} } = {},
) {
  let vErrors = null;
  let errors = 0;
  const evaluated0 = validate62.evaluated;
  if (evaluated0.dynamicProps) {
    evaluated0.props = undefined;
  }
  if (evaluated0.dynamicItems) {
    evaluated0.items = undefined;
  }
  if (data && typeof data == "object" && !Array.isArray(data)) {
    for (const key0 in data) {
      if (
        !(((((((key0 === "artifacts") || (key0 === "contextId")) || (key0 === "history")) ||
          (key0 === "id")) || (key0 === "metadata")) || (key0 === "status")) ||
          (pattern111.test(key0)))
      ) {
        const err0 = {
          instancePath,
          schemaPath: "#/additionalProperties",
          keyword: "additionalProperties",
          params: { additionalProperty: key0 },
          message: "must NOT have additional properties",
        };
        if (vErrors === null) {
          vErrors = [err0];
        } else {
          vErrors.push(err0);
        }
        errors++;
      }
    }
    if (data.artifacts !== undefined) {
      let data0 = data.artifacts;
      if (Array.isArray(data0)) {
        const len0 = data0.length;
        for (let i0 = 0; i0 < len0; i0++) {
          if (
            !(validate63(data0[i0], {
              instancePath: instancePath + "/artifacts/" + i0,
              parentData: data0,
              parentDataProperty: i0,
              rootData,
              dynamicAnchors,
            }))
          ) {
            vErrors = vErrors === null ? validate63.errors : vErrors.concat(validate63.errors);
            errors = vErrors.length;
          }
        }
      } else {
        const err1 = {
          instancePath: instancePath + "/artifacts",
          schemaPath: "#/properties/artifacts/type",
          keyword: "type",
          params: { type: "array" },
          message: "must be array",
        };
        if (vErrors === null) {
          vErrors = [err1];
        } else {
          vErrors.push(err1);
        }
        errors++;
      }
    }
    if (data.contextId !== undefined) {
      if (typeof data.contextId !== "string") {
        const err2 = {
          instancePath: instancePath + "/contextId",
          schemaPath: "#/properties/contextId/type",
          keyword: "type",
          params: { type: "string" },
          message: "must be string",
        };
        if (vErrors === null) {
          vErrors = [err2];
        } else {
          vErrors.push(err2);
        }
        errors++;
      }
    }
    if (data.history !== undefined) {
      let data3 = data.history;
      if (Array.isArray(data3)) {
        const len1 = data3.length;
        for (let i1 = 0; i1 < len1; i1++) {
          if (
            !(validate59(data3[i1], {
              instancePath: instancePath + "/history/" + i1,
              parentData: data3,
              parentDataProperty: i1,
              rootData,
              dynamicAnchors,
            }))
          ) {
            vErrors = vErrors === null ? validate59.errors : vErrors.concat(validate59.errors);
            errors = vErrors.length;
          }
        }
      } else {
        const err3 = {
          instancePath: instancePath + "/history",
          schemaPath: "#/properties/history/type",
          keyword: "type",
          params: { type: "array" },
          message: "must be array",
        };
        if (vErrors === null) {
          vErrors = [err3];
        } else {
          vErrors.push(err3);
        }
        errors++;
      }
    }
    if (data.id !== undefined) {
      if (typeof data.id !== "string") {
        const err4 = {
          instancePath: instancePath + "/id",
          schemaPath: "#/properties/id/type",
          keyword: "type",
          params: { type: "string" },
          message: "must be string",
        };
        if (vErrors === null) {
          vErrors = [err4];
        } else {
          vErrors.push(err4);
        }
        errors++;
      }
    }
    if (data.metadata !== undefined) {
      let data6 = data.metadata;
      if (!(data6 && typeof data6 == "object" && !Array.isArray(data6))) {
        const err5 = {
          instancePath: instancePath + "/metadata",
          schemaPath: "#/definitions/Struct/type",
          keyword: "type",
          params: { type: "object" },
          message: "must be object",
        };
        if (vErrors === null) {
          vErrors = [err5];
        } else {
          vErrors.push(err5);
        }
        errors++;
      }
    }
    if (data.status !== undefined) {
      if (
        !(validate67(data.status, {
          instancePath: instancePath + "/status",
          parentData: data,
          parentDataProperty: "status",
          rootData,
          dynamicAnchors,
        }))
      ) {
        vErrors = vErrors === null ? validate67.errors : vErrors.concat(validate67.errors);
        errors = vErrors.length;
      }
    }
    for (const key1 in data) {
      if (pattern111.test(key1)) {
        if (typeof data[key1] !== "string") {
          const err6 = {
            instancePath: instancePath + "/" + key1.replace(/~/g, "~0").replace(/\//g, "~1"),
            schemaPath: "#/patternProperties/%5E(context_id)%24/type",
            keyword: "type",
            params: { type: "string" },
            message: "must be string",
          };
          if (vErrors === null) {
            vErrors = [err6];
          } else {
            vErrors.push(err6);
          }
          errors++;
        }
      }
    }
  } else {
    const err7 = {
      instancePath,
      schemaPath: "#/type",
      keyword: "type",
      params: { type: "object" },
      message: "must be object",
    };
    if (vErrors === null) {
      vErrors = [err7];
    } else {
      vErrors.push(err7);
    }
    errors++;
  }
  validate62.errors = vErrors;
  return errors === 0;
}
validate62.evaluated = { "props": true, "dynamicProps": false, "dynamicItems": false };

function validate58(
  data,
  { instancePath = "", parentData, parentDataProperty, rootData = data, dynamicAnchors = {} } = {},
) {
  let vErrors = null;
  let errors = 0;
  const evaluated0 = validate58.evaluated;
  if (evaluated0.dynamicProps) {
    evaluated0.props = undefined;
  }
  if (evaluated0.dynamicItems) {
    evaluated0.items = undefined;
  }
  if (data && typeof data == "object" && !Array.isArray(data)) {
    for (const key0 in data) {
      if (!((key0 === "message") || (key0 === "task"))) {
        const err0 = {
          instancePath,
          schemaPath: "#/additionalProperties",
          keyword: "additionalProperties",
          params: { additionalProperty: key0 },
          message: "must NOT have additional properties",
        };
        if (vErrors === null) {
          vErrors = [err0];
        } else {
          vErrors.push(err0);
        }
        errors++;
      }
    }
    if (data.message !== undefined) {
      if (
        !(validate59(data.message, {
          instancePath: instancePath + "/message",
          parentData: data,
          parentDataProperty: "message",
          rootData,
          dynamicAnchors,
        }))
      ) {
        vErrors = vErrors === null ? validate59.errors : vErrors.concat(validate59.errors);
        errors = vErrors.length;
      }
    }
    if (data.task !== undefined) {
      if (
        !(validate62(data.task, {
          instancePath: instancePath + "/task",
          parentData: data,
          parentDataProperty: "task",
          rootData,
          dynamicAnchors,
        }))
      ) {
        vErrors = vErrors === null ? validate62.errors : vErrors.concat(validate62.errors);
        errors = vErrors.length;
      }
    }
  } else {
    const err1 = {
      instancePath,
      schemaPath: "#/type",
      keyword: "type",
      params: { type: "object" },
      message: "must be object",
    };
    if (vErrors === null) {
      vErrors = [err1];
    } else {
      vErrors.push(err1);
    }
    errors++;
  }
  validate58.errors = vErrors;
  return errors === 0;
}
validate58.evaluated = { "props": true, "dynamicProps": false, "dynamicItems": false };

function validate57(
  data,
  { instancePath = "", parentData, parentDataProperty, rootData = data, dynamicAnchors = {} } = {},
) {
  /*# sourceURL="https://point-and-shoot.invalid/schemas/a2a/v1/validateSendMessageResponse" */
  let vErrors = null;
  let errors = 0;
  const evaluated0 = validate57.evaluated;
  if (evaluated0.dynamicProps) {
    evaluated0.props = undefined;
  }
  if (evaluated0.dynamicItems) {
    evaluated0.items = undefined;
  }
  if (
    !(validate58(data, { instancePath, parentData, parentDataProperty, rootData, dynamicAnchors }))
  ) {
    vErrors = vErrors === null ? validate58.errors : vErrors.concat(validate58.errors);
    errors = vErrors.length;
  }
  validate57.errors = vErrors;
  return errors === 0;
}
validate57.evaluated = { "props": true, "dynamicProps": false, "dynamicItems": false };

export const validateStreamResponse = validate72;
const schema87 = {
  "$id": "https://point-and-shoot.invalid/schemas/a2a/v1/validateStreamResponse",
  "$ref": "https://point-and-shoot.invalid/schemas/a2a/v1#/definitions/Stream Response",
};
const schema88 = {
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "additionalProperties": false,
  "description":
    "A wrapper object used in streaming operations to encapsulate different types of response data.",
  "patternProperties": {
    "^(artifact_update)$": {
      "$ref": "#/definitions/Task Artifact Update Event",
      "description": "An event indicating a task artifact update.",
    },
    "^(status_update)$": {
      "$ref": "#/definitions/Task Status Update Event",
      "description": "An event indicating a task status update.",
    },
  },
  "properties": {
    "artifactUpdate": {
      "$ref": "#/definitions/Task Artifact Update Event",
      "description": "An event indicating a task artifact update.",
    },
    "message": {
      "$ref": "#/definitions/Message",
      "description": "A Message object containing a message from the agent.",
    },
    "statusUpdate": {
      "$ref": "#/definitions/Task Status Update Event",
      "description": "An event indicating a task status update.",
    },
    "task": {
      "$ref": "#/definitions/Task",
      "description": "A Task object containing the current state of the task.",
    },
  },
  "title": "Stream Response",
  "type": "object",
};
const pattern137 = new RegExp("^(artifact_update)$", "u");
const pattern138 = new RegExp("^(status_update)$", "u");
const schema89 = {
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "additionalProperties": false,
  "description": "A task delta where an artifact has been generated.",
  "patternProperties": {
    "^(context_id)$": {
      "default": "",
      "description": "The ID of the context that this task belongs to.",
      "type": "string",
    },
    "^(last_chunk)$": {
      "default": false,
      "description": "If true, this is the final chunk of the artifact.",
      "type": "boolean",
    },
    "^(task_id)$": {
      "default": "",
      "description": "The ID of the task for this artifact.",
      "type": "string",
    },
  },
  "properties": {
    "append": {
      "default": false,
      "description":
        "If true, the content of this artifact should be appended to a previously\n sent artifact with the same ID.",
      "type": "boolean",
    },
    "artifact": {
      "$ref": "#/definitions/Artifact",
      "description": "The artifact that was generated or updated.",
    },
    "contextId": {
      "default": "",
      "description": "The ID of the context that this task belongs to.",
      "type": "string",
    },
    "lastChunk": {
      "default": false,
      "description": "If true, this is the final chunk of the artifact.",
      "type": "boolean",
    },
    "metadata": {
      "$ref": "#/definitions/Struct",
      "description": "Optional. Metadata associated with the artifact update.",
    },
    "taskId": {
      "default": "",
      "description": "The ID of the task for this artifact.",
      "type": "string",
    },
  },
  "title": "Task Artifact Update Event",
  "type": "object",
};
const pattern140 = new RegExp("^(last_chunk)$", "u");

function validate74(
  data,
  { instancePath = "", parentData, parentDataProperty, rootData = data, dynamicAnchors = {} } = {},
) {
  let vErrors = null;
  let errors = 0;
  const evaluated0 = validate74.evaluated;
  if (evaluated0.dynamicProps) {
    evaluated0.props = undefined;
  }
  if (evaluated0.dynamicItems) {
    evaluated0.items = undefined;
  }
  if (data && typeof data == "object" && !Array.isArray(data)) {
    for (const key0 in data) {
      if (
        !(((((((((key0 === "append") || (key0 === "artifact")) || (key0 === "contextId")) ||
          (key0 === "lastChunk")) || (key0 === "metadata")) || (key0 === "taskId")) ||
          (pattern111.test(key0))) || (pattern140.test(key0))) || (pattern114.test(key0)))
      ) {
        const err0 = {
          instancePath,
          schemaPath: "#/additionalProperties",
          keyword: "additionalProperties",
          params: { additionalProperty: key0 },
          message: "must NOT have additional properties",
        };
        if (vErrors === null) {
          vErrors = [err0];
        } else {
          vErrors.push(err0);
        }
        errors++;
      }
    }
    if (data.append !== undefined) {
      if (typeof data.append !== "boolean") {
        const err1 = {
          instancePath: instancePath + "/append",
          schemaPath: "#/properties/append/type",
          keyword: "type",
          params: { type: "boolean" },
          message: "must be boolean",
        };
        if (vErrors === null) {
          vErrors = [err1];
        } else {
          vErrors.push(err1);
        }
        errors++;
      }
    }
    if (data.artifact !== undefined) {
      if (
        !(validate63(data.artifact, {
          instancePath: instancePath + "/artifact",
          parentData: data,
          parentDataProperty: "artifact",
          rootData,
          dynamicAnchors,
        }))
      ) {
        vErrors = vErrors === null ? validate63.errors : vErrors.concat(validate63.errors);
        errors = vErrors.length;
      }
    }
    if (data.contextId !== undefined) {
      if (typeof data.contextId !== "string") {
        const err2 = {
          instancePath: instancePath + "/contextId",
          schemaPath: "#/properties/contextId/type",
          keyword: "type",
          params: { type: "string" },
          message: "must be string",
        };
        if (vErrors === null) {
          vErrors = [err2];
        } else {
          vErrors.push(err2);
        }
        errors++;
      }
    }
    if (data.lastChunk !== undefined) {
      if (typeof data.lastChunk !== "boolean") {
        const err3 = {
          instancePath: instancePath + "/lastChunk",
          schemaPath: "#/properties/lastChunk/type",
          keyword: "type",
          params: { type: "boolean" },
          message: "must be boolean",
        };
        if (vErrors === null) {
          vErrors = [err3];
        } else {
          vErrors.push(err3);
        }
        errors++;
      }
    }
    if (data.metadata !== undefined) {
      let data4 = data.metadata;
      if (!(data4 && typeof data4 == "object" && !Array.isArray(data4))) {
        const err4 = {
          instancePath: instancePath + "/metadata",
          schemaPath: "#/definitions/Struct/type",
          keyword: "type",
          params: { type: "object" },
          message: "must be object",
        };
        if (vErrors === null) {
          vErrors = [err4];
        } else {
          vErrors.push(err4);
        }
        errors++;
      }
    }
    if (data.taskId !== undefined) {
      if (typeof data.taskId !== "string") {
        const err5 = {
          instancePath: instancePath + "/taskId",
          schemaPath: "#/properties/taskId/type",
          keyword: "type",
          params: { type: "string" },
          message: "must be string",
        };
        if (vErrors === null) {
          vErrors = [err5];
        } else {
          vErrors.push(err5);
        }
        errors++;
      }
    }
    for (const key1 in data) {
      if (pattern111.test(key1)) {
        if (typeof data[key1] !== "string") {
          const err6 = {
            instancePath: instancePath + "/" + key1.replace(/~/g, "~0").replace(/\//g, "~1"),
            schemaPath: "#/patternProperties/%5E(context_id)%24/type",
            keyword: "type",
            params: { type: "string" },
            message: "must be string",
          };
          if (vErrors === null) {
            vErrors = [err6];
          } else {
            vErrors.push(err6);
          }
          errors++;
        }
      }
    }
    for (const key2 in data) {
      if (pattern140.test(key2)) {
        if (typeof data[key2] !== "boolean") {
          const err7 = {
            instancePath: instancePath + "/" + key2.replace(/~/g, "~0").replace(/\//g, "~1"),
            schemaPath: "#/patternProperties/%5E(last_chunk)%24/type",
            keyword: "type",
            params: { type: "boolean" },
            message: "must be boolean",
          };
          if (vErrors === null) {
            vErrors = [err7];
          } else {
            vErrors.push(err7);
          }
          errors++;
        }
      }
    }
    for (const key3 in data) {
      if (pattern114.test(key3)) {
        if (typeof data[key3] !== "string") {
          const err8 = {
            instancePath: instancePath + "/" + key3.replace(/~/g, "~0").replace(/\//g, "~1"),
            schemaPath: "#/patternProperties/%5E(task_id)%24/type",
            keyword: "type",
            params: { type: "string" },
            message: "must be string",
          };
          if (vErrors === null) {
            vErrors = [err8];
          } else {
            vErrors.push(err8);
          }
          errors++;
        }
      }
    }
  } else {
    const err9 = {
      instancePath,
      schemaPath: "#/type",
      keyword: "type",
      params: { type: "object" },
      message: "must be object",
    };
    if (vErrors === null) {
      vErrors = [err9];
    } else {
      vErrors.push(err9);
    }
    errors++;
  }
  validate74.errors = vErrors;
  return errors === 0;
}
validate74.evaluated = { "props": true, "dynamicProps": false, "dynamicItems": false };

const schema91 = {
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "additionalProperties": false,
  "description": "An event sent by the agent to notify the client of a change in a task's status.",
  "patternProperties": {
    "^(context_id)$": {
      "default": "",
      "description": "The ID of the context that the task belongs to.",
      "type": "string",
    },
    "^(task_id)$": {
      "default": "",
      "description": "The ID of the task that has changed.",
      "type": "string",
    },
  },
  "properties": {
    "contextId": {
      "default": "",
      "description": "The ID of the context that the task belongs to.",
      "type": "string",
    },
    "metadata": {
      "$ref": "#/definitions/Struct",
      "description": "Optional. Metadata associated with the task update.",
    },
    "status": { "$ref": "#/definitions/Task Status", "description": "The new status of the task." },
    "taskId": {
      "default": "",
      "description": "The ID of the task that has changed.",
      "type": "string",
    },
  },
  "title": "Task Status Update Event",
  "type": "object",
};

function validate78(
  data,
  { instancePath = "", parentData, parentDataProperty, rootData = data, dynamicAnchors = {} } = {},
) {
  let vErrors = null;
  let errors = 0;
  const evaluated0 = validate78.evaluated;
  if (evaluated0.dynamicProps) {
    evaluated0.props = undefined;
  }
  if (evaluated0.dynamicItems) {
    evaluated0.items = undefined;
  }
  if (data && typeof data == "object" && !Array.isArray(data)) {
    for (const key0 in data) {
      if (
        !((((((key0 === "contextId") || (key0 === "metadata")) || (key0 === "status")) ||
          (key0 === "taskId")) || (pattern111.test(key0))) || (pattern114.test(key0)))
      ) {
        const err0 = {
          instancePath,
          schemaPath: "#/additionalProperties",
          keyword: "additionalProperties",
          params: { additionalProperty: key0 },
          message: "must NOT have additional properties",
        };
        if (vErrors === null) {
          vErrors = [err0];
        } else {
          vErrors.push(err0);
        }
        errors++;
      }
    }
    if (data.contextId !== undefined) {
      if (typeof data.contextId !== "string") {
        const err1 = {
          instancePath: instancePath + "/contextId",
          schemaPath: "#/properties/contextId/type",
          keyword: "type",
          params: { type: "string" },
          message: "must be string",
        };
        if (vErrors === null) {
          vErrors = [err1];
        } else {
          vErrors.push(err1);
        }
        errors++;
      }
    }
    if (data.metadata !== undefined) {
      let data1 = data.metadata;
      if (!(data1 && typeof data1 == "object" && !Array.isArray(data1))) {
        const err2 = {
          instancePath: instancePath + "/metadata",
          schemaPath: "#/definitions/Struct/type",
          keyword: "type",
          params: { type: "object" },
          message: "must be object",
        };
        if (vErrors === null) {
          vErrors = [err2];
        } else {
          vErrors.push(err2);
        }
        errors++;
      }
    }
    if (data.status !== undefined) {
      if (
        !(validate67(data.status, {
          instancePath: instancePath + "/status",
          parentData: data,
          parentDataProperty: "status",
          rootData,
          dynamicAnchors,
        }))
      ) {
        vErrors = vErrors === null ? validate67.errors : vErrors.concat(validate67.errors);
        errors = vErrors.length;
      }
    }
    if (data.taskId !== undefined) {
      if (typeof data.taskId !== "string") {
        const err3 = {
          instancePath: instancePath + "/taskId",
          schemaPath: "#/properties/taskId/type",
          keyword: "type",
          params: { type: "string" },
          message: "must be string",
        };
        if (vErrors === null) {
          vErrors = [err3];
        } else {
          vErrors.push(err3);
        }
        errors++;
      }
    }
    for (const key1 in data) {
      if (pattern111.test(key1)) {
        if (typeof data[key1] !== "string") {
          const err4 = {
            instancePath: instancePath + "/" + key1.replace(/~/g, "~0").replace(/\//g, "~1"),
            schemaPath: "#/patternProperties/%5E(context_id)%24/type",
            keyword: "type",
            params: { type: "string" },
            message: "must be string",
          };
          if (vErrors === null) {
            vErrors = [err4];
          } else {
            vErrors.push(err4);
          }
          errors++;
        }
      }
    }
    for (const key2 in data) {
      if (pattern114.test(key2)) {
        if (typeof data[key2] !== "string") {
          const err5 = {
            instancePath: instancePath + "/" + key2.replace(/~/g, "~0").replace(/\//g, "~1"),
            schemaPath: "#/patternProperties/%5E(task_id)%24/type",
            keyword: "type",
            params: { type: "string" },
            message: "must be string",
          };
          if (vErrors === null) {
            vErrors = [err5];
          } else {
            vErrors.push(err5);
          }
          errors++;
        }
      }
    }
  } else {
    const err6 = {
      instancePath,
      schemaPath: "#/type",
      keyword: "type",
      params: { type: "object" },
      message: "must be object",
    };
    if (vErrors === null) {
      vErrors = [err6];
    } else {
      vErrors.push(err6);
    }
    errors++;
  }
  validate78.errors = vErrors;
  return errors === 0;
}
validate78.evaluated = { "props": true, "dynamicProps": false, "dynamicItems": false };

function validate73(
  data,
  { instancePath = "", parentData, parentDataProperty, rootData = data, dynamicAnchors = {} } = {},
) {
  let vErrors = null;
  let errors = 0;
  const evaluated0 = validate73.evaluated;
  if (evaluated0.dynamicProps) {
    evaluated0.props = undefined;
  }
  if (evaluated0.dynamicItems) {
    evaluated0.items = undefined;
  }
  if (data && typeof data == "object" && !Array.isArray(data)) {
    for (const key0 in data) {
      if (
        !((((((key0 === "artifactUpdate") || (key0 === "message")) || (key0 === "statusUpdate")) ||
          (key0 === "task")) || (pattern137.test(key0))) || (pattern138.test(key0)))
      ) {
        const err0 = {
          instancePath,
          schemaPath: "#/additionalProperties",
          keyword: "additionalProperties",
          params: { additionalProperty: key0 },
          message: "must NOT have additional properties",
        };
        if (vErrors === null) {
          vErrors = [err0];
        } else {
          vErrors.push(err0);
        }
        errors++;
      }
    }
    if (data.artifactUpdate !== undefined) {
      if (
        !(validate74(data.artifactUpdate, {
          instancePath: instancePath + "/artifactUpdate",
          parentData: data,
          parentDataProperty: "artifactUpdate",
          rootData,
          dynamicAnchors,
        }))
      ) {
        vErrors = vErrors === null ? validate74.errors : vErrors.concat(validate74.errors);
        errors = vErrors.length;
      }
    }
    if (data.message !== undefined) {
      if (
        !(validate59(data.message, {
          instancePath: instancePath + "/message",
          parentData: data,
          parentDataProperty: "message",
          rootData,
          dynamicAnchors,
        }))
      ) {
        vErrors = vErrors === null ? validate59.errors : vErrors.concat(validate59.errors);
        errors = vErrors.length;
      }
    }
    if (data.statusUpdate !== undefined) {
      if (
        !(validate78(data.statusUpdate, {
          instancePath: instancePath + "/statusUpdate",
          parentData: data,
          parentDataProperty: "statusUpdate",
          rootData,
          dynamicAnchors,
        }))
      ) {
        vErrors = vErrors === null ? validate78.errors : vErrors.concat(validate78.errors);
        errors = vErrors.length;
      }
    }
    if (data.task !== undefined) {
      if (
        !(validate62(data.task, {
          instancePath: instancePath + "/task",
          parentData: data,
          parentDataProperty: "task",
          rootData,
          dynamicAnchors,
        }))
      ) {
        vErrors = vErrors === null ? validate62.errors : vErrors.concat(validate62.errors);
        errors = vErrors.length;
      }
    }
    for (const key1 in data) {
      if (pattern137.test(key1)) {
        if (
          !(validate74(data[key1], {
            instancePath: instancePath + "/" + key1.replace(/~/g, "~0").replace(/\//g, "~1"),
            parentData: data,
            parentDataProperty: key1,
            rootData,
            dynamicAnchors,
          }))
        ) {
          vErrors = vErrors === null ? validate74.errors : vErrors.concat(validate74.errors);
          errors = vErrors.length;
        }
      }
    }
    for (const key2 in data) {
      if (pattern138.test(key2)) {
        if (
          !(validate78(data[key2], {
            instancePath: instancePath + "/" + key2.replace(/~/g, "~0").replace(/\//g, "~1"),
            parentData: data,
            parentDataProperty: key2,
            rootData,
            dynamicAnchors,
          }))
        ) {
          vErrors = vErrors === null ? validate78.errors : vErrors.concat(validate78.errors);
          errors = vErrors.length;
        }
      }
    }
  } else {
    const err1 = {
      instancePath,
      schemaPath: "#/type",
      keyword: "type",
      params: { type: "object" },
      message: "must be object",
    };
    if (vErrors === null) {
      vErrors = [err1];
    } else {
      vErrors.push(err1);
    }
    errors++;
  }
  validate73.errors = vErrors;
  return errors === 0;
}
validate73.evaluated = { "props": true, "dynamicProps": false, "dynamicItems": false };

function validate72(
  data,
  { instancePath = "", parentData, parentDataProperty, rootData = data, dynamicAnchors = {} } = {},
) {
  /*# sourceURL="https://point-and-shoot.invalid/schemas/a2a/v1/validateStreamResponse" */
  let vErrors = null;
  let errors = 0;
  const evaluated0 = validate72.evaluated;
  if (evaluated0.dynamicProps) {
    evaluated0.props = undefined;
  }
  if (evaluated0.dynamicItems) {
    evaluated0.items = undefined;
  }
  if (
    !(validate73(data, { instancePath, parentData, parentDataProperty, rootData, dynamicAnchors }))
  ) {
    vErrors = vErrors === null ? validate73.errors : vErrors.concat(validate73.errors);
    errors = vErrors.length;
  }
  validate72.errors = vErrors;
  return errors === 0;
}
validate72.evaluated = { "props": true, "dynamicProps": false, "dynamicItems": false };

export const validateTask = validate85;
const schema93 = {
  "$id": "https://point-and-shoot.invalid/schemas/a2a/v1/validateTask",
  "$ref": "https://point-and-shoot.invalid/schemas/a2a/v1#/definitions/Task",
};

function validate86(
  data,
  { instancePath = "", parentData, parentDataProperty, rootData = data, dynamicAnchors = {} } = {},
) {
  let vErrors = null;
  let errors = 0;
  const evaluated0 = validate86.evaluated;
  if (evaluated0.dynamicProps) {
    evaluated0.props = undefined;
  }
  if (evaluated0.dynamicItems) {
    evaluated0.items = undefined;
  }
  if (data && typeof data == "object" && !Array.isArray(data)) {
    for (const key0 in data) {
      if (
        !(((((((key0 === "artifacts") || (key0 === "contextId")) || (key0 === "history")) ||
          (key0 === "id")) || (key0 === "metadata")) || (key0 === "status")) ||
          (pattern111.test(key0)))
      ) {
        const err0 = {
          instancePath,
          schemaPath: "#/additionalProperties",
          keyword: "additionalProperties",
          params: { additionalProperty: key0 },
          message: "must NOT have additional properties",
        };
        if (vErrors === null) {
          vErrors = [err0];
        } else {
          vErrors.push(err0);
        }
        errors++;
      }
    }
    if (data.artifacts !== undefined) {
      let data0 = data.artifacts;
      if (Array.isArray(data0)) {
        const len0 = data0.length;
        for (let i0 = 0; i0 < len0; i0++) {
          if (
            !(validate63(data0[i0], {
              instancePath: instancePath + "/artifacts/" + i0,
              parentData: data0,
              parentDataProperty: i0,
              rootData,
              dynamicAnchors,
            }))
          ) {
            vErrors = vErrors === null ? validate63.errors : vErrors.concat(validate63.errors);
            errors = vErrors.length;
          }
        }
      } else {
        const err1 = {
          instancePath: instancePath + "/artifacts",
          schemaPath: "#/properties/artifacts/type",
          keyword: "type",
          params: { type: "array" },
          message: "must be array",
        };
        if (vErrors === null) {
          vErrors = [err1];
        } else {
          vErrors.push(err1);
        }
        errors++;
      }
    }
    if (data.contextId !== undefined) {
      if (typeof data.contextId !== "string") {
        const err2 = {
          instancePath: instancePath + "/contextId",
          schemaPath: "#/properties/contextId/type",
          keyword: "type",
          params: { type: "string" },
          message: "must be string",
        };
        if (vErrors === null) {
          vErrors = [err2];
        } else {
          vErrors.push(err2);
        }
        errors++;
      }
    }
    if (data.history !== undefined) {
      let data3 = data.history;
      if (Array.isArray(data3)) {
        const len1 = data3.length;
        for (let i1 = 0; i1 < len1; i1++) {
          if (
            !(validate59(data3[i1], {
              instancePath: instancePath + "/history/" + i1,
              parentData: data3,
              parentDataProperty: i1,
              rootData,
              dynamicAnchors,
            }))
          ) {
            vErrors = vErrors === null ? validate59.errors : vErrors.concat(validate59.errors);
            errors = vErrors.length;
          }
        }
      } else {
        const err3 = {
          instancePath: instancePath + "/history",
          schemaPath: "#/properties/history/type",
          keyword: "type",
          params: { type: "array" },
          message: "must be array",
        };
        if (vErrors === null) {
          vErrors = [err3];
        } else {
          vErrors.push(err3);
        }
        errors++;
      }
    }
    if (data.id !== undefined) {
      if (typeof data.id !== "string") {
        const err4 = {
          instancePath: instancePath + "/id",
          schemaPath: "#/properties/id/type",
          keyword: "type",
          params: { type: "string" },
          message: "must be string",
        };
        if (vErrors === null) {
          vErrors = [err4];
        } else {
          vErrors.push(err4);
        }
        errors++;
      }
    }
    if (data.metadata !== undefined) {
      let data6 = data.metadata;
      if (!(data6 && typeof data6 == "object" && !Array.isArray(data6))) {
        const err5 = {
          instancePath: instancePath + "/metadata",
          schemaPath: "#/definitions/Struct/type",
          keyword: "type",
          params: { type: "object" },
          message: "must be object",
        };
        if (vErrors === null) {
          vErrors = [err5];
        } else {
          vErrors.push(err5);
        }
        errors++;
      }
    }
    if (data.status !== undefined) {
      if (
        !(validate67(data.status, {
          instancePath: instancePath + "/status",
          parentData: data,
          parentDataProperty: "status",
          rootData,
          dynamicAnchors,
        }))
      ) {
        vErrors = vErrors === null ? validate67.errors : vErrors.concat(validate67.errors);
        errors = vErrors.length;
      }
    }
    for (const key1 in data) {
      if (pattern111.test(key1)) {
        if (typeof data[key1] !== "string") {
          const err6 = {
            instancePath: instancePath + "/" + key1.replace(/~/g, "~0").replace(/\//g, "~1"),
            schemaPath: "#/patternProperties/%5E(context_id)%24/type",
            keyword: "type",
            params: { type: "string" },
            message: "must be string",
          };
          if (vErrors === null) {
            vErrors = [err6];
          } else {
            vErrors.push(err6);
          }
          errors++;
        }
      }
    }
  } else {
    const err7 = {
      instancePath,
      schemaPath: "#/type",
      keyword: "type",
      params: { type: "object" },
      message: "must be object",
    };
    if (vErrors === null) {
      vErrors = [err7];
    } else {
      vErrors.push(err7);
    }
    errors++;
  }
  validate86.errors = vErrors;
  return errors === 0;
}
validate86.evaluated = { "props": true, "dynamicProps": false, "dynamicItems": false };

function validate85(
  data,
  { instancePath = "", parentData, parentDataProperty, rootData = data, dynamicAnchors = {} } = {},
) {
  /*# sourceURL="https://point-and-shoot.invalid/schemas/a2a/v1/validateTask" */
  let vErrors = null;
  let errors = 0;
  const evaluated0 = validate85.evaluated;
  if (evaluated0.dynamicProps) {
    evaluated0.props = undefined;
  }
  if (evaluated0.dynamicItems) {
    evaluated0.items = undefined;
  }
  if (
    !(validate86(data, { instancePath, parentData, parentDataProperty, rootData, dynamicAnchors }))
  ) {
    vErrors = vErrors === null ? validate86.errors : vErrors.concat(validate86.errors);
    errors = vErrors.length;
  }
  validate85.errors = vErrors;
  return errors === 0;
}
validate85.evaluated = { "props": true, "dynamicProps": false, "dynamicItems": false };

export const validateTaskArtifactUpdateEvent = validate91;
const schema96 = {
  "$id": "https://point-and-shoot.invalid/schemas/a2a/v1/validateTaskArtifactUpdateEvent",
  "$ref": "https://point-and-shoot.invalid/schemas/a2a/v1#/definitions/Task Artifact Update Event",
};

function validate92(
  data,
  { instancePath = "", parentData, parentDataProperty, rootData = data, dynamicAnchors = {} } = {},
) {
  let vErrors = null;
  let errors = 0;
  const evaluated0 = validate92.evaluated;
  if (evaluated0.dynamicProps) {
    evaluated0.props = undefined;
  }
  if (evaluated0.dynamicItems) {
    evaluated0.items = undefined;
  }
  if (data && typeof data == "object" && !Array.isArray(data)) {
    for (const key0 in data) {
      if (
        !(((((((((key0 === "append") || (key0 === "artifact")) || (key0 === "contextId")) ||
          (key0 === "lastChunk")) || (key0 === "metadata")) || (key0 === "taskId")) ||
          (pattern111.test(key0))) || (pattern140.test(key0))) || (pattern114.test(key0)))
      ) {
        const err0 = {
          instancePath,
          schemaPath: "#/additionalProperties",
          keyword: "additionalProperties",
          params: { additionalProperty: key0 },
          message: "must NOT have additional properties",
        };
        if (vErrors === null) {
          vErrors = [err0];
        } else {
          vErrors.push(err0);
        }
        errors++;
      }
    }
    if (data.append !== undefined) {
      if (typeof data.append !== "boolean") {
        const err1 = {
          instancePath: instancePath + "/append",
          schemaPath: "#/properties/append/type",
          keyword: "type",
          params: { type: "boolean" },
          message: "must be boolean",
        };
        if (vErrors === null) {
          vErrors = [err1];
        } else {
          vErrors.push(err1);
        }
        errors++;
      }
    }
    if (data.artifact !== undefined) {
      if (
        !(validate63(data.artifact, {
          instancePath: instancePath + "/artifact",
          parentData: data,
          parentDataProperty: "artifact",
          rootData,
          dynamicAnchors,
        }))
      ) {
        vErrors = vErrors === null ? validate63.errors : vErrors.concat(validate63.errors);
        errors = vErrors.length;
      }
    }
    if (data.contextId !== undefined) {
      if (typeof data.contextId !== "string") {
        const err2 = {
          instancePath: instancePath + "/contextId",
          schemaPath: "#/properties/contextId/type",
          keyword: "type",
          params: { type: "string" },
          message: "must be string",
        };
        if (vErrors === null) {
          vErrors = [err2];
        } else {
          vErrors.push(err2);
        }
        errors++;
      }
    }
    if (data.lastChunk !== undefined) {
      if (typeof data.lastChunk !== "boolean") {
        const err3 = {
          instancePath: instancePath + "/lastChunk",
          schemaPath: "#/properties/lastChunk/type",
          keyword: "type",
          params: { type: "boolean" },
          message: "must be boolean",
        };
        if (vErrors === null) {
          vErrors = [err3];
        } else {
          vErrors.push(err3);
        }
        errors++;
      }
    }
    if (data.metadata !== undefined) {
      let data4 = data.metadata;
      if (!(data4 && typeof data4 == "object" && !Array.isArray(data4))) {
        const err4 = {
          instancePath: instancePath + "/metadata",
          schemaPath: "#/definitions/Struct/type",
          keyword: "type",
          params: { type: "object" },
          message: "must be object",
        };
        if (vErrors === null) {
          vErrors = [err4];
        } else {
          vErrors.push(err4);
        }
        errors++;
      }
    }
    if (data.taskId !== undefined) {
      if (typeof data.taskId !== "string") {
        const err5 = {
          instancePath: instancePath + "/taskId",
          schemaPath: "#/properties/taskId/type",
          keyword: "type",
          params: { type: "string" },
          message: "must be string",
        };
        if (vErrors === null) {
          vErrors = [err5];
        } else {
          vErrors.push(err5);
        }
        errors++;
      }
    }
    for (const key1 in data) {
      if (pattern111.test(key1)) {
        if (typeof data[key1] !== "string") {
          const err6 = {
            instancePath: instancePath + "/" + key1.replace(/~/g, "~0").replace(/\//g, "~1"),
            schemaPath: "#/patternProperties/%5E(context_id)%24/type",
            keyword: "type",
            params: { type: "string" },
            message: "must be string",
          };
          if (vErrors === null) {
            vErrors = [err6];
          } else {
            vErrors.push(err6);
          }
          errors++;
        }
      }
    }
    for (const key2 in data) {
      if (pattern140.test(key2)) {
        if (typeof data[key2] !== "boolean") {
          const err7 = {
            instancePath: instancePath + "/" + key2.replace(/~/g, "~0").replace(/\//g, "~1"),
            schemaPath: "#/patternProperties/%5E(last_chunk)%24/type",
            keyword: "type",
            params: { type: "boolean" },
            message: "must be boolean",
          };
          if (vErrors === null) {
            vErrors = [err7];
          } else {
            vErrors.push(err7);
          }
          errors++;
        }
      }
    }
    for (const key3 in data) {
      if (pattern114.test(key3)) {
        if (typeof data[key3] !== "string") {
          const err8 = {
            instancePath: instancePath + "/" + key3.replace(/~/g, "~0").replace(/\//g, "~1"),
            schemaPath: "#/patternProperties/%5E(task_id)%24/type",
            keyword: "type",
            params: { type: "string" },
            message: "must be string",
          };
          if (vErrors === null) {
            vErrors = [err8];
          } else {
            vErrors.push(err8);
          }
          errors++;
        }
      }
    }
  } else {
    const err9 = {
      instancePath,
      schemaPath: "#/type",
      keyword: "type",
      params: { type: "object" },
      message: "must be object",
    };
    if (vErrors === null) {
      vErrors = [err9];
    } else {
      vErrors.push(err9);
    }
    errors++;
  }
  validate92.errors = vErrors;
  return errors === 0;
}
validate92.evaluated = { "props": true, "dynamicProps": false, "dynamicItems": false };

function validate91(
  data,
  { instancePath = "", parentData, parentDataProperty, rootData = data, dynamicAnchors = {} } = {},
) {
  /*# sourceURL="https://point-and-shoot.invalid/schemas/a2a/v1/validateTaskArtifactUpdateEvent" */
  let vErrors = null;
  let errors = 0;
  const evaluated0 = validate91.evaluated;
  if (evaluated0.dynamicProps) {
    evaluated0.props = undefined;
  }
  if (evaluated0.dynamicItems) {
    evaluated0.items = undefined;
  }
  if (
    !(validate92(data, { instancePath, parentData, parentDataProperty, rootData, dynamicAnchors }))
  ) {
    vErrors = vErrors === null ? validate92.errors : vErrors.concat(validate92.errors);
    errors = vErrors.length;
  }
  validate91.errors = vErrors;
  return errors === 0;
}
validate91.evaluated = { "props": true, "dynamicProps": false, "dynamicItems": false };

export const validateTaskStatusUpdateEvent = validate95;
const schema99 = {
  "$id": "https://point-and-shoot.invalid/schemas/a2a/v1/validateTaskStatusUpdateEvent",
  "$ref": "https://point-and-shoot.invalid/schemas/a2a/v1#/definitions/Task Status Update Event",
};

function validate96(
  data,
  { instancePath = "", parentData, parentDataProperty, rootData = data, dynamicAnchors = {} } = {},
) {
  let vErrors = null;
  let errors = 0;
  const evaluated0 = validate96.evaluated;
  if (evaluated0.dynamicProps) {
    evaluated0.props = undefined;
  }
  if (evaluated0.dynamicItems) {
    evaluated0.items = undefined;
  }
  if (data && typeof data == "object" && !Array.isArray(data)) {
    for (const key0 in data) {
      if (
        !((((((key0 === "contextId") || (key0 === "metadata")) || (key0 === "status")) ||
          (key0 === "taskId")) || (pattern111.test(key0))) || (pattern114.test(key0)))
      ) {
        const err0 = {
          instancePath,
          schemaPath: "#/additionalProperties",
          keyword: "additionalProperties",
          params: { additionalProperty: key0 },
          message: "must NOT have additional properties",
        };
        if (vErrors === null) {
          vErrors = [err0];
        } else {
          vErrors.push(err0);
        }
        errors++;
      }
    }
    if (data.contextId !== undefined) {
      if (typeof data.contextId !== "string") {
        const err1 = {
          instancePath: instancePath + "/contextId",
          schemaPath: "#/properties/contextId/type",
          keyword: "type",
          params: { type: "string" },
          message: "must be string",
        };
        if (vErrors === null) {
          vErrors = [err1];
        } else {
          vErrors.push(err1);
        }
        errors++;
      }
    }
    if (data.metadata !== undefined) {
      let data1 = data.metadata;
      if (!(data1 && typeof data1 == "object" && !Array.isArray(data1))) {
        const err2 = {
          instancePath: instancePath + "/metadata",
          schemaPath: "#/definitions/Struct/type",
          keyword: "type",
          params: { type: "object" },
          message: "must be object",
        };
        if (vErrors === null) {
          vErrors = [err2];
        } else {
          vErrors.push(err2);
        }
        errors++;
      }
    }
    if (data.status !== undefined) {
      if (
        !(validate67(data.status, {
          instancePath: instancePath + "/status",
          parentData: data,
          parentDataProperty: "status",
          rootData,
          dynamicAnchors,
        }))
      ) {
        vErrors = vErrors === null ? validate67.errors : vErrors.concat(validate67.errors);
        errors = vErrors.length;
      }
    }
    if (data.taskId !== undefined) {
      if (typeof data.taskId !== "string") {
        const err3 = {
          instancePath: instancePath + "/taskId",
          schemaPath: "#/properties/taskId/type",
          keyword: "type",
          params: { type: "string" },
          message: "must be string",
        };
        if (vErrors === null) {
          vErrors = [err3];
        } else {
          vErrors.push(err3);
        }
        errors++;
      }
    }
    for (const key1 in data) {
      if (pattern111.test(key1)) {
        if (typeof data[key1] !== "string") {
          const err4 = {
            instancePath: instancePath + "/" + key1.replace(/~/g, "~0").replace(/\//g, "~1"),
            schemaPath: "#/patternProperties/%5E(context_id)%24/type",
            keyword: "type",
            params: { type: "string" },
            message: "must be string",
          };
          if (vErrors === null) {
            vErrors = [err4];
          } else {
            vErrors.push(err4);
          }
          errors++;
        }
      }
    }
    for (const key2 in data) {
      if (pattern114.test(key2)) {
        if (typeof data[key2] !== "string") {
          const err5 = {
            instancePath: instancePath + "/" + key2.replace(/~/g, "~0").replace(/\//g, "~1"),
            schemaPath: "#/patternProperties/%5E(task_id)%24/type",
            keyword: "type",
            params: { type: "string" },
            message: "must be string",
          };
          if (vErrors === null) {
            vErrors = [err5];
          } else {
            vErrors.push(err5);
          }
          errors++;
        }
      }
    }
  } else {
    const err6 = {
      instancePath,
      schemaPath: "#/type",
      keyword: "type",
      params: { type: "object" },
      message: "must be object",
    };
    if (vErrors === null) {
      vErrors = [err6];
    } else {
      vErrors.push(err6);
    }
    errors++;
  }
  validate96.errors = vErrors;
  return errors === 0;
}
validate96.evaluated = { "props": true, "dynamicProps": false, "dynamicItems": false };

function validate95(
  data,
  { instancePath = "", parentData, parentDataProperty, rootData = data, dynamicAnchors = {} } = {},
) {
  /*# sourceURL="https://point-and-shoot.invalid/schemas/a2a/v1/validateTaskStatusUpdateEvent" */
  let vErrors = null;
  let errors = 0;
  const evaluated0 = validate95.evaluated;
  if (evaluated0.dynamicProps) {
    evaluated0.props = undefined;
  }
  if (evaluated0.dynamicItems) {
    evaluated0.items = undefined;
  }
  if (
    !(validate96(data, { instancePath, parentData, parentDataProperty, rootData, dynamicAnchors }))
  ) {
    vErrors = vErrors === null ? validate96.errors : vErrors.concat(validate96.errors);
    errors = vErrors.length;
  }
  validate95.errors = vErrors;
  return errors === 0;
}
validate95.evaluated = { "props": true, "dynamicProps": false, "dynamicItems": false };
