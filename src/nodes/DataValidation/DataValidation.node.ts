import { IExecuteFunctions } from "n8n-core";
import {
  IBinaryKeyData,
  IDataObject,
  INodeExecutionData,
  INodeType,
  INodeTypeDescription,
  NodeOperationError,
} from "n8n-workflow";
import Ajv, { Schema } from "ajv";
import addErrors from "ajv-errors";

export class DataValidation implements INodeType {
  description: INodeTypeDescription = {
    displayName: "Flagbit Data Validation",
    name: "dataValidation",
    group: ["transform"],
    version: 1,
    description: "Validate input data before continuing the workflow",
    defaults: {
      name: "Flagbit Data Validation",
      color: "#000000",
    },
    inputs: ["main"],
    outputs: ["main"],
    properties: [
      {
        displayName: "JSON Schema",
        name: "jsonSchema",
        type: "json",
        typeOptions: {
          alwaysOpenEditWindow: true,
        },
        default: JSON.stringify(
          {
            type: "object",
            properties: {
              foo: { type: "integer" },
              bar: { type: "string" },
            },
            required: ["foo"],
            additionalProperties: false,
          },
          undefined,
          2
        ),
        placeholder: "",
        // eslint-disable-next-line n8n-nodes-base/node-param-description-miscased-json
        description:
          "Visit https://ajv.js.org/ or https://json-schema.org/ to learn how to describe your validation rules in JSON Schemas",
      },
    ],
  };

  async execute(this: IExecuteFunctions): Promise<INodeExecutionData[][]> {
    const items = this.getInputData();
    let item: INodeExecutionData;
    const returnData: INodeExecutionData[] = [];

    const jsonSchemaString = this.getNodeParameter("jsonSchema", 0);

    if (typeof jsonSchemaString !== "string") {
      throw new NodeOperationError(this.getNode(), "Invalid JSON Schema");
    }

    let jsonSchema: Schema;

    try {
      jsonSchema = JSON.parse(jsonSchemaString) as Schema;
    } catch (err) {
      throw new NodeOperationError(this.getNode(), "Invalid JSON Schema");
    }

    const ajv = new Ajv({ allErrors: true });
    addErrors(ajv);
    let validate: ReturnType<typeof ajv["compile"]>;

    try {
      validate = ajv.compile(jsonSchema);
    } catch (err) {
      throw new NodeOperationError(this.getNode(), "Invalid JSON Schema");
    }

    for (let itemIndex = 0; itemIndex < items.length; itemIndex++) {
      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
      item = items[itemIndex]!;

      let newItemJson: IDataObject = {};
      const newItemBinary: IBinaryKeyData = {};

      if (item.binary !== undefined) {
        Object.assign(newItemBinary, item.binary);
      }

      newItemJson = Object.assign({}, item.json);

      const valid = validate(item["json"]);

      if (!valid) {
        if (validate.errors) {
          const errors = validate.errors.map((error) => ({
            message: error.message || "",
            schemaPath: error.schemaPath,
            params: error.params,
          }));

          newItemJson["errors"] = errors;
        }
      }
      returnData.push({
        json: newItemJson,
        binary:
          Object.keys(newItemBinary).length === 0 ? undefined : newItemBinary,
      });
    }

    return this.prepareOutputData(returnData);
  }
}
