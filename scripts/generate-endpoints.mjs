// Generates the typed endpoint catalog from the live Botkeep OpenAPI document.
//
//   bun run generate:endpoints
//
// Writes:
//   public/openapi.json            the raw spec (served same-origin, downloadable)
//   src/lib/endpoints.generated.ts typed catalog used by the Reference + Console UI
import { mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const SPEC_URL = "https://api.botkeep.cloud/api/v1/developer/openapi.json";
const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");

const SPEC_METHODS = ["get", "post", "put", "patch", "delete"];

/** Human readable rendering of a JSON-schema fragment. */
function renderType(schema) {
  if (!schema || typeof schema !== "object") return "any";
  if (schema.$ref) {
    const name = schema.$ref.split("/").pop();
    return schema.enum ? `enum(${schema.enum.join(" | ")})` : name;
  }
  if (Array.isArray(schema.anyOf) || Array.isArray(schema.oneOf)) {
    const parts = (schema.anyOf ?? schema.oneOf)
      .filter((s) => s.type !== "null")
      .map(renderType)
      .filter((t) => t !== "null");
    return parts.length ? parts.join(" | ") : "null";
  }
  if (schema.type === "array") return `${renderType(schema.items)}[]`;
  if (schema.enum) return `enum(${schema.enum.join(" | ")})`;
  return schema.type ?? "any";
}

function constraints(schema) {
  if (!schema || typeof schema !== "object") return "";
  const bits = [];
  if (typeof schema.minimum === "number") bits.push(`min ${schema.minimum}`);
  if (typeof schema.maximum === "number") bits.push(`max ${schema.maximum}`);
  if (typeof schema.minLength === "number") bits.push(`min len ${schema.minLength}`);
  if (typeof schema.maxLength === "number") bits.push(`max len ${schema.maxLength}`);
  if (schema.pattern) bits.push(`pattern ${schema.pattern}`);
  if (schema.default !== undefined && schema.default !== "") bits.push(`default ${JSON.stringify(schema.default)}`);
  if (schema.format) bits.push(schema.format);
  return bits.join(", ");
}

/** Groups an operation under a readable resource heading. */
function groupFor(path) {
  const rest = path.replace("/api/v1/developer/", "");
  const segments = rest.split("/").filter(Boolean);
  const head = segments[0] ?? "root";
  if (head !== "workloads") return head;
  const sub = segments[2];
  if (!sub) return "workloads";
  if (sub === "backups") return "workloads / backups";
  if (sub === "domains" || sub === "domain") return "workloads / domains";
  if (sub === "files" || sub === "file" || sub === "file-action") return "workloads / files";
  if (sub === "environment") return "workloads / environment";
  if (sub === "github") return "workloads / deploys";
  if (sub === "packages") return "workloads / packages";
  if (sub === "console") return "workloads / console";
  if (sub === "logs") return "workloads / logs";
  if (sub === "network") return "workloads / network";
  if (sub === "runtime") return "workloads / runtime";
  if (sub === "settings" || sub === "startup-check") return "workloads / settings";
  return "workloads";
}

function summarize(schemaName, schema) {
  const props = Object.entries(schema?.properties ?? {}).map(([name, value]) => ({
    name,
    type: renderType(value),
    required: (schema.required ?? []).includes(name),
    note: constraints(value),
  }));
  return { name: schemaName, required: schema?.required ?? [], props };
}

const response = await fetch(SPEC_URL, { headers: { accept: "application/json" } });
if (!response.ok) {
  console.error(`Failed to fetch ${SPEC_URL}: HTTP ${response.status}`);
  process.exit(1);
}
const spec = await response.json();
const schemas = spec.components?.schemas ?? {};

const endpoints = [];
for (const [path, operations] of Object.entries(spec.paths ?? {})) {
  for (const [method, op] of Object.entries(operations)) {
    if (!SPEC_METHODS.includes(method)) continue;
    const params = (op.parameters ?? []).map((p) => ({
      name: p.name,
      in: p.in,
      required: Boolean(p.required),
      type: renderType(p.schema),
      note: constraints(p.schema),
    }));
    const bodySchemaRef = op.requestBody?.content?.["application/json"]?.schema?.$ref;
    const bodySchemaName = bodySchemaRef ? bodySchemaRef.split("/").pop() : undefined;
    const status = Object.keys(op.responses ?? {}).find((code) => code.startsWith("2"));
    endpoints.push({
      method: method.toUpperCase(),
      path,
      summary: op.summary ?? "",
      operationId: op.operationId ?? "",
      scopes: op["x-botkeep-scopes"] ?? [],
      write: Boolean(op.requestBody) || ["POST", "PUT", "PATCH", "DELETE"].includes(method.toUpperCase()),
      group: groupFor(path),
      params,
      requestSchema: bodySchemaName ? summarize(bodySchemaName, schemas[bodySchemaName]) : undefined,
      successStatus: status ? Number(status) : undefined,
    });
  }
}

endpoints.sort((a, b) => a.path.localeCompare(b.path) || a.method.localeCompare(b.method));

// Scope catalogue: every distinct scope in the spec, plus the read/write intent.
const scopes = [...new Set(endpoints.flatMap((e) => e.scopes))].sort();
const scopeCatalogue = scopes.map((scope) => ({
  scope,
  resource: scope.split(":")[0],
  level: scope.split(":")[1],
  endpoints: endpoints.filter((e) => e.scopes.includes(scope)).length,
}));

const header = `// AUTO-GENERATED by scripts/generate-endpoints.mjs — do not edit by hand.
// Source: ${SPEC_URL} (Botkeep Developer API ${spec.info?.version ?? "?"})
`;

const body = `${header}
export type ParamDoc = {
  name: string;
  in: "path" | "query" | "header";
  required: boolean;
  type: string;
  note: string;
};

export type SchemaPropDoc = {
  name: string;
  type: string;
  required: boolean;
  note: string;
};

export type SchemaDoc = {
  name: string;
  required: string[];
  props: SchemaPropDoc[];
};

export type EndpointDoc = {
  method: string;
  path: string;
  summary: string;
  operationId: string;
  scopes: string[];
  write: boolean;
  group: string;
  params: ParamDoc[];
  requestSchema?: SchemaDoc;
  successStatus?: number;
};

export type ScopeDoc = {
  scope: string;
  resource: string;
  level: string;
  endpoints: number;
};

export const SPEC_INFO = ${JSON.stringify(
  {
    title: spec.info?.title ?? "Botkeep Developer API",
    version: spec.info?.version ?? "",
    source: SPEC_URL,
    baseUrl: "https://api.botkeep.cloud/api/v1/developer",
  },
  null,
  2,
)} as const;

export const ENDPOINTS: EndpointDoc[] = ${JSON.stringify(endpoints, null, 2)};

export const SCOPES: ScopeDoc[] = ${JSON.stringify(scopeCatalogue, null, 2)};

export const ENDPOINT_GROUPS: string[] = ${JSON.stringify(
  [...new Set(endpoints.map((e) => e.group))].sort(),
  null,
  2,
)};
`;

await mkdir(resolve(root, "public"), { recursive: true });
await mkdir(resolve(root, "src/lib"), { recursive: true });
await writeFile(resolve(root, "public/openapi.json"), JSON.stringify(spec, null, 2));
await writeFile(resolve(root, "src/lib/endpoints.generated.ts"), body);

console.log(
  `Wrote ${endpoints.length} endpoints, ${scopeCatalogue.length} scopes -> src/lib/endpoints.generated.ts`,
);
